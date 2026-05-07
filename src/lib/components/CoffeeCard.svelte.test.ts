import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CoffeeCard from './CoffeeCard.svelte';
import type { CoffeeCatalog } from '$lib/types/component.types';

function createCoffee(overrides: Partial<CoffeeCatalog> = {}): CoffeeCatalog {
	return {
		id: 1,
		name: 'Process Lot',
		source: 'Example Importer',
		country: 'Colombia',
		region: 'Huila',
		continent: 'South America',
		processing: 'Washed',
		processing_base_method: 'natural',
		fermentation_type: 'anaerobic',
		process_additives: ['fruit'],
		process_additive_detail: 'Peach co-ferment disclosed by supplier',
		fermentation_duration_hours: 72,
		drying_method: 'raised_bed',
		processing_notes: 'Extended fermentation before drying',
		processing_disclosure_level: 'high_detail',
		processing_confidence: 0.86,
		processing_evidence: { schema_version: 1 },
		processing_evidence_available: true,
		ai_description: 'A structured Colombian lot with stone fruit and panela notes.',
		ai_tasting_notes: {
			body: { tag: 'Silky', color: '#8B4513', score: 4 },
			flavor: { tag: 'Peach', color: '#D2691E', score: 5 },
			acidity: { tag: 'Bright', color: '#F9A57B', score: 4 },
			sweetness: { tag: 'Panela', color: '#a07d50', score: 4 },
			fragrance_aroma: { tag: 'Floral', color: '#dfdaca', score: 3 }
		},
		price_tiers: [
			{ min_lbs: 1, price: 8.5 },
			{ min_lbs: 10, price: 8 }
		],
		price_per_lb: 8.5,
		cost_lb: 8.5,
		wholesale: false,
		link: 'https://example.test/coffee',
		cultivar_detail: 'Caturra',
		grade: '1600 MASL',
		appearance: 'Clean screen',
		type: 'Importer',
		arrival_date: '2026-03-01',
		stocked: true,
		stocked_date: '2026-04-01',
		last_updated: '2026-04-02',
		farm_notes: 'Farm provenance disclosed.',
		roast_recs: 'City+',
		score_value: 87,
		cupping_notes: null,
		description_short: null,
		description_long: null,
		public_coffee: true,
		coffee_user: null,
		lot_size: null,
		bag_size: null,
		packaging: null,
		unstocked_date: null,
		purveyor_score: 92,
		purveyor_score_confidence: 0.93,
		purveyor_score_factors: {
			provenance_depth: 25,
			process_transparency: 25,
			freshness_availability: 20,
			pricing_comparability: 15,
			sensory_context: 7
		},
		purveyor_score_tier: 'Exceptional',
		purveyor_score_updated_at: '2026-05-06T00:00:00.000Z',
		purveyor_score_version: 'purveyor-score-v1',
		...overrides
	} as CoffeeCatalog;
}

function parseTastingNotes(input: string | null | object) {
	return input && typeof input === 'object' ? (input as never) : null;
}

describe('CoffeeCard Purveyor Score hierarchy', () => {
	it('shows sourcing essentials and Purveyor Score on the collapsed card', () => {
		render(CoffeeCard, {
			coffee: createCoffee(),
			parseTastingNotes
		});

		expect(screen.getByText('Process Lot')).toBeTruthy();
		expect(screen.getByText('Example Importer')).toBeTruthy();
		expect(screen.getByText('$8.50/lb')).toBeTruthy();
		expect(screen.getByText('Purveyor Score')).toBeTruthy();
		expect(screen.getByText('92')).toBeTruthy();
		expect(screen.getByText(/Exceptional/)).toBeTruthy();
		expect(screen.queryByText('Provenance identified')).toBeNull();
	});

	it('opens a tabbed slide-out with proof and process details', async () => {
		render(CoffeeCard, {
			coffee: createCoffee(),
			parseTastingNotes,
			showSimilarComparisonAction: true
		});

		await fireEvent.click(screen.getByRole('button', { name: /view details for process lot/i }));

		expect(screen.getByRole('complementary', { name: /process lot/i })).toBeTruthy();
		expect(screen.getByRole('tab', { name: /overview/i })).toBeTruthy();
		expect(screen.getByRole('tab', { name: /taste & process/i })).toBeTruthy();
		expect(screen.getByText('Provenance identified')).toBeTruthy();

		await fireEvent.click(screen.getByRole('tab', { name: /taste & process/i }));

		expect(screen.getByText('Natural process transparency')).toBeTruthy();
		expect(screen.getByText('Fermentation: Anaerobic')).toBeTruthy();
		expect(screen.getByText('Additives disclosed: Fruit')).toBeTruthy();
	});

	it('shows locked match copy without fetching member-only match details', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		render(CoffeeCard, {
			coffee: createCoffee(),
			parseTastingNotes,
			showSimilarComparisonAction: true,
			canUseBeanMatching: false
		});

		await fireEvent.click(screen.getByRole('button', { name: /unlock matches/i }));

		expect(screen.getByText('Unlock similar coffee matches')).toBeTruthy();
		expect(fetchSpy).not.toHaveBeenCalled();

		fetchSpy.mockRestore();
	});

	it('keeps compact cards tight while preserving the score language', () => {
		render(CoffeeCard, {
			coffee: createCoffee({ purveyor_score: 71, purveyor_score_tier: 'Strong' }),
			parseTastingNotes,
			compact: true
		});

		expect(screen.getByText('Purveyor Score')).toBeTruthy();
		expect(screen.getByText('71')).toBeTruthy();
		expect(screen.getByText(/Strong/)).toBeTruthy();
	});
});
