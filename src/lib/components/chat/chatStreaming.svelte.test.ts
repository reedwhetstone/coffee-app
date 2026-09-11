import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIMessageChunk } from 'ai';
import ChatStreamingHarness from './__test-fixtures__/ChatStreamingHarness.svelte';
import { canvasStore } from '$lib/stores/canvasStore.svelte';

// No Chat/transport/status-component mocks: frames pass through the installed
// AI SDK parser and Svelte reactivity before reaching the real message list.
function controlledResponse() {
	let controller!: ReadableStreamDefaultController<Uint8Array>;
	let release!: (response: Response) => void;
	let signal: AbortSignal | null | undefined;
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		start(value) {
			controller = value;
		}
	});
	const response = new Promise<Response>((resolve) => (release = resolve));
	const transportFetch = vi.fn<typeof fetch>(async (_input, init) => {
		signal = init?.signal;
		signal?.addEventListener('abort', () =>
			controller.error(new DOMException('Aborted', 'AbortError'))
		);
		return response;
	});
	return {
		transportFetch,
		get signal() {
			return signal;
		},
		open() {
			release(
				new Response(body, {
					headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' }
				})
			);
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

async function submit(stream: ReturnType<typeof controlledResponse>) {
	render(ChatStreamingHarness, { transportFetch: stream.transportFetch });
	await fireEvent.click(screen.getByRole('button', { name: 'Send' }));
	await waitFor(() => expect(stream.transportFetch).toHaveBeenCalledOnce());
	expect(screen.getByTestId('chat-status')).toHaveTextContent('submitted');
	expect(screen.getAllByRole('status', { name: 'Cherry AI is working' })).toHaveLength(1);
	stream.open();
	stream.emit({ type: 'start', messageId: 'assistant-live' });
	stream.emit({ type: 'start-step' });
}

describe('Cherry AI incremental activity', () => {
	beforeEach(() => canvasStore.resetAll());
	afterEach(cleanup);

	it('keeps activity through empty assistant, live tools, and answer text before releasing completion', async () => {
		const stream = controlledResponse();
		await submit(stream);
		stream.emit({ type: 'text-start', id: 'intro' });
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('streaming'));
		expect(screen.getAllByRole('status', { name: 'Cherry AI is working' })).toHaveLength(1);
		expect(screen.getByText('Response in progress…')).toBeVisible();
		stream.emit({ type: 'text-end', id: 'intro' });
		stream.emit({
			type: 'tool-input-start',
			toolCallId: 'search',
			toolName: 'coffee_catalog_search'
		});
		await waitFor(() =>
			expect(screen.getByText('Querying coffee catalog search...')).toBeVisible()
		);
		stream.emit({
			type: 'tool-input-available',
			toolCallId: 'search',
			toolName: 'coffee_catalog_search',
			input: {}
		});
		stream.emit({ type: 'tool-output-available', toolCallId: 'search', output: { coffees: [] } });
		await waitFor(() =>
			expect(screen.getByText('coffee catalog search — 0 coffees')).toBeVisible()
		);
		stream.emit({ type: 'finish-step' });
		stream.emit({ type: 'start-step' });
		stream.emit({ type: 'text-start', id: 'answer' });
		stream.emit({ type: 'text-delta', id: 'answer', delta: 'No matching stocked coffees.' });
		await waitFor(() => expect(screen.getByText('No matching stocked coffees.')).toBeVisible());
		// The terminal frame is still withheld, not a prebuilt response consumed at once.
		expect(screen.getByTestId('chat-status')).toHaveTextContent('streaming');
		expect(screen.getAllByRole('status', { name: 'Cherry AI is working' })).toHaveLength(1);
		stream.emit({ type: 'text-end', id: 'answer' });
		stream.emit({ type: 'finish-step' });
		stream.finish();
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('ready'));
		expect(screen.queryByRole('status', { name: 'Cherry AI is working' })).not.toBeInTheDocument();
		expect(screen.getAllByRole('status', { name: 'Cherry AI activity' })).toHaveLength(1);
	});

	it('shows progress without intermediary cards, then only curated cards at completion', async () => {
		const stream = controlledResponse();
		await submit(stream);
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
					{ id: 1, name: 'Washed Guji', country: 'Ethiopia' },
					{ id: 2, name: 'Natural Sidama', country: 'Ethiopia' }
				]
			}
		});
		await waitFor(() => expect(screen.getByText(/coffee catalog search.*2 coffees/)).toBeVisible());
		expect(screen.getByTestId('chat-status')).toHaveTextContent('streaming');
		expect(screen.queryByRole('button', { name: /View details for/ })).not.toBeInTheDocument();
		stream.emit({ type: 'tool-input-start', toolCallId: 'present', toolName: 'present_results' });
		await waitFor(() => expect(screen.getByText('Preparing results…')).toBeVisible());
		expect(screen.queryByRole('button', { name: /View details for/ })).not.toBeInTheDocument();
		stream.emit({
			type: 'tool-input-available',
			toolCallId: 'present',
			toolName: 'present_results',
			input: {}
		});
		stream.emit({
			type: 'tool-output-available',
			toolCallId: 'present',
			output: {
				presentation: {
					source_tool: 'coffee_catalog_search',
					items: [{ id: 2, annotation: 'Best fit for the request' }]
				}
			}
		});
		await waitFor(() =>
			expect(screen.getByText('presenting 1 item to the evidence workspace')).toBeVisible()
		);
		expect(screen.queryByRole('button', { name: /View details for/ })).not.toBeInTheDocument();
		stream.finish();
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('ready'));
		expect(
			screen.queryByRole('button', { name: 'View details for Washed Guji' })
		).not.toBeInTheDocument();
		expect(screen.getByText('Best fit for the request')).toBeVisible();
		expect(screen.getAllByRole('button', { name: 'View details for Natural Sidama' })).toHaveLength(
			1
		);
	});

	it('shows result preparation during input streaming and while the tool is running', async () => {
		const stream = controlledResponse();
		await submit(stream);
		stream.emit({ type: 'tool-input-start', toolCallId: 'present', toolName: 'present_results' });
		await waitFor(() => expect(screen.getByText('Preparing results…')).toBeVisible());
		stream.emit({
			type: 'tool-input-available',
			toolCallId: 'present',
			toolName: 'present_results',
			input: {}
		});
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('streaming'));
		expect(screen.getByText('Preparing results…')).toBeVisible();
		stream.emit({
			type: 'tool-output-available',
			toolCallId: 'present',
			output: { presentation: { items: [] } }
		});
		await waitFor(() =>
			expect(screen.getByText('presenting 0 items to the evidence workspace')).toBeVisible()
		);
		expect(screen.queryByText('Preparing results…')).not.toBeInTheDocument();
		stream.finish();
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('ready'));
	});

	it('keeps no-tool responses visibly active without exposing reasoning content', async () => {
		const stream = controlledResponse();
		await submit(stream);
		stream.emit({ type: 'reasoning-start', id: 'reasoning' });
		stream.emit({ type: 'reasoning-delta', id: 'reasoning', delta: 'Private provider content' });
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('streaming'));
		expect(screen.getByRole('status', { name: 'Cherry AI is working' })).toBeVisible();
		expect(screen.queryByText('Private provider content')).not.toBeInTheDocument();
		stream.emit({ type: 'reasoning-end', id: 'reasoning' });
		stream.emit({ type: 'text-start', id: 'answer' });
		stream.emit({ type: 'text-delta', id: 'answer', delta: 'A general coffee explanation.' });
		await waitFor(() => expect(screen.getByText('A general coffee explanation.')).toBeVisible());
		expect(screen.getByRole('status', { name: 'Cherry AI is working' })).toBeVisible();
		stream.emit({ type: 'text-end', id: 'answer' });
		stream.finish();
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('ready'));
		expect(screen.queryByRole('status', { name: 'Cherry AI is working' })).not.toBeInTheDocument();
	});

	it('clears live activity when the user stops a stalled turn', async () => {
		const stream = controlledResponse();
		await submit(stream);
		stream.emit({ type: 'text-start', id: 'answer' });
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('streaming'));
		await fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('ready'));
		expect(stream.signal?.aborted).toBe(true);
		expect(screen.queryByRole('status', { name: 'Cherry AI is working' })).not.toBeInTheDocument();
	});

	it('clears live activity when the response body disconnects', async () => {
		const stream = controlledResponse();
		await submit(stream);
		stream.emit({ type: 'text-start', id: 'answer' });
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('streaming'));
		stream.fail();
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('error'));
		expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
		expect(screen.queryByRole('status', { name: 'Cherry AI is working' })).not.toBeInTheDocument();
	});

	it('clears live activity on a stream error before final answer completion', async () => {
		const stream = controlledResponse();
		await submit(stream);
		stream.emit({ type: 'text-start', id: 'answer' });
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('streaming'));
		stream.emit({ type: 'error', errorText: 'Upstream interrupted' });
		await waitFor(() => expect(screen.getByTestId('chat-status')).toHaveTextContent('error'));
		expect(screen.getByRole('alert')).toHaveTextContent('Upstream interrupted');
		expect(screen.queryByRole('status', { name: 'Cherry AI is working' })).not.toBeInTheDocument();
	});
});
