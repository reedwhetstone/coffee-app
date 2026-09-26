import { encodeCanvasState } from '$lib/services/canvasPersistence';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	requireChatAccess: vi.fn(),
	createClient: vi.fn(),
	updateCanvas: vi.fn()
}));
vi.mock('$lib/server/auth', () => ({ requireChatAccess: mocks.requireChatAccess }));
vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: mocks.createClient,
	ParchmentConfigError: class extends Error {}
}));
vi.mock('$lib/server/parchmentConversation', () => ({
	updateConversationCanvas: mocks.updateCanvas,
	ParchmentConversationError: class extends Error {}
}));

import { PUT } from './+server';

function event(body: string) {
	return {
		params: { id: 'workspace-123' },
		request: new Request('https://app.test/api/workspaces/workspace-123/canvas', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body
		}),
		locals: {}
	} as Parameters<NonNullable<typeof PUT>>[0];
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.requireChatAccess.mockResolvedValue({ user: { id: 'user-123' } });
	mocks.createClient.mockResolvedValue({});
	mocks.updateCanvas.mockResolvedValue({
		canvasState: { blocks: [] },
		canvasVersion: 4,
		resetEpoch: 2
	});
});

describe('/api/workspaces/[id]/canvas', () => {
	it('rejects malformed or unfenced writes', async () => {
		expect((await PUT(event('{bad'))).status).toBe(400);
		expect((await PUT(event(JSON.stringify({ canvas_state: {} })))).status).toBe(400);
		expect(mocks.updateCanvas).not.toHaveBeenCalled();
	});

	it('rejects oversized state before the SDK call', async () => {
		const response = await PUT(
			event(
				JSON.stringify({
					canvas_state: { text: 'x'.repeat(200_001) },
					expected_reset_epoch: 2,
					expected_canvas_version: 3
				})
			)
		);
		expect(response.status).toBe(413);
		expect(mocks.updateCanvas).not.toHaveBeenCalled();
	});

	it('carries reset and canvas versions through the session SDK', async () => {
		const response = await PUT(
			event(
				JSON.stringify({
					canvas_state: { blocks: [] },
					expected_reset_epoch: 2,
					expected_canvas_version: 3
				})
			)
		);
		expect(response.status).toBe(200);
		expect(mocks.updateCanvas).toHaveBeenCalledWith(expect.anything(), 'workspace-123', {
			expectedResetEpoch: 2,
			expectedCanvasVersion: 3,
			canvasState: { blocks: [] }
		});
		await expect(response.json()).resolves.toMatchObject({
			canvas_version: 4,
			reset_epoch: 2
		});
	});
});

it('stores a bounded lossless envelope but returns legacy blocks to the UI', async () => {
	const state = {
		blocks: [{ block: { type: 'action-card', data: { text: 'coffee '.repeat(40000) } } }]
	};
	const encoded = encodeCanvasState(state);
	mocks.updateCanvas.mockResolvedValue({ canvasState: encoded, canvasVersion: 4, resetEpoch: 2 });
	const response = await PUT(
		event(
			JSON.stringify({ canvas_state: encoded, expected_reset_epoch: 2, expected_canvas_version: 3 })
		)
	);
	expect(response.status).toBe(200);
	expect(mocks.updateCanvas).toHaveBeenCalledWith(
		expect.anything(),
		'workspace-123',
		expect.objectContaining({ canvasState: encoded })
	);
	expect((await response.json()).canvas_state).toEqual(state);
});
it('rejects corrupt compressed state before storage', async () => {
	const response = await PUT(
		event(
			JSON.stringify({
				canvas_state: { encoding: 'cherry-canvas-gzip-v1', data: 'broken' },
				expected_reset_epoch: 2,
				expected_canvas_version: 3
			})
		)
	);
	expect(response.status).toBe(400);
	expect(mocks.updateCanvas).not.toHaveBeenCalled();
});
