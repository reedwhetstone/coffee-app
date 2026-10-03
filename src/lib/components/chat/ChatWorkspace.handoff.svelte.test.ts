import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIMessageChunk } from 'ai';
import ChatWorkspace from './ChatWorkspace.svelte';
import { getInterruptedTurnStatus } from './chatRecovery';
import { pageChatContext } from '$lib/stores/pageContextStore.svelte';
import { canvasStore } from '$lib/stores/canvasStore.svelte';
import type { Workspace } from '$lib/stores/workspaceStore.svelte';
import type { PersistedChatMessagePayload } from '$lib/services/chatPersistence';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/state', () => ({ page: { url: new URL('https://example.test/chat') } }));
vi.mock('$lib/components/canvas/Canvas.svelte', () => ({ default: vi.fn() }));

const PENDING_CANVAS_SAVES_KEY = 'coffee-chat-pending-canvas-saves-v1';
const OTHER_ACCOUNT_WORKSPACE = 'other-account-workspace';

const workspace: Workspace = {
	id: 'session-workspace',
	title: 'Coffee',
	type: 'general',
	context_summary: '',
	canvas_state: {},
	last_accessed_at: '2026-10-03T16:00:00Z',
	created_at: '2026-10-03T16:00:00Z',
	reset_epoch: 0,
	canvas_version: 0
};

function gatedResponse() {
	let controller!: ReadableStreamDefaultController<Uint8Array>;
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(value) {
			controller = value;
		}
	});
	return {
		response: () =>
			new Response(body, {
				headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' }
			}),
		emit(chunk: UIMessageChunk) {
			controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
		},
		finish() {
			controller.enqueue(encoder.encode('data: {"type":"finish"}\n\ndata: [DONE]\n\n'));
			controller.close();
		}
	};
}

function installEndpoints(stream: ReturnType<typeof gatedResponse>) {
	const saved: PersistedChatMessagePayload[][] = [];
	const workspaceRequests: string[] = [];
	let canvasVersion = 0;
	vi.stubGlobal(
		'fetch',
		vi.fn<typeof fetch>(async (input, init) => {
			const url = String(input);
			if (url.startsWith('/api/workspaces')) workspaceRequests.push(url);
			if (url === '/api/chat') return stream.response();
			if (url === '/api/memory') return Response.json({ content: '' });
			if (url === '/api/workspaces') return Response.json({ workspaces: [{ ...workspace }] });
			if (url === `/api/workspaces/${workspace.id}`) {
				return Response.json({ workspace: { ...workspace }, messages: [] });
			}
			if (url === `/api/workspaces/${workspace.id}/messages`) {
				saved.push(JSON.parse(String(init?.body)).messages);
				return Response.json({ reset_epoch: 0, next_message_sequence: saved.flat().length + 1 });
			}
			if (url === `/api/workspaces/${workspace.id}/canvas`) {
				return Response.json({
					canvas_state: JSON.parse(String(init?.body)).canvas_state,
					canvas_version: ++canvasVersion,
					reset_epoch: 0
				});
			}
			// The other account's workspace does not exist for this session.
			if (url === `/api/workspaces/${OTHER_ACCOUNT_WORKSPACE}/canvas`) {
				return Response.json({ error: 'Workspace not found.' }, { status: 404 });
			}
			throw new Error(`Unexpected endpoint: ${url}`);
		})
	);
	return { saved, workspaceRequests };
}

beforeEach(() => {
	localStorage.clear();
	canvasStore.resetAll();
	Element.prototype.scrollIntoView = vi.fn();
	Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: vi.fn(() => true) });
});
afterEach(() => {
	cleanup();
	pageChatContext.clear();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	localStorage.clear();
});

