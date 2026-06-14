import { describe, expect, it } from 'vitest';
import { getDetailCompanionBlocks, blockSupportsDetail } from './blockDetail';
import type { RoastProfileRow, RoastProfilesBlock, UIBlock } from '$lib/types/genui';

function roastRow(roastId: string): RoastProfileRow {
	return {
		roast_id: roastId,
		batch_name: `Batch ${roastId}`,
		coffee_name: 'Ethiopia',
		roast_date: '2026-06-01',
		total_roast_time: 600,
		fc_start_time: 480,
		fc_start_temp: 390,
		drop_time: 600,
		drop_temp: 420,
		development_percent: 20,
		weight_loss_percent: 14,
		total_ror: 12,
		oz_in: 200,
		oz_out: 170,
		roast_notes: null
	};
}

describe('getDetailCompanionBlocks', () => {
	it('produces one roast-chart per unique roast in a roast-profiles block', () => {
		const block: RoastProfilesBlock = {
			type: 'roast-profiles',
			version: 1,
			data: [roastRow('5'), roastRow('9'), roastRow('5')] // duplicate roast 5
		};

		const companions = getDetailCompanionBlocks(block);

		expect(companions).toEqual([
			{ type: 'roast-chart', version: 1, data: { roastId: 5 } },
			{ type: 'roast-chart', version: 1, data: { roastId: 9 } }
		]);
	});

	it('skips non-numeric or invalid roast ids', () => {
		const block: RoastProfilesBlock = {
			type: 'roast-profiles',
			version: 1,
			data: [roastRow(''), roastRow('0'), roastRow('7')]
		};

		expect(getDetailCompanionBlocks(block)).toEqual([
			{ type: 'roast-chart', version: 1, data: { roastId: 7 } }
		]);
	});

	it('returns no companions for block types without extra detail', () => {
		const block = { type: 'inventory-table', version: 1, data: [] } as UIBlock;
		expect(getDetailCompanionBlocks(block)).toEqual([]);
	});
});

describe('blockSupportsDetail', () => {
	it('excludes error blocks', () => {
		expect(
			blockSupportsDetail({ type: 'error', version: 1, data: { message: 'x', retryable: false } })
		).toBe(false);
	});

	it('allows content blocks', () => {
		expect(blockSupportsDetail({ type: 'roast-profiles', version: 1, data: [] })).toBe(true);
	});
});
