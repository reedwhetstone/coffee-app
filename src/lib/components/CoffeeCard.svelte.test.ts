import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import CoffeeCard from './CoffeeCard.svelte';
import type { CoffeeCatalog } from '$lib/types/component.types';

function createCoffee(overrides: Record<string, unknown> = {}): CoffeeCatalog {
	return {
		id: 1,
		name: 'Process Lot',
		source: 'Example Importer',
		country: 'Colombia',
		region: 'Huila',
		continent: 'South America',
		processing: 'Washed',
		ai_description: null,
		ai_tasting_notes: null,
		price_tiers: null,
		price_per_lb: 8.5,
		cost_lb: 8.5,
		wholesale: false,
		link: null,
		cultivar_detail: null,
		grade: null,
		appearance: null,
		type: null,
		arrival_date: null,
		stocked_date: null,
		...overrides
	} as unknown as CoffeeCatalog;
}

const parseTastingNotes = () => null;

describe('CoffeeCard proof badges', () => {
	it('renders compact proof badges when reliable signals exist', () => {
		render(CoffeeCard, {
			coffee: createCoffee({
				price_tiers: [
					{ min_lbs: 1, price: 8.5 },
					{ min_lbs: 10, price: 8 }
				],
				stocked_date: '2026-04-01',
				stocked: true,
				process: {
					base_method: 'washed',
					disclosure_level: 'structured',
					confidence: 0.84,
					evidence_available: true
				}
			}),
			parseTastingNotes
		});

		expect(screen.getByText('Process disclosed')).toBeTruthy();
		expect(screen.getByText('Provenance identified')).toBeTruthy();
		expect(screen.getByText('Freshness dated')).toBeTruthy();
		expect(screen.getByText('Tiered pricing')).toBeTruthy();
	});

	it('renders process proof from legacy top-level evidence when proof is absent', () => {
		render(CoffeeCard, {
			coffee: createCoffee({
				proof: null,
				process: null,
				processing_base_method: 'Washed',
				processing_evidence_available: true
			}),
			parseTastingNotes
		});

		expect(screen.getByText('Process disclosed')).toBeTruthy();
	});

	it('does not invent proof badges when no reliable signals exist', () => {
		render(CoffeeCard, {
			coffee: createCoffee({
				country: null,
				region: null,
				continent: null,
				source: null,
				price_per_lb: null,
				cost_lb: null,
				price_tiers: null,
				stocked_date: null,
				arrival_date: null,
				last_updated: null,
				stocked: null,
				process: null
			}),
			parseTastingNotes
		});

		expect(screen.queryByLabelText('Catalog proof signals')).toBeNull();
		expect(screen.queryByText('Process disclosed')).toBeNull();
		expect(screen.queryByText('Price listed')).toBeNull();
	});
});

describe('CoffeeCard process analysis', () => {
	it('renders buyer-readable process analysis when structured process metadata exists', () => {
		render(CoffeeCard, {
			coffee: createCoffee({
				process: {
					base_method: 'natural',
					fermentation_type: 'anaerobic',
					additives: ['fruit'],
					additive_detail: 'Peach co-ferment disclosed by supplier',
					fermentation_duration_hours: 72,
					drying_method: 'raised_bed',
					notes: 'Extended fermentation before drying',
					disclosure_level: 'high_detail',
					confidence: 0.86,
					evidence_available: true
				}
			}),
			parseTastingNotes
		});

		expect(screen.getByText('Process analysis')).toBeTruthy();
		expect(screen.getByText('Natural process transparency')).toBeTruthy();
		expect(screen.getByText('Fermentation: Anaerobic')).toBeTruthy();
		expect(screen.getByText('Additives disclosed: Fruit')).toBeTruthy();
		expect(screen.getByText('High-detail disclosure')).toBeTruthy();
		expect(screen.getByText('High confidence')).toBeTruthy();
		expect(screen.getByText('Supplier evidence available')).toBeTruthy();
	});

	it('does not promote low-confidence or placeholder process metadata', () => {
		render(CoffeeCard, {
			coffee: createCoffee({
				process: {
					base_method: 'unknown',
					fermentation_type: 'not specified',
					additives: [],
					additive_detail: null,
					fermentation_duration_hours: null,
					drying_method: null,
					notes: null,
					disclosure_level: null,
					confidence: 0.4,
					evidence_available: false
				}
			}),
			parseTastingNotes
		});

		expect(screen.queryByText('Process analysis')).toBeNull();
		expect(screen.queryByText('Lower confidence, verify before buying')).toBeNull();
	});

	it('suppresses None Stated process placeholders without hiding meaningful fields', () => {
		render(CoffeeCard, {
			coffee: createCoffee({
				process: {
					base_method: 'natural',
					fermentation_type: 'None Stated',
					additives: ['none'],
					additive_detail: null,
					fermentation_duration_hours: null,
					drying_method: null,
					notes: null,
					disclosure_level: null,
					confidence: 0.86,
					evidence_available: false
				}
			}),
			parseTastingNotes
		});

		expect(screen.getByText('Natural process transparency')).toBeTruthy();
		expect(screen.queryByText('Fermentation: None Stated')).toBeNull();
		expect(screen.getByText('No additives disclosed')).toBeTruthy();
	});

	it('preserves legacy processing without inventing structured process claims', () => {
		render(CoffeeCard, {
			coffee: createCoffee({ processing: 'Washed', process: null }),
			parseTastingNotes
		});

		expect(screen.getByText('Processing: Washed')).toBeTruthy();
		expect(screen.queryByText('Process analysis')).toBeNull();
		expect(screen.queryByText(/unknown/i)).toBeNull();
		expect(screen.queryByText('Lower confidence, verify before buying')).toBeNull();
	});
});
