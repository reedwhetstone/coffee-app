import { env } from '$env/dynamic/private';
vi.mock('$env/dynamic/private', () => ({ env: {} }));
import { describe, it, expect, vi } from 'vitest';
import { legacyWorkspace, type ConversationWorkspace } from './parchmentConversation';
import { encodeCanvasState } from '$lib/services/canvasPersistence';

describe('canvas read compatibility', () => {
	it('returns full pinned evidence without depending on the last 50 messages', () => {
		const canvas = {
			blocks: [
				{
					messageId: 'old-message',
					pinned: true,
					block: {
						type: 'action-card',
						data: {
							fields: ['Coffee '.repeat(40000)],
							status: 'success',
							executionId: 'durable-action',
							result: { id: 42 }
						}
					}
				}
			],
			layout: 'focus',
			focusBlockIndex: 0
		};
		const workspace = { id: 'ws', canvasState: encodeCanvasState(canvas) } as ConversationWorkspace;
		expect(legacyWorkspace(workspace).canvas_state).toEqual(canvas);
	});
	it('does not turn unreadable saved state into an empty canvas', () => {
		expect(() =>
			legacyWorkspace({
				id: 'ws',
				canvasState: { encoding: 'unknown' }
			} as unknown as ConversationWorkspace)
		).toThrow('could not be read');
	});
});

it('advertises compressed writes only after explicit deployment enablement', () => {
	const workspace = { id: 'ws', canvasState: {} } as ConversationWorkspace;
	expect(legacyWorkspace(workspace)).not.toHaveProperty('canvas_compression_enabled');
	env.CHERRY_COMPRESSED_CANVAS_WRITES = 'true';
	try {
		expect(legacyWorkspace(workspace)).toHaveProperty('canvas_compression_enabled', true);
	} finally {
		delete env.CHERRY_COMPRESSED_CANVAS_WRITES;
	}
});
