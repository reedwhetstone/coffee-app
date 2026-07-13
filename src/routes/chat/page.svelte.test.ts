import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import ChatPage from './+page.svelte';
import type { PageData } from './$types';
import { canvasStore } from '$lib/stores/canvasStore.svelte';

const { goto, pageState, sendMessage, chatState, chatCallbacks } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('https://example.com/chat') },
	sendMessage: vi.fn(),
	chatState: { messages: [] as Array<Record<string, unknown>>, status: 'ready' },
	chatCallbacks: { onError: null as null | ((error: Error) => void) }
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('@ai-sdk/svelte', () => ({
	Chat: vi.fn().mockImplementation((options: { onError?: (error: Error) => void }) => {
		chatCallbacks.onError = options.onError ?? null;
		return {
			messages: chatState.messages,
			status: chatState.status,
			sendMessage,
			stop: vi.fn()
		};
	})
}));
vi.mock('ai', () => ({ DefaultChatTransport: vi.fn() }));
vi.mock('@humanspeak/svelte-markdown', () => ({ default: vi.fn() }));
vi.mock('$lib/components/genui/GenUIBlockRenderer.svelte', () => ({ default: vi.fn() }));
vi.mock('$lib/components/genui/InlineStatusLine.svelte', () => ({ default: vi.fn() }));
vi.mock('$lib/components/canvas/Canvas.svelte', () => ({ default: vi.fn() }));
vi.mock('$lib/components/genui/SuggestionChips.svelte', () => ({ default: vi.fn() }));
vi.mock('$lib/stores/workspaceStore.svelte', async () => {
	const actual = await vi.importActual<typeof import('$lib/stores/workspaceStore.svelte')>(
		'$lib/stores/workspaceStore.svelte'
	);
	actual.workspaceStore.saveCanvasState = vi.fn(async () => true);
	actual.workspaceStore.saveMessages = vi.fn(async () => true);
	return actual;
});

function createData(overrides: Partial<PageData> = {}): PageData {
	return {
		session: { user: { id: 'user-1' } },
		user: { id: 'user-1' },
		role: 'viewer',
		ppiAccess: true,
		...overrides
	} as unknown as PageData;
}

function createInitialWorkspaceData() {
	const now = '2026-07-13T00:00:00.000Z';
	const workspace = {
		id: 'workspace-1',
		title: 'Coffee',
		type: 'general',
		context_summary: '',
		canvas_state: {},
		last_accessed_at: now,
		created_at: now
	};
	const messages = chatState.messages.map((message, index) => ({
		id: String(message.id),
		workspace_id: workspace.id,
		role: message.role,
		content: '',
		parts: message.parts,
		canvas_mutations: [],
		client_message_id: String(message.id ?? `message-${index}`),
		created_at: now
	}));
	return { workspaces: [workspace], workspace, messages };
}

describe('chat analytics seed', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		Object.defineProperty(navigator, 'sendBeacon', {
			configurable: true,
			value: vi.fn(() => true)
		});
		canvasStore.resetAll();
		chatState.messages = [];
		chatState.status = 'ready';
		chatCallbacks.onError = null;
		pageState.url = new URL('https://example.com/chat');
	});

	it('prefills the input from an analytics prompt for users who can use chat', () => {
		pageState.url = new URL(
			'https://example.com/chat?source=analytics&prompt=Review%20Colombia%20market%20signals'
		);

		render(ChatPage, { data: createData() });

		expect(screen.getByRole('textbox')).toHaveValue('Review Colombia market signals');
	});

	it('does not prefill analytics prompts for signed-in users without chat access', () => {
		pageState.url = new URL(
			'https://example.com/chat?source=analytics&prompt=Review%20Colombia%20market%20signals'
		);

		render(ChatPage, { data: createData({ ppiAccess: false }) });

		expect(screen.queryByRole('textbox')).toBeNull();
		expect(
			screen.getByText(/Chat is available with Parchment Intelligence or Mallard Studio/i)
		).toBeTruthy();
	});

	it('keeps new evidence on demand instead of automatically opening the pane', async () => {
		render(ChatPage, { data: createData() });
		canvasStore.dispatch({
			type: 'add',
			messageId: 'assistant-1',
			block: { type: 'coffee-cards', version: 1, data: [] }
		});

		await waitFor(() => {
			expect(screen.getByRole('button', { name: 'Open evidence (1)' })).toBeInTheDocument();
		});
		expect(screen.queryByRole('button', { name: 'Hide evidence (1)' })).not.toBeInTheDocument();
	});

	it('asks an earlier question again without overwriting the composer draft', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({}), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		);
		chatState.messages = [
			{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Compare Ethiopia' }] },
			{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'First answer' }] },
			{ id: 'user-2', role: 'user', parts: [{ type: 'text', text: 'Now compare Kenya' }] },
			{ id: 'assistant-2', role: 'assistant', parts: [{ type: 'text', text: 'Second answer' }] }
		];
		const { unmount } = render(ChatPage, {
			data: createData({ initialWorkspaceData: createInitialWorkspaceData() } as Partial<PageData>)
		});

		const composer = screen.getByRole('textbox');
		await fireEvent.input(composer, { target: { value: 'My unsent follow-up' } });
		const askAgainButtons = screen.getAllByRole('button', { name: 'Ask again' });
		await fireEvent.click(askAgainButtons[0]);

		expect(sendMessage).toHaveBeenCalledWith(
			{ text: 'Compare Ethiopia' },
			expect.objectContaining({ body: expect.any(Object) })
		);
		expect(composer).toHaveValue('My unsent follow-up');
		await new Promise((resolve) => setTimeout(resolve, 550));
		unmount();
	});

	it('retries a failed ask-again request without consuming the composer draft', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({}), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		);
		chatState.messages = [
			{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Compare Ethiopia' }] },
			{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'First answer' }] }
		];
		const { unmount } = render(ChatPage, {
			data: createData({ initialWorkspaceData: createInitialWorkspaceData() } as Partial<PageData>)
		});

		const composer = screen.getByRole('textbox');
		await fireEvent.input(composer, { target: { value: 'My unsent follow-up' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Ask again' }));
		chatCallbacks.onError?.(new Error('Request timed out'));
		await fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

		expect(sendMessage).toHaveBeenLastCalledWith(
			{ text: 'Compare Ethiopia' },
			expect.objectContaining({ body: expect.any(Object) })
		);
		expect(composer).toHaveValue('My unsent follow-up');
		await new Promise((resolve) => setTimeout(resolve, 550));
		unmount();
	});

	it('keeps an empty composer empty when a failed ask-again request is retried', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(
				new Response(JSON.stringify({}), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			)
		);
		chatState.messages = [
			{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Compare Ethiopia' }] },
			{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'First answer' }] }
		];
		const { unmount } = render(ChatPage, {
			data: createData({ initialWorkspaceData: createInitialWorkspaceData() } as Partial<PageData>)
		});

		const composer = screen.getByRole('textbox');
		expect(composer).toHaveValue('');
		await fireEvent.click(screen.getByRole('button', { name: 'Ask again' }));
		chatCallbacks.onError?.(new Error('Request timed out'));
		expect(composer).toHaveValue('');
		await fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

		expect(sendMessage).toHaveBeenCalledTimes(2);
		expect(sendMessage).toHaveBeenLastCalledWith(
			{ text: 'Compare Ethiopia' },
			expect.objectContaining({ body: expect.any(Object) })
		);
		expect(composer).toHaveValue('');
		await new Promise((resolve) => setTimeout(resolve, 550));
		unmount();
	});
});
