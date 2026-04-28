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
