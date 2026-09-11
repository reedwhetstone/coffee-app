import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIMessageChunk } from 'ai';
import ChatWorkspace from './ChatWorkspace.svelte';
import { canvasStore } from '$lib/stores/canvasStore.svelte';
import type { Workspace, WorkspaceMessage } from '$lib/stores/workspaceStore.svelte';
import type { PersistedChatMessagePayload } from '$lib/services/chatPersistence';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => ({ page: { url: new URL('https://example.test/chat') } }));
// Canvas rendering is unrelated to transport/persistence. Its real store remains observable.
vi.mock('$lib/components/canvas/Canvas.svelte', () => ({ default: vi.fn() }));

function gatedResponse() {
	let controller!: ReadableStreamDefaultController<Uint8Array>;
	let closed = false;
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(value) {
			controller = value;
		}
	});
	return {
		response(signal?: AbortSignal | null) {
			signal?.addEventListener('abort', () => {
				if (!closed) {
					closed = true;
					controller.error(new DOMException('Aborted', 'AbortError'));
				}
			});
			return new Response(body, {
				headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' }
			});
		},
		emit(chunk: UIMessageChunk) {
			controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
		},
		fail() {
			closed = true;
			controller.error(new TypeError('Connection lost'));
		},
		finish() {
			closed = true;
			controller.enqueue(encoder.encode('data: {"type":"finish"}\n\ndata: [DONE]\n\n'));
			controller.close();
		}
	};
}

const workspace: Workspace = {
	id: 'recovery-workspace',
	title: 'Coffee',
	type: 'general',
	context_summary: '',
	canvas_state: {},
	last_accessed_at: '2026-09-11T17:00:00Z',
	created_at: '2026-09-11T17:00:00Z',
	reset_epoch: 0,
	canvas_version: 0
};

function mountWorkspace(messages: WorkspaceMessage[] = []) {
	return render(ChatWorkspace, {
		canUseChat: true,
		canUseMallardWorkspaces: false,
		agentName: 'Cherry Green Agent',
		variant: 'drawer',
		initialWorkspaceData: { workspaces: [{ ...workspace }], workspace: { ...workspace }, messages }
	});
}

function installEndpoints(streams: ReturnType<typeof gatedResponse>[]) {
	const saved: PersistedChatMessagePayload[][] = [];
	const requests: Array<{ messages: Array<{ id: string; parts: unknown[] }> }> = [];
	const canvasSaves: unknown[] = [];
	let canvasVersion = 0;
	vi.stubGlobal(
		'fetch',
		vi.fn<typeof fetch>(async (input, init) => {
			const url = String(input);
			if (url === '/api/chat') {
				requests.push(JSON.parse(String(init?.body)));
				const stream = streams[requests.length - 1];
				if (!stream) throw new Error('Unexpected chat request');
				return stream.response(init?.signal);
			}
			if (url === '/api/memory') return Response.json({ content: '' });
			if (url === `/api/workspaces/${workspace.id}/messages`) {
				const payload = JSON.parse(String(init?.body));
				saved.push(payload.messages);
				return Response.json({ reset_epoch: 0, next_message_sequence: saved.flat().length });
			}
			if (url === `/api/workspaces/${workspace.id}/canvas`) {
				const payload = JSON.parse(String(init?.body));
				canvasSaves.push(payload.canvas_state);
				return Response.json({
					canvas_state: payload.canvas_state,
					canvas_version: ++canvasVersion,
					reset_epoch: 0
				});
			}
			throw new Error(`Unexpected endpoint: ${url}`);
		})
	);
	return { saved, requests, canvasSaves };
}

async function send(
	stream: ReturnType<typeof gatedResponse>,
	assistantId: string,
	prompt = 'Find a washed coffee'
) {
	await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
	await fireEvent.input(screen.getByRole('textbox'), { target: { value: prompt } });
	await fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
	await waitFor(() =>
		expect(screen.getByRole('button', { name: 'Stop response' })).toBeInTheDocument()
	);
	stream.emit({ type: 'start', messageId: assistantId });
	stream.emit({ type: 'start-step' });
}

function emitCoffee(stream: ReturnType<typeof gatedResponse>) {
	stream.emit({
		type: 'tool-input-available',
		toolCallId: 'search',
		toolName: 'coffee_catalog_search',
		input: {}
	});
	stream.emit({
		type: 'tool-output-available',
		toolCallId: 'search',
		output: {
			coffees: [
				{
					id: 42,
					name: 'Retained Colombia',
					country: 'Colombia',
					processing: 'Washed',
					cost_lb: 8.5
				}
			]
		}
	});
}

function restoreRows(saved: PersistedChatMessagePayload[]): WorkspaceMessage[] {
	return saved.map((message, index) => ({
		...message,
		id: `storage-${index}`,
		workspace_id: workspace.id,
		role: message.role as WorkspaceMessage['role'],
		created_at: '2026-09-11T17:00:00Z'
	}));
}

