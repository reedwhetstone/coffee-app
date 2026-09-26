import { describe, expect, it } from 'vitest';
import type { RoastProfile } from '$lib/types/component.types';
import { buildRoastPageContext } from './roastPageContext';

describe('buildRoastPageContext', () => {
	it('puts the selected roast first and exposes its exact ID for canonical inspection', () => {
		const visible = Array.from({ length: 10 }, (_, index) => ({
			roast_id: index + 1,
			batch_name: `Batch ${index + 1}`,
			coffee_name: 'Banko Gotiti'
		})) as RoastProfile[];
		const context = buildRoastPageContext(visible, visible[8]!, false);

		expect(context.surface).toBe('roast');
		expect(context.entities?.[0]).toMatchObject({ type: 'roast', id: 9 });
		expect(context.entities).toHaveLength(8);
		expect(new Set(context.entities?.map((entity) => entity.id)).size).toBe(8);
		expect(context.summary).toContain('Selected roast #9');
	});
});
