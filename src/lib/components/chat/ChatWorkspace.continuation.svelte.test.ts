import type { Workspace } from '$lib/stores/workspaceStore.svelte';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import type { UIMessageChunk } from 'ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatWorkspace from './ChatWorkspace.svelte';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => ({ page: { url: new URL('https://example.test/chat') } }));

function gatedResponse() {
	let controller!: ReadableStreamDefaultController<Uint8Array>;
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(value) {
			controller = value;
		}
	});
	return {
		response(signal?: AbortSignal | null) {
			signal?.addEventListener('abort', () =>
				controller.error(new DOMException('Aborted', 'AbortError'))
			);
			return new Response(body, {
				headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' }
			});
		},
		emit(chunk: UIMessageChunk) {
			controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
		},
		fail() {
			controller.error(new TypeError('Connection lost'));
		},
		finish() {
			controller.enqueue(encoder.encode('data: {"type":"finish"}\n\ndata: [DONE]\n\n'));
			controller.close();
		}
	};
}

const workspace: Workspace = {
	id: 'continuation-workspace',
	title: 'Coffee',
	type: 'general',
	context_summary: '',
	canvas_state: {},
	last_accessed_at: '2026-09-22T15:00:00Z',
	created_at: '2026-09-22T15:00:00Z',
	reset_epoch: 0,
	canvas_version: 0
};

describe('ChatWorkspace confirmed-action continuation', () => {
	beforeEach(() => {
		Element.prototype.scrollIntoView = vi.fn();
		Object.defineProperty(navigator, 'sendBeacon', {
			configurable: true,
			value: vi.fn(() => true)
		});
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('retries a failed continuation without executing the committed action again', async () => {
		const proposal = gatedResponse();
		const failedContinuation = gatedResponse();
		const retry = gatedResponse();
		const chatRequests: Array<{
			messages: Array<{ role: string }>;
			completedAction?: { executionId: string };
		}> = [];
		const actionRequests: unknown[] = [];
		let blockCanvasSave = false;
		let releaseCanvasSave!: () => void;
		const canvasSaveBlocked = new Promise<void>((resolve) => {
			releaseCanvasSave = resolve;
		});
		let canvasVersion = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>(async (input, init) => {
				const url = String(input);
				if (url === '/api/chat') {
					chatRequests.push(JSON.parse(String(init?.body)));
					const stream = [proposal, failedContinuation, retry][chatRequests.length - 1];
					if (!stream) throw new Error('Unexpected chat request');
					return stream.response(init?.signal);
				}
				if (url === '/api/chat/execute-action') {
					actionRequests.push(JSON.parse(String(init?.body)));
					return Response.json({
						success: true,
						id: 42,
						message: 'Bean added to inventory',
						replayed: false
					});
				}
				if (url === '/api/memory') return Response.json({ content: '' });
				if (url.endsWith('/messages')) {
					return Response.json({ reset_epoch: 0, next_message_sequence: 2 });
				}
				if (url.endsWith('/canvas')) {
					const payload = JSON.parse(String(init?.body));
					if (blockCanvasSave && actionRequests.length > 0) {
						blockCanvasSave = false;
						await canvasSaveBlocked;
					}
					return Response.json({
						canvas_state: payload.canvas_state,
						canvas_version: ++canvasVersion,
						reset_epoch: 0
					});
				}
				throw new Error(`Unexpected endpoint: ${url}`);
			})
		);

		render(ChatWorkspace, {
			canUseChat: true,
			canUseMallardWorkspaces: false,
			agentName: 'Cherry Green Agent',
			variant: 'drawer',
			initialWorkspaceData: {
				workspaces: [{ ...workspace }],
				workspace: { ...workspace },
				messages: []
			}
		});

		await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
		await fireEvent.input(screen.getByRole('textbox'), {
			target: { value: 'Add this coffee to inventory' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
		proposal.emit({ type: 'start', messageId: 'proposal-assistant' });
		proposal.emit({
			type: 'tool-input-available',
			toolCallId: 'proposal',
			toolName: 'propose_inventory',
			input: {}
		});
		proposal.emit({
			type: 'tool-output-available',
			toolCallId: 'proposal',
			output: {
				action_card: {
					executionId: 'proposal-assistant:proposal',
					actionType: 'add_bean_to_inventory',
					summary: 'Add bean',
					fields: [],
					status: 'proposed'
				}
			}
		});
		proposal.finish();

		await fireEvent.click(await screen.findByRole('button', { name: /Evidence 1/ }));
		blockCanvasSave = true;
		await fireEvent.click(await screen.findByRole('button', { name: 'Execute' }));
		await waitFor(() => expect(actionRequests).toHaveLength(1));
		await waitFor(() => expect(chatRequests).toHaveLength(2));
		expect(chatRequests[1].completedAction).toEqual({
			executionId: 'proposal-assistant:proposal'
		});
		expect(chatRequests[1].messages.filter((message) => message.role === 'user')).toHaveLength(1);
		expect(await screen.findByText('Action completed successfully.')).toBeInTheDocument();

		failedContinuation.fail();
		await fireEvent.click(screen.getByRole('button', { name: '← Back to answer' }));
		await waitFor(() =>
			expect(
				screen.getByText(/Action completed, but Cherry Green Agent couldn't continue/)
			).toBeVisible()
		);
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: '/pin' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
		await waitFor(() => expect(chatRequests).toHaveLength(2));
		expect(
			screen.getByText(/Action completed, but Cherry Green Agent couldn't continue/)
		).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		await waitFor(() => expect(chatRequests).toHaveLength(3));
		expect(actionRequests).toHaveLength(1);
		expect(chatRequests[2].completedAction).toEqual({
			executionId: 'proposal-assistant:proposal'
		});
		expect(chatRequests[2].messages.filter((message) => message.role === 'user')).toHaveLength(1);

		retry.emit({ type: 'start', messageId: 'continued-assistant' });
		retry.emit({ type: 'text-start', id: 'answer' });
		retry.emit({ type: 'text-delta', id: 'answer', delta: 'The bean is ready.' });
		retry.emit({ type: 'text-end', id: 'answer' });
		retry.finish();
		await waitFor(() => expect(screen.getByText('The bean is ready.')).toBeVisible());
		expect(actionRequests).toHaveLength(1);
		releaseCanvasSave();
		// Let the component's debounced message and canvas persistence settle while
		// the endpoint stub is still installed.
		await new Promise((resolve) => setTimeout(resolve, 900));
	});
});
