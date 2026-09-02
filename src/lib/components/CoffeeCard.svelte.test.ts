import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import CoffeeCard from './CoffeeCard.svelte';
import CoffeeCardDetailContentHarness from './__test-fixtures__/CoffeeCardDetailContentHarness.svelte';
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

	it('formats supplier slugs anywhere the card exposes the supplier name', async () => {
		render(CoffeeCard, {
			coffee: createCoffee({ source: 'smokin_beans' }),
			parseTastingNotes
		});

		expect(screen.getByText('Smokin Beans')).toBeTruthy();
		expect(screen.queryByText('smokin_beans')).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: /view details for process lot/i }));

		expect(screen.getAllByText('Smokin Beans').length).toBeGreaterThan(1);
		expect(screen.getByRole('link', { name: /buy from smokin beans/i })).toBeTruthy();
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

	it('preserves wholesale visibility on catalog links for wholesale lots', () => {
		render(CoffeeCard, {
			coffee: createCoffee({ id: 42, wholesale: true }),
			parseTastingNotes,
			showCatalogLink: true,
			initialDetailsOpen: true
		});

		expect(screen.getByRole('link', { name: /view in catalog/i }).getAttribute('href')).toBe(
			'/catalog?coffee=42&showWholesale=true'
		);
	});

	it('keeps standard catalog links unchanged for non-wholesale lots', () => {
		render(CoffeeCard, {
			coffee: createCoffee({ id: 43, wholesale: false }),
			parseTastingNotes,
			showCatalogLink: true,
			initialDetailsOpen: true
		});

		expect(screen.getByRole('link', { name: /view in catalog/i }).getAttribute('href')).toBe(
			'/catalog?coffee=43'
		);
	});

	it('keeps the mobile detail sheet below app chrome with a persistent close action', async () => {
		const onDetailClose = vi.fn();
		const longName =
			'Exceptional Limited Release Anaerobic Natural Coffee With An Intentionally Long Catalog Name';

		render(CoffeeCard, {
			coffee: createCoffee({ name: longName }),
			parseTastingNotes,
			initialDetailsOpen: true,
			detailCloseLabel: 'Back to map',
			onDetailClose
		});

		const panel = screen.getByRole('complementary', { name: longName });
		const detailLayer = panel.closest('[data-coffee-detail-layer]');
		const title = screen.getByRole('heading', { name: longName, level: 2 });
		const closeButton = screen.getByRole('button', { name: 'Back to map' });
		const scrollRegion = panel.querySelector('[data-coffee-detail-scroll-region]');

		expect(detailLayer).toHaveClass('fixed', 'inset-0', 'z-[70]', 'items-end');
		expect(panel).toHaveClass(
			'h-[calc(100dvh-4.5rem)]',
			'max-h-[calc(100dvh-4.5rem)]',
			'rounded-t-2xl',
			'md:h-[100dvh]',
			'md:max-h-[100dvh]',
			'md:rounded-none'
		);
		expect(panel.classList.contains('max-w-full')).toBe(true);
		expect(title.classList.contains('break-words')).toBe(true);
		expect(title.parentElement?.classList.contains('min-w-0')).toBe(true);
		expect(closeButton.classList.contains('min-h-11')).toBe(true);
		expect(closeButton.classList.contains('shrink-0')).toBe(true);
		expect(scrollRegion?.classList.contains('min-h-0')).toBe(true);
		expect(scrollRegion?.classList.contains('flex-1')).toBe(true);
		expect(scrollRegion?.classList.contains('overscroll-contain')).toBe(true);

		await fireEvent.click(closeButton);

		expect(onDetailClose).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole('complementary', { name: longName })).toBeNull();
	});

	it('renders page-specific detail content inside the canonical pop-out shell', async () => {
		render(CoffeeCardDetailContentHarness, {
			coffee: createCoffee(),
			parseTastingNotes
		});

		await fireEvent.click(screen.getByRole('button', { name: /view details for process lot/i }));

		expect(screen.getByRole('complementary', { name: /process lot/i })).toBeTruthy();
		expect(screen.getByRole('region', { name: /portfolio detail/i })).toBeTruthy();
		expect(screen.getByText('Portfolio roast history')).toBeTruthy();
		expect(screen.queryByRole('tab', { name: /overview/i })).toBeNull();
	});
});
