import { describe, expect, it } from 'vitest';
import { buildActionReceipts } from './actionReceipts';
import type { CanvasBlock, UIBlock } from '$lib/types/genui';

function canvasBlock(id: string, messageId: string, block: UIBlock): CanvasBlock {
	return { id, messageId, block, pinned: false, minimized: false, addedAt: 0 };
}

describe('buildActionReceipts', () => {
	it('uses the retained canvas completion after the proposal turn was already saved', () => {
		const savedProposal = {
			type: 'tool-propose_action',
			toolCallId: 'inventory',
			state: 'output-available',
			output: {
				action_card: {
					executionId: 'proposal:inventory',
					actionType: 'add_bean_to_inventory' as const,
					summary: 'Add bean',
					fields: [],
					status: 'proposed'
				}
			}
		};
		const completed: UIBlock = {
			type: 'action-card',
			version: 1,
			data: { ...savedProposal.output.action_card, status: 'success', result: { id: 42 } }
		};
		const receipts = buildActionReceipts(
			'proposal',
			[savedProposal],
			[canvasBlock('saved-canvas-action', 'proposal', completed)]
		);
		expect(receipts).toHaveLength(1);
		expect(receipts[0].block.data.status).toBe('success');
		expect(receipts[0].canvasBlockId).toBe('saved-canvas-action');
	});

	it('retains canvas-backed receipts for legacy messages without structured parts', () => {
		const card: UIBlock = {
			type: 'action-card',
			version: 1,
			data: {
				actionType: 'add_bean_to_inventory' as const,
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
