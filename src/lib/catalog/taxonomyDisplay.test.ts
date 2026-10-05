import { describe, expect, it } from 'vitest';
import { dryingDisplay, varietyDisplay } from './taxonomyDisplay';

const label = (code: string, text: string, parent_code: string | null = null) => ({
	code,
	label: text,
	parent_code
});

describe('varietyDisplay', () => {
	it('shows standardized names and keeps the supplier wording when it differs', () => {
		expect(
			varietyDisplay({
				cultivar_detail: 'Catimor, Catuai, Tipica and Borbon (shade grown)',
				taxonomy: {
					varieties: [label('catimor', 'Catimor'), label('catuai', 'Catuai')],
					species: []
				}
			})
		).toEqual({
			value: 'Catimor, Catuai',
			supplierText: 'Catimor, Catuai, Tipica and Borbon (shade grown)'
		});
	});

	it('does not repeat supplier wording that says the same thing', () => {
		expect(
			varietyDisplay({
				cultivar_detail: 'pink bourbon / GESHA',
				taxonomy: {
					varieties: [label('pink_bourbon', 'Pink Bourbon', 'bourbon'), label('gesha', 'Gesha')],
					species: []
				}
			})
		).toEqual({ value: 'Pink Bourbon, Gesha', supplierText: null });
	});

	it('treats accents and joining words as the same wording', () => {
		expect(
			varietyDisplay({
				cultivar_detail: 'Yellow Catuaí, Mundo Novo and Acaia',
				taxonomy: {
					varieties: [
						label('yellow_catuai', 'Yellow Catuai', 'catuai'),
						label('mundo_novo', 'Mundo Novo'),
						label('acaia', 'Acaiá')
					]
				}
			})
		).toEqual({ value: 'Yellow Catuai, Mundo Novo, Acaiá', supplierText: null });
	});

	it('lists a stated species after the varieties', () => {
		expect(
			varietyDisplay({
				cultivar_detail: 'SL-28, Robusta',
				taxonomy: {
					varieties: [label('sl28', 'SL28')],
					species: [label('canephora', 'Robusta (C. canephora)')]
				}
			})
		).toEqual({ value: 'SL28, Robusta (C. canephora)', supplierText: 'SL-28, Robusta' });
	});

	it('falls back to supplier text when nothing is standardized', () => {
		expect(varietyDisplay({ cultivar_detail: ' Chiroso ' })).toEqual({
			value: 'Chiroso',
			supplierText: null
		});
		expect(
			varietyDisplay({ cultivar_detail: 'Chiroso', taxonomy: { varieties: [], species: [] } })
		).toEqual({ value: 'Chiroso', supplierText: null });
	});

	it('is empty when the supplier states nothing', () => {
		expect(varietyDisplay({ cultivar_detail: null })).toEqual({ value: null, supplierText: null });
		expect(varietyDisplay(null)).toEqual({ value: null, supplierText: null });
	});

	it('ignores malformed taxonomy entries', () => {
		expect(
			varietyDisplay({
				cultivar_detail: 'Gesha',
				taxonomy: {
					varieties: [null, { label: 3 }, label('gesha', 'Gesha'), label('gesha', 'Gesha')]
				}
			})
		).toEqual({ value: 'Gesha', supplierText: null });
	});
});

describe('dryingDisplay', () => {
	it('uses the standardized drying method and keeps differing supplier wording', () => {
		const coffee = {
			taxonomy: { drying_methods: [label('african_bed', 'African beds', 'raised_bed')] }
		};
		expect(dryingDisplay(coffee, 'Dried on African beds for 21 days')).toEqual({
			value: 'African beds',
			supplierText: 'Dried on African beds for 21 days'
		});
		expect(dryingDisplay(coffee, 'african beds')).toEqual({
			value: 'African beds',
			supplierText: null
		});
	});

	it('falls back to supplier text', () => {
		expect(dryingDisplay({}, 'Dried on tarps')).toEqual({
			value: 'Dried on tarps',
			supplierText: null
		});
		expect(dryingDisplay({}, null)).toEqual({ value: null, supplierText: null });
	});
});