describe('ChatWorkspace pop-out to full workspace', () => {
	it('keeps a finished reply intact when a stale canvas save and one lookup step fail', async () => {
		// A canvas save queued under a different account is still in browser storage.
		localStorage.setItem(
			PENDING_CANVAS_SAVES_KEY,
			JSON.stringify([{ workspaceId: OTHER_ACCOUNT_WORKSPACE, body: '{"canvas_state":{}}' }])
		);
		const stream = gatedResponse();
		const endpoints = installEndpoints(stream);
		const canvasRequestsForOtherAccount = () =>
			endpoints.workspaceRequests.filter((url) => url.includes(OTHER_ACCOUNT_WORKSPACE));

		// The conversation starts in the pop-out chat.
		const popOut = render(ChatWorkspace, {
			canUseChat: true,
			canUseMallardWorkspaces: true,
			agentName: 'Cherry Synthesis Agent',
			variant: 'drawer',
			ownerId: 'user-2'
		});
		await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
		expect(canvasRequestsForOtherAccount()).toHaveLength(1);
		expect(localStorage.getItem(PENDING_CANVAS_SAVES_KEY)).toBeNull();

		// "Open full workspace" replaces the pop-out with the /chat page.
		popOut.unmount();
		render(ChatWorkspace, {
			canUseChat: true,
			canUseMallardWorkspaces: true,
			agentName: 'Cherry Synthesis Agent',
			variant: 'page',
			ownerId: 'user-2',
			initialWorkspaceData: {
				workspaces: [{ ...workspace }],
				workspace: { ...workspace },
				messages: []
			}
		});
		await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());

		await fireEvent.input(screen.getByRole('textbox'), {
			target: { value: 'can you make a profile to follow?' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Stop response' })).toBeInTheDocument()
		);
		stream.emit({ type: 'start', messageId: 'profile-answer' });
		stream.emit({ type: 'start-step' });
		stream.emit({
			type: 'tool-input-available',
			toolCallId: 'reference-call',
			toolName: 'reference_profiles',
			input: { profile_id: '00000000-0000-0000-0000-000000000000' }
		});
		// The lookup fails server-side; the model reads the failure and still answers.
		stream.emit({
			type: 'tool-output-error',
			toolCallId: 'reference-call',
			errorText: 'AI response failed'
		});
		stream.emit({ type: 'finish-step' });
		stream.emit({ type: 'start-step' });
		stream.emit({ type: 'text-start', id: 'answer' });
		stream.emit({
			type: 'text-delta',
			id: 'answer',
			delta: 'Yes, but I need a saved Artisan reference profile first.'
		});
		stream.emit({ type: 'text-end', id: 'answer' });
		stream.emit({ type: 'finish-step' });
		stream.finish();

		await waitFor(() =>
			expect(screen.queryByRole('button', { name: 'Stop response' })).not.toBeInTheDocument()
		);
		await waitFor(() => expect(endpoints.saved.flat()).toHaveLength(2));

		// The reply reads as a normal completed answer with a quiet note about the step.
		expect(
			screen.getByText('Yes, but I need a saved Artisan reference profile first.')
		).toBeInTheDocument();
		expect(screen.getByText("The reference profiles step didn't complete.")).toBeInTheDocument();
		expect(document.body).not.toHaveTextContent('AI response failed');
		expect(document.body).not.toHaveTextContent('Response interrupted.');
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Ask again' })).toBeEnabled();

		// It is saved as a completed turn in the signed-in account's workspace.
		const [savedUser, savedAssistant] = endpoints.saved.flat();
		expect(savedUser).toMatchObject({ role: 'user' });
		expect(savedAssistant).toMatchObject({ role: 'assistant' });
		expect(savedAssistant.content).toContain('saved Artisan reference profile');
		expect(getInterruptedTurnStatus(savedAssistant.parts as unknown[])).toBeNull();

		// The other account's workspace was tried once, then never requested again.
		expect(canvasRequestsForOtherAccount()).toHaveLength(1);
		expect(
			endpoints.workspaceRequests.filter(
				(url) => url !== '/api/workspaces' && !url.includes(OTHER_ACCOUNT_WORKSPACE)
			)
		).toSatisfy((urls: string[]) =>
			urls.every((url) => url.startsWith(`/api/workspaces/${workspace.id}`))
		);
	});
});
