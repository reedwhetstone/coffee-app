import { describe, it, expect } from 'vitest';
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
