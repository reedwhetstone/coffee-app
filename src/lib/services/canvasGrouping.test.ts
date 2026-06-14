import { describe, expect, it } from 'vitest';
import { groupCanvasBlocks, subTabLabel } from './canvasGrouping';
import type { CanvasBlock, UIBlock } from '$lib/types/genui';

let seq = 0;
function makeBlock(type: UIBlock['type'], opts: Partial<CanvasBlock> = {}): CanvasBlock {
	seq += 1;
	return {
		id: `b${seq}`,
		block: { type, version: 1, data: [] } as UIBlock,
		messageId: `m${seq}`,
		pinned: false,
		minimized: false,
		addedAt: seq,
		...opts
	};
}

describe('groupCanvasBlocks', () => {
	it('groups blocks by category, preserving group and member order', () => {
		const cards1 = makeBlock('coffee-cards');
		const roast = makeBlock('roast-profiles');
		const cards2 = makeBlock('coffee-cards');

		const groups = groupCanvasBlocks([cards1, roast, cards2]);

		expect(groups.map((g) => g.key)).toEqual(['coffee-cards', 'roast-profiles']);
		expect(groups[0].blocks.map((b) => b.id)).toEqual([cards1.id, cards2.id]);
		expect(groups[1].blocks.map((b) => b.id)).toEqual([roast.id]);
		expect(groups[0].label).toBe('Coffee cards');
	});

	it('marks a group pinned when any member is pinned', () => {
		const a = makeBlock('coffee-cards');
		const b = makeBlock('coffee-cards', { pinned: true });

		const [group] = groupCanvasBlocks([a, b]);

		expect(group.pinned).toBe(true);
	});

	it('does not mark a group pinned when no member is pinned', () => {
		const [group] = groupCanvasBlocks([makeBlock('inventory-table')]);
		expect(group.pinned).toBe(false);
	});
});

describe('subTabLabel', () => {
	it('uses the AI title when present', () => {
		expect(subTabLabel(makeBlock('coffee-cards', { title: 'Ethiopia naturals' }), 0)).toBe(
			'Ethiopia naturals'
		);
	});

	it('falls back to a numbered category label', () => {
		expect(subTabLabel(makeBlock('roast-profiles'), 2)).toBe('Roast profiles 3');
	});
});
