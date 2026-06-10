import { describe, expect, it } from 'vitest';
import {
	compactActionCardOutputForModel,
	compactCatalogRowForModel,
	compactCatalogSearchOutputForModel
} from './toolModelOutput';

describe('compactCatalogRowForModel', () => {
	const fullRow = {
		id: 42,
		name: 'Ethiopia Hambela',
		source: 'Sweet Maria',
		country: 'Ethiopia',
		processing: 'Natural',
		price_per_lb: 8.5,
		purveyor_score: 92,
		purveyor_score_tier: 'exceptional',
		purveyor_score_factors: { provenance: 0.9 },
		stocked: true,
		description_short: 'Stone fruit and honey.',
		description_long: 'x'.repeat(3000),
		farm_notes: 'y'.repeat(2000),
		ai_description: 'z'.repeat(1500),
		roast_recs: 'City+ to Full City',
		cupping_notes: 'c'.repeat(500),
		link: 'https://example.com',
		empty_field: null
	};

	it('keeps reasoning fields and drops long prose wholesale', () => {
		const compact = compactCatalogRowForModel(fullRow);

		expect(compact.id).toBe(42);
		expect(compact.purveyor_score_factors).toEqual({ provenance: 0.9 });
		expect(compact.description_long).toBeUndefined();
		expect(compact.farm_notes).toBeUndefined();
		expect(compact.ai_description).toBeUndefined();
		expect(compact.roast_recs).toBeUndefined();
		expect(compact.link).toBeUndefined();
		expect(compact.empty_field).toBeUndefined();
	});

	it('truncates kept prose fields', () => {
		const compact = compactCatalogRowForModel(fullRow);

		expect(compact.description_short).toBe('Stone fruit and honey.');
		expect((compact.cupping_notes as string).length).toBeLessThanOrEqual(241);
		expect(compact.cupping_notes as string).toMatch(/…$/);
	});

	it('shrinks the serialized row substantially', () => {
		const compact = compactCatalogRowForModel(fullRow);

		expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(fullRow).length / 5);
	});
});

describe('compactCatalogSearchOutputForModel', () => {
	it('compacts rows while passing metadata through', () => {
		const output = {
			coffees: [{ id: 1, name: 'A', description_long: 'x'.repeat(1000) }],
			total: 1,
			filters_applied: { origin: 'Ethiopia' },
			search_strategy: 'structured'
		};

		const compact = compactCatalogSearchOutputForModel(output);

		expect(compact.total).toBe(1);
		expect(compact.filters_applied).toEqual({ origin: 'Ethiopia' });
		expect((compact.coffees as Array<Record<string, unknown>>)[0].description_long).toBeUndefined();
	});

	it('passes through outputs without a coffees array (e.g. errors)', () => {
		const output = { error: 'nothing found' };

		expect(compactCatalogSearchOutputForModel(output)).toEqual(output);
	});
});

describe('compactActionCardOutputForModel', () => {
	it('strips dropdown options and hidden fields from action cards', () => {
		const output = {
			action_card: {
				actionType: 'add_bean_to_inventory',
				summary: 'Add Hambela (5 lbs)',
				reasoning: 'You liked fruity naturals',
				status: 'proposed',
				fields: [
					{
						key: 'coffee_bean',
						label: 'Coffee Bean',
						value: '42',
						type: 'select',
						editable: true,
						selectOptions: Array.from({ length: 500 }, (_, i) => ({
							label: `Coffee ${i}`,
							value: String(i)
						}))
					},
					{
						key: '_bean_sources',
						label: '',
						value: { '1': 'Sweet Maria' },
						type: 'hidden',
						editable: false
					},
					{
						key: 'purchased_qty_lbs',
						label: 'Quantity (lbs)',
						value: 5,
						type: 'number',
						editable: true
					}
				]
			}
		};

		const compact = compactActionCardOutputForModel(output);
		const card = compact.action_card as Record<string, unknown>;
		const fields = card.fields as Array<Record<string, unknown>>;

		expect(card.summary).toBe('Add Hambela (5 lbs)');
		expect(fields).toHaveLength(2);
		expect(fields[0].selectOptions).toBeUndefined();
		expect(fields.find((f) => f.key === '_bean_sources')).toBeUndefined();
		expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(output).length / 10);
	});

	it('passes through outputs without an action card (e.g. errors)', () => {
		const output = { error: 'bean_id required' };

		expect(compactActionCardOutputForModel(output)).toEqual(output);
	});
});
