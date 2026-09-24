import { describe, expect, it } from 'vitest';
import { buildActionReceipts } from './actionReceipts';
import type { CanvasBlock, UIBlock } from '$lib/types/genui';

function canvasBlock(id: string, messageId: string, block: UIBlock): CanvasBlock {
	return { id, messageId, block, pinned: false, minimized: false, addedAt: 0 };
}

describe('buildActionReceipts', () => {
	it('retains canvas-backed receipts for legacy messages without structured parts', () => {
		const card: UIBlock = {
			type: 'action-card',
			version: 1,
			data: {
				actionType: 'add_bean_to_inventory',
				summary: 'Legacy inventory action',
				fields: [],
				status: 'success'
			}
		};
		const result = buildActionReceipts(
			'legacy-message',
			[],
			[canvasBlock('canvas-1', 'legacy-message', card)]
		);

		expect(result).toEqual([
			expect.objectContaining({
				block: card,
				canvasBlockId: 'canvas-1',
				renderKey: 'canvas-1'
			})
		]);
	});

	it('uses stable unique fallback keys for multiple legacy action parts', () => {
		const part = (summary: string) => ({
			type: 'tool-propose_action',
			state: 'output-available',
			output: {
				action_card: {
					actionType: 'add_bean_to_inventory',
					summary,
					fields: [],
					status: 'success' as const
				}
			}
		});
		const result = buildActionReceipts('legacy-message', [part('First'), part('Second')], []);

		expect(result.map((receipt) => receipt.renderKey)).toEqual([
			'tool-propose_action-0',
			'tool-propose_action-1'
		]);
		expect(result).toHaveLength(2);
	});
});
