import type { Workspace } from '$lib/stores/workspaceStore.svelte';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
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
				if (url === '/api/reference-profiles' && init?.method === 'POST') {
					return Response.json(
						{ data: { id: 'saved-artisan-reference', title: 'Artisan chat reference' } },
						{ status: 201 }
					);
				}
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
			canUseMallardWorkspaces: true,
			agentName: 'Cherry Green Agent',
			variant: 'drawer',
			initialWorkspaceData: {
				workspaces: [{ ...workspace }],
				workspace: { ...workspace },
				messages: []
			}
		});

		await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
		await fireEvent.change(screen.getByLabelText('Attach Artisan reference file'), {
			target: {
				files: [new File(['artisan data'], 'private-session.alog', { type: 'text/plain' })]
			}
		});
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Remove attached reference' })).toBeVisible()
		);
		await fireEvent.input(screen.getByRole('textbox'), {
			target: { value: 'Add this coffee to inventory' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
		await waitFor(() => expect(chatRequests).toHaveLength(1));
		expect(JSON.stringify(chatRequests[0])).toContain('saved-artisan-reference');
		expect(JSON.stringify(chatRequests[0])).not.toContain('private-session.alog');
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

		await fireEvent.click(await screen.findByRole('button', { name: /Canvas 1/ }));
		blockCanvasSave = true;
		await fireEvent.click(await screen.findByRole('button', { name: 'Execute' }));
		await waitFor(() => expect(actionRequests).toHaveLength(1));
		await waitFor(() => expect(chatRequests).toHaveLength(2));
		expect(screen.getByText('Continuing after completed action')).toBeInTheDocument();
		expect(chatRequests[1].completedAction).toEqual({
			executionId: 'proposal-assistant:proposal'
		});
		expect(JSON.stringify(chatRequests[1])).not.toContain('private-session.alog');
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
		expect(screen.getByRole('button', { name: /Add bean Completed/ })).toBeVisible();
		expect(actionRequests).toHaveLength(1);
		releaseCanvasSave();
		// Let the component's debounced message and canvas persistence settle while
		// the endpoint stub is still installed.
		await new Promise((resolve) => setTimeout(resolve, 900));
	});

	it('retains a second committed action through a failed continuation and retry', async () => {
		const firstContinuation = gatedResponse();
		const retryContinuation = gatedResponse();
		const secondContinuation = gatedResponse();
		const chatRequests: Array<{ completedAction?: { executionId: string } }> = [];
		const actionRequests: Array<{ executionId: string }> = [];
		let canvasVersion = 0;
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>(async (input, init) => {
				const url = String(input);
				if (url === '/api/chat') {
					chatRequests.push(JSON.parse(String(init?.body)));
					const stream = [firstContinuation, retryContinuation, secondContinuation][
						chatRequests.length - 1
					];
					if (!stream) throw new Error('Unexpected chat request');
					return stream.response(init?.signal);
				}
				if (url === '/api/chat/execute-action') {
					const request = JSON.parse(String(init?.body));
					actionRequests.push(request);
					return Response.json({ success: true, id: actionRequests.length });
				}
				if (url === '/api/memory') return Response.json({ content: '' });
				if (url.endsWith('/messages'))
					return Response.json({ reset_epoch: 0, next_message_sequence: 2 });
				if (url.endsWith('/canvas')) {
					const payload = JSON.parse(String(init?.body));
					return Response.json({
						canvas_state: payload.canvas_state,
						canvas_version: ++canvasVersion,
						reset_epoch: 0
					});
				}
				throw new Error(`Unexpected endpoint: ${url}`);
			})
		);

		const blocks = ['first', 'second'].map((name) => ({
			id: `saved-${name}`,
			messageId: 'proposal-assistant',
			title: `Record ${name}`,
			pinned: false,
			minimized: false,
			addedAt: 0,
			block: {
				type: 'action-card' as const,
				version: 1 as const,
				data: {
					executionId: `proposal-assistant:${name}`,
					actionType: 'record_sale' as const,
					summary: `Record ${name}`,
					fields: [],
					status: 'proposed' as const
				}
			}
		}));
		const savedWorkspace: Workspace = {
			...workspace,
			canvas_state: { blocks, layout: 'focus', focusBlockId: null }
		};
		render(ChatWorkspace, {
			canUseChat: true,
			canUseMallardWorkspaces: true,
			agentName: 'Cherry Green Agent',
			variant: 'drawer',
			initialWorkspaceData: {
				workspaces: [savedWorkspace],
				workspace: savedWorkspace,
				messages: []
			}
		});

		await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
		await fireEvent.click(screen.getByRole('button', { name: /Canvas 2/ }));
		const shelf = screen.getByRole('navigation', { name: 'Canvas items' });
		await fireEvent.click(within(shelf).getByRole('button', { name: 'Record first' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Execute' }));
		await waitFor(() => expect(chatRequests).toHaveLength(1));
		expect(chatRequests[0].completedAction?.executionId).toBe('proposal-assistant:first');

		await fireEvent.click(within(shelf).getByRole('button', { name: 'Record second' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Execute' }));
		await waitFor(() => expect(actionRequests).toHaveLength(2));
		expect(chatRequests).toHaveLength(1);

		firstContinuation.fail();
		await fireEvent.click(screen.getByRole('button', { name: '← Back to answer' }));
		await waitFor(() =>
			expect(
				screen.getByText(/Action completed, but Cherry Green Agent couldn't continue/)
			).toBeVisible()
		);
		expect(chatRequests).toHaveLength(1);
		await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
		await waitFor(() => expect(chatRequests).toHaveLength(2));
		expect(chatRequests[1].completedAction?.executionId).toBe('proposal-assistant:first');
		retryContinuation.emit({ type: 'start', messageId: 'first-answer' });
		retryContinuation.emit({ type: 'text-start', id: 'first-text' });
		retryContinuation.emit({ type: 'text-delta', id: 'first-text', delta: 'First complete.' });
		retryContinuation.emit({ type: 'text-end', id: 'first-text' });
		retryContinuation.finish();
		await waitFor(() => expect(chatRequests).toHaveLength(3));
		expect(chatRequests[2].completedAction?.executionId).toBe('proposal-assistant:second');
		expect(actionRequests.map((request) => request.executionId)).toEqual([
			'proposal-assistant:first',
			'proposal-assistant:second'
		]);

		secondContinuation.emit({ type: 'start', messageId: 'second-answer' });
		secondContinuation.emit({ type: 'text-start', id: 'second-text' });
		secondContinuation.emit({ type: 'text-delta', id: 'second-text', delta: 'Second complete.' });
		secondContinuation.emit({ type: 'text-end', id: 'second-text' });
		secondContinuation.finish();
		await new Promise((resolve) => setTimeout(resolve, 900));
		await waitFor(() => expect(screen.getByText('Second complete.')).toBeVisible());
	});
	it('unlocks the next plan step without a model turn, then continues after the last step', async () => {
		const proposal = gatedResponse();
		const continuation = gatedResponse();
		const chatRequests: Array<{ completedAction?: { executionId: string } }> = [];
		const actionRequests: Array<{ executionId: string; fields: Record<string, unknown> }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>(async (input, init) => {
				const url = String(input);
				if (url === '/api/chat') {
					chatRequests.push(JSON.parse(String(init?.body)));
					const stream = [proposal, continuation][chatRequests.length - 1];
					if (!stream) throw new Error('Unexpected chat request');
					return stream.response(init?.signal);
				}
				if (url === '/api/chat/execute-action') {
					const body = JSON.parse(String(init?.body));
					actionRequests.push(body);
					return Response.json(
						actionRequests.length === 1
							? { success: true, id: 4498, message: 'Roast session created', replayed: false }
							: { success: true, id: 77, message: 'Sale recorded', replayed: false }
					);
				}
				if (url === '/api/memory') return Response.json({ content: '' });
				if (url.endsWith('/messages')) {
					return Response.json({ reset_epoch: 0, next_message_sequence: 2 });
				}
				if (url.endsWith('/canvas')) {
					const payload = JSON.parse(String(init?.body));
					return Response.json({
						canvas_state: payload.canvas_state,
						canvas_version: 1,
						reset_epoch: 0
					});
				}
				throw new Error(`Unexpected endpoint: ${url}`);
			})
		);

		render(ChatWorkspace, {
			canUseChat: true,
			canUseMallardWorkspaces: true,
			agentName: 'Cherry Roast Agent',
			variant: 'drawer',
			initialWorkspaceData: {
				workspaces: [{ ...workspace }],
				workspace: { ...workspace },
				messages: []
			}
		});

		await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
		await fireEvent.input(screen.getByRole('textbox'), {
			target: { value: 'Log this roast, then sell 20 oz of it' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
		await waitFor(() => expect(chatRequests).toHaveLength(1));
		proposal.emit({ type: 'start', messageId: 'plan-assistant' });
		proposal.emit({
			type: 'tool-input-available',
			toolCallId: 'plan',
			toolName: 'propose_action_plan',
			input: {}
		});
		proposal.emit({
			type: 'tool-output-available',
			toolCallId: 'plan',
			output: {
				action_plan: {
					planId: 'plan-1',
					summary: 'Roast, then sell',
					steps: [
						{
							actionType: 'create_roast_session',
							summary: 'Log sample roast',
							status: 'proposed',
							fields: [
								{
									key: 'coffee_id',
									label: 'Coffee ID',
									value: 812,
									type: 'number',
									editable: false
								},
								{
									key: 'batch_name',
									label: 'Batch Name',
									value: 'Sample',
									type: 'text',
									editable: true
								}
							],
							plan: { step: 1, bindings: [], required: [] }
						},
						{
							actionType: 'record_sale',
							summary: 'Record 20 oz sale',
							status: 'waiting',
							fields: [
								{
									key: 'green_coffee_inv_id',
									label: 'Inventory ID',
									value: '',
									type: 'number',
									editable: false
								},
								{
									key: 'batch_name',
									label: 'Batch Name',
									value: '',
									type: 'text',
									editable: false
								},
								{
									key: 'buyer',
									label: 'Buyer',
									value: '',
									type: 'text',
									editable: true,
									required: true
								}
							],
							plan: {
								step: 2,
								bindings: [
									{ field: 'green_coffee_inv_id', fromStep: 1, from: 'coffee_id' },
									{ field: 'batch_name', fromStep: 1, from: 'batch_name' }
								],
								required: ['buyer']
							}
						}
					]
				}
			}
		});
		proposal.finish();

		await fireEvent.click(await screen.findByRole('button', { name: /Canvas 2/ }));
		const canvas = await screen.findByRole('dialog', { name: 'Canvas' });
		await fireEvent.click(within(canvas).getByRole('button', { name: /Log sample roast/ }));
		await fireEvent.click(await within(canvas).findByRole('button', { name: 'Execute' }));
		await waitFor(() => expect(actionRequests).toHaveLength(1));
		expect(actionRequests[0].executionId).toBe('plan-assistant:plan:step-1');

		await fireEvent.click(within(canvas).getByRole('button', { name: /Record 20 oz sale/ }));
		const buyer = await within(canvas).findByLabelText('Buyer');
		expect(chatRequests).toHaveLength(1);
		await fireEvent.input(buyer, { target: { value: 'Corner Cafe' } });
		await fireEvent.click(within(canvas).getByRole('button', { name: 'Execute' }));
		await waitFor(() => expect(actionRequests).toHaveLength(2));
		expect(actionRequests[1]).toMatchObject({
			executionId: 'plan-assistant:plan:step-2',
			fields: { green_coffee_inv_id: 812, batch_name: 'Sample', buyer: 'Corner Cafe' }
		});
		await waitFor(() => expect(chatRequests).toHaveLength(2));
		expect(chatRequests[1].completedAction).toEqual({
			executionId: 'plan-assistant:plan:step-2'
		});
		continuation.finish();
	});

	function saleSteps(saleBindingFrom: string) {
		return [
			{
				executionId: 'plan-assistant:plan:step-1',
				actionType: 'create_roast_session' as const,
				summary: 'Log sample roast',
				status: 'proposed' as const,
				fields: [
					{
						key: 'batch_name',
						label: 'Batch Name',
						value: 'Sample',
						type: 'text' as const,
						editable: true
					}
				],
				plan: { step: 1, bindings: [], required: [] }
			},
			{
				executionId: 'plan-assistant:plan:step-2',
				actionType: 'record_sale' as const,
				summary: 'Record 20 oz sale',
				status: 'waiting' as const,
				fields: [
					{ key: 'roast_ref', label: 'Roast', value: '', type: 'text' as const, editable: false },
					{
						key: 'buyer',
						label: 'Buyer',
						value: '',
						type: 'text' as const,
						editable: true,
						required: true
					}
				],
				plan: {
					step: 2,
					bindings: [{ field: 'roast_ref', fromStep: 1, from: saleBindingFrom }],
					required: ['buyer']
				}
			}
		];
	}

	function stubPlanFetch(
		chatStreams: Array<ReturnType<typeof gatedResponse>>,
		actionResult: Record<string, unknown>
	) {
		const chatRequests: Array<{
			completedAction?: { executionId: string };
			messages?: Array<{ parts: Array<{ output?: unknown }> }>;
		}> = [];
		const actionRequests: Array<{ executionId: string; fields: Record<string, unknown> }> = [];
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>(async (input, init) => {
				const url = String(input);
				if (url === '/api/chat') {
					chatRequests.push(JSON.parse(String(init?.body)));
					const stream = chatStreams[chatRequests.length - 1];
					if (!stream) throw new Error('Unexpected chat request');
					return stream.response(init?.signal);
				}
				if (url === '/api/chat/execute-action') {
					actionRequests.push(JSON.parse(String(init?.body)));
					return Response.json(actionResult);
				}
				if (url === '/api/memory') return Response.json({ content: '' });
				if (url.endsWith('/messages'))
					return Response.json({ reset_epoch: 0, next_message_sequence: 2 });
				if (url.endsWith('/canvas')) {
					const payload = JSON.parse(String(init?.body));
					return Response.json({
						canvas_state: payload.canvas_state,
						canvas_version: 1,
						reset_epoch: 0
					});
				}
				throw new Error(`Unexpected endpoint: ${url}`);
			})
		);
		return { chatRequests, actionRequests };
	}

	it('falls back to the continuation when a completed step leaves no step to run', async () => {
		const proposal = gatedResponse();
		const continuation = gatedResponse();
		// The write succeeds without returning an ID, so the result_id binding cannot resolve.
		const { chatRequests, actionRequests } = stubPlanFetch([proposal, continuation], {
			success: true,
			message: 'Roast session created'
		});
		render(ChatWorkspace, {
			canUseChat: true,
			canUseMallardWorkspaces: true,
			agentName: 'Cherry Roast Agent',
			variant: 'drawer',
			initialWorkspaceData: {
				workspaces: [{ ...workspace }],
				workspace: { ...workspace },
				messages: []
			}
		});

		await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
		await fireEvent.input(screen.getByRole('textbox'), { target: { value: 'Roast, then sell' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
		await waitFor(() => expect(chatRequests).toHaveLength(1));
		proposal.emit({ type: 'start', messageId: 'plan-assistant' });
		proposal.emit({
			type: 'tool-input-available',
			toolCallId: 'plan',
			toolName: 'propose_action_plan',
			input: {}
		});
		proposal.emit({
			type: 'tool-output-available',
			toolCallId: 'plan',
			output: { action_plan: { planId: 'plan-1', steps: saleSteps('result_id') } }
		});
		proposal.finish();

		await fireEvent.click(await screen.findByRole('button', { name: /Canvas 2/ }));
		const canvas = await screen.findByRole('dialog', { name: 'Canvas' });
		await fireEvent.click(within(canvas).getByRole('button', { name: /Log sample roast/ }));
		await fireEvent.click(await within(canvas).findByRole('button', { name: 'Execute' }));
		await waitFor(() => expect(actionRequests).toHaveLength(1));
		await waitFor(() => expect(chatRequests).toHaveLength(2));
		expect(chatRequests[1].completedAction).toEqual({
			executionId: 'plan-assistant:plan:step-1'
		});
		continuation.finish();
	});

	it('replays intermediate plan completions from the saved canvas after reload', async () => {
		const continuation = gatedResponse();
		const { chatRequests, actionRequests } = stubPlanFetch([continuation], {
			success: true,
			id: 77
		});
		const steps = saleSteps('batch_name');
		// Step 1 committed before the reload: only the canvas save recorded it, and
		// the unlock of step 2 was not saved.
		const savedSteps = [
			{
				...steps[0],
				status: 'success' as const,
				result: { success: true, id: 4498 },
				fields: [{ ...steps[0].fields[0], value: 'Renamed Sample' }]
			},
			steps[1]
		];
		const blocks = savedSteps.map((data, index) => ({
			id: `saved-step-${index + 1}`,
			messageId: 'plan-assistant',
			title: data.summary,
			pinned: false,
			minimized: false,
			addedAt: 0,
			block: {
				type: 'action-card' as const,
				version: 1 as const,
				data: { ...data, plan: { ...data.plan, planId: 'plan-1' } }
			}
		}));
		const savedWorkspace: Workspace = {
			...workspace,
			canvas_state: { blocks, layout: 'focus', focusBlockId: null }
		};
		render(ChatWorkspace, {
			canUseChat: true,
			canUseMallardWorkspaces: true,
			agentName: 'Cherry Roast Agent',
			variant: 'drawer',
			initialWorkspaceData: {
				workspaces: [savedWorkspace],
				workspace: savedWorkspace,
				messages: [
					{
						id: 'row-1',
						client_message_id: 'plan-assistant',
						workspace_id: workspace.id,
						role: 'assistant',
						content: '',
						parts: [
							{
								type: 'tool-propose_action_plan',
								toolCallId: 'plan',
								input: {},
								state: 'output-available',
								output: { action_plan: { planId: 'plan-1', steps } }
							}
						],
						canvas_mutations: [],
						created_at: '2026-09-22T15:00:00Z'
					}
				] as never
			}
		});

		await waitFor(() => expect(screen.getByRole('textbox')).toBeEnabled());
		await fireEvent.click(screen.getByRole('button', { name: /Canvas 2/ }));
		const shelf = screen.getByRole('navigation', { name: 'Canvas items' });
		await fireEvent.click(within(shelf).getByRole('button', { name: 'Record 20 oz sale' }));
		await fireEvent.input(await screen.findByLabelText('Buyer'), {
			target: { value: 'Corner Cafe' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Execute' }));
		await waitFor(() => expect(actionRequests).toHaveLength(1));
		expect(actionRequests[0]).toMatchObject({
			executionId: 'plan-assistant:plan:step-2',
			fields: { roast_ref: 'Renamed Sample', buyer: 'Corner Cafe' }
		});
		await waitFor(() => expect(chatRequests).toHaveLength(1));
		const replayed = chatRequests[0].messages
			?.flatMap((message) => message.parts)
			.find((part) => (part.output as { action_plan?: unknown } | undefined)?.action_plan)
			?.output as { action_plan: { steps: Array<Record<string, unknown>> } };
		expect(replayed.action_plan.steps[0]).toMatchObject({
			status: 'success',
			result: { success: true, id: 4498 },
			fields: [{ key: 'batch_name', value: 'Renamed Sample' }]
		});
		expect(replayed.action_plan.steps[1]).toMatchObject({ status: 'success' });
		continuation.finish();
	});
});