let sendBeacon: ReturnType<typeof vi.fn>;
beforeEach(() => {
	canvasStore.resetAll();
	Element.prototype.scrollIntoView = vi.fn();
	sendBeacon = vi.fn(() => true);
	Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: sendBeacon });
});
afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe('ChatWorkspace interrupted-turn transport and persistence', () => {
	it('shows completed coffee before finish, then stop saves a safe snapshot that reloads', async () => {
		const stream = gatedResponse();
		const endpoints = installEndpoints([stream]);
		const mounted = mountWorkspace();
		await send(stream, 'stopped-assistant');
		emitCoffee(stream);
		stream.emit({
			type: 'tool-input-available',
			toolCallId: 'proposal',
			toolName: 'propose_inventory',
			input: {}
		});
		stream.emit({
			type: 'tool-output-available',
			toolCallId: 'proposal',
			output: { action_card: { executionId: 'never-execute' } }
		});
		stream.emit({
			type: 'tool-input-start',
			toolCallId: 'unfinished',
			toolName: 'propose_inventory'
		});
		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Retained Colombia' })).toBeVisible()
		);
		expect(screen.getByRole('button', { name: 'Stop response' })).toBeInTheDocument();
		await new Promise((resolve) => setTimeout(resolve, 600));
		expect(endpoints.saved).toHaveLength(0);
		expect(canvasStore.blocks).toHaveLength(0);
		window.dispatchEvent(new Event('beforeunload'));
		expect(sendBeacon.mock.calls.filter(([url]) => String(url).endsWith('/messages'))).toHaveLength(
			0
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
		await waitFor(() => expect(screen.getByText(/Response stopped\./)).toBeInTheDocument());
		await waitFor(() => expect(endpoints.saved).toHaveLength(1), { timeout: 2000 });
		const saved = endpoints.saved[0];
		expect(saved).toHaveLength(2);
		expect(saved[1].client_message_id).toBe('stopped-assistant');
		expect(saved[1].parts.map((part) => part.type)).toEqual([
			'tool-coffee_catalog_search',
			'data-cherry-turn-status'
		]);
		expect(saved[1].canvas_mutations).toEqual([]);
		expect(JSON.stringify(saved)).not.toContain('never-execute');
		expect(canvasStore.blocks).toHaveLength(0);
		mounted.unmount();
		mountWorkspace(restoreRows(saved));
		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Retained Colombia' })).toBeVisible()
		);
		expect(screen.getByText(/Response stopped\./)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Open evidence' })).not.toBeInTheDocument();
		expect(canvasStore.blocks).toHaveLength(0);
	});

	it('retains evidence on disconnect and retry appends identities without changing saved history', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const first = gatedResponse();
		const retry = gatedResponse();
		const endpoints = installEndpoints([first, retry]);
		mountWorkspace();
		await send(first, 'failed-assistant');
		emitCoffee(first);
		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Retained Colombia' })).toBeVisible()
		);
		first.fail();
		await waitFor(() => expect(screen.getByText(/Response interrupted\./)).toBeInTheDocument());
		expect(screen.getByRole('textbox')).toHaveValue('Find a washed coffee');
		await waitFor(() => expect(endpoints.saved).toHaveLength(1), { timeout: 2000 });
		const firstSave = JSON.stringify(endpoints.saved[0]);
		await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		await waitFor(() => expect(endpoints.requests).toHaveLength(2));
		expect(endpoints.requests[1].messages).toHaveLength(3);
		expect(endpoints.requests[1].messages[2].id).not.toBe(endpoints.saved[0][0].client_message_id);
		expect(JSON.stringify(endpoints.requests[1])).not.toContain('data-cherry-turn-status');
		retry.emit({ type: 'start', messageId: 'retry-assistant' });
		retry.emit({ type: 'text-start', id: 'answer' });
		retry.emit({ type: 'text-delta', id: 'answer', delta: 'The completed follow-up.' });
		retry.emit({ type: 'text-end', id: 'answer' });
		retry.finish();
		await waitFor(() => expect(endpoints.saved).toHaveLength(2), { timeout: 2000 });
		expect(endpoints.saved[1]).toHaveLength(2);
		expect(endpoints.saved[1][1].client_message_id).toBe('retry-assistant');
		expect(JSON.stringify(endpoints.saved[0])).toBe(firstSave);
		expect(new Set(endpoints.saved.flat().map((message) => message.client_message_id)).size).toBe(
			4
		);
		expect(screen.getByRole('heading', { name: 'Retained Colombia' })).toBeVisible();
	});

	it('active unload saves only the unsaved finalized prefix, never the mutable new attempt', async () => {
		const complete = gatedResponse();
		const active = gatedResponse();
		const endpoints = installEndpoints([complete, active]);
		mountWorkspace();
		await send(complete, 'finalized-assistant', 'Explain washed coffee');
		complete.emit({ type: 'text-start', id: 'answer' });
		complete.emit({ type: 'text-delta', id: 'answer', delta: 'An earlier complete answer.' });
		complete.emit({ type: 'text-end', id: 'answer' });
		complete.finish();
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument()
		);
		await send(active, 'mutable-assistant');
		emitCoffee(active);
		await waitFor(() =>
			expect(screen.getByRole('heading', { name: 'Retained Colombia' })).toBeVisible()
		);
		window.dispatchEvent(new Event('beforeunload'));
		const messageBeacons = sendBeacon.mock.calls.filter(([url]) =>
			String(url).endsWith('/messages')
		);
		expect(messageBeacons).toHaveLength(1);
		const beacon = JSON.parse(await (messageBeacons[0][1] as Blob).text());
		expect(beacon.messages).toHaveLength(2);
		expect(beacon.messages[1].client_message_id).toBe('finalized-assistant');
		expect(JSON.stringify(beacon)).not.toContain('mutable-assistant');
		expect(JSON.stringify(beacon)).not.toContain('Retained Colombia');
		await new Promise((resolve) => setTimeout(resolve, 600));
		expect(endpoints.saved).toHaveLength(0);
		await fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
		await waitFor(() => expect(screen.getByText(/Response stopped\./)).toBeInTheDocument());
	});
});
