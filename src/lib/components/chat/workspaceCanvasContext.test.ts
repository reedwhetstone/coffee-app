import { describe, expect, it } from 'vitest';
import type { UIBlock } from '$lib/types/genui';
import { CANVAS_DESCRIPTION_MAX_CHARS, describeCanvasForCherry } from './workspaceCanvasContext';

function roastChart(roastId: number, pinned = false) {
	return { block: { type: 'roast-chart', version: 1, data: { roastId } } as UIBlock, pinned };
}

function coffeeCards(names: string[], pinned = false) {
	return {
		block: {
			type: 'coffee-cards',
			version: 1,
			data: names.map((name, id) => ({ id, name }))
		} as unknown as UIBlock,
		pinned
	};
}

describe('workspace canvas description for Cherry', () => {
	it('keeps the detailed description when it fits the request contract', () => {
		const description = describeCanvasForCherry([
			coffeeCards(['Kenya Kiambu', 'Ethiopia Guji']),
			roastChart(7, true)
		]);
		expect(description).toBe(
			'1. Coffee cards: Kenya Kiambu, Ethiopia Guji\n2. Roast temperature chart (roast #7) [LOCKED — do not replace, remove, or reorder]'
		);
	});

	it('compacts every block instead of dropping the tail, including late locked blocks', () => {
		const blocks = [
			...Array.from({ length: 6 }, (_, i) =>
				coffeeCards(Array.from({ length: 5 }, (_, j) => `Very long washed coffee name ${i}-${j}`))
			),
			roastChart(41),
			roastChart(42, true)
		];
		const description = describeCanvasForCherry(blocks);
		expect(description.length).toBeLessThanOrEqual(CANVAS_DESCRIPTION_MAX_CHARS);
		expect(description).toContain('[LOCKED] blocks are user-owned');
		expect(description).toContain('7. Roast chart #41');
		expect(description).toContain('8. Roast chart #42 [LOCKED]');
		expect(description).toContain('6. Coffee cards: Very long washed coffee… +4');
		expect(description).not.toContain('more evidence blocks');
	});

	it('prioritizes locked blocks and counts omissions when even compact lines overflow', () => {
		const blocks = Array.from({ length: 40 }, (_, i) => roastChart(i + 1, i === 39));
		const description = describeCanvasForCherry(blocks);
		expect(description.length).toBeLessThanOrEqual(CANVAS_DESCRIPTION_MAX_CHARS);
		expect(description).toContain('40. Roast chart #40 [LOCKED]');
		expect(description).toContain('1. Roast chart #1');
		expect(description).toMatch(/\(\+\d+ more evidence blocks\)$/);
		const described = description.split('\n').filter((line) => /^\d+\. /.test(line)).length;
		expect(description).toContain(`(+${40 - described} more evidence blocks)`);
	});

	it('describes an empty canvas as nothing', () => {
		expect(describeCanvasForCherry([])).toBe('');
	});
});
