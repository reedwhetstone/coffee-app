import { fireEvent, render, screen, within } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeCatalog } from '$lib/types/component.types';
import type { CoffeeCardsBlock } from '$lib/types/genui';
import InlineCoffeeResults from './InlineCoffeeResults.svelte';

function coffee(id: number, overrides: Partial<CoffeeCatalog> = {}): CoffeeCatalog {
	return {
		id,
		name: `Lot ${id}`,
		source: 'example_importer',
		country: 'Colombia',
		region: 'Huila',
		processing: 'Washed',
		price_per_lb: 8.5,
		cost_lb: null,
		price_tiers: null,
		ai_tasting_notes: null,
		stocked: true,
		...overrides
	} as CoffeeCatalog;
}

function block(data = [coffee(1), coffee(2), coffee(3), coffee(4), coffee(5)]): CoffeeCardsBlock {
	return { type: 'coffee-cards', version: 1, data };
}

afterEach(() => vi.restoreAllMocks());

describe('InlineCoffeeResults', () => {
	it('shows three returned coffees with explicit expansion and collapse', async () => {
		render(InlineCoffeeResults, { block: block() });
		const results = screen.getByRole('list', { name: 'Returned coffees' });
		expect(within(results).getAllByRole('listitem')).toHaveLength(3);
		expect(
			screen.queryByRole('button', { name: 'View details for Lot 4' })
		).not.toBeInTheDocument();
		const expand = screen.getByRole('button', { name: 'Show 2 more coffees' });
		expect(expand).toHaveAttribute('aria-expanded', 'false');
		await fireEvent.click(expand);
		expect(within(results).getAllByRole('listitem')).toHaveLength(5);
		expect(screen.getByRole('button', { name: 'Show fewer coffees' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		await fireEvent.click(screen.getByRole('button', { name: 'Show fewer coffees' }));
		expect(within(results).getAllByRole('listitem')).toHaveLength(3);
	});

	it('keeps an explicitly focused coffee and its annotation in the bounded preview', () => {
		render(InlineCoffeeResults, {
			block: {
				...block(),
				focusId: 5,
				annotations: [{ id: 5, annotation: 'Best fit for the requested profile', highlight: true }]
			}
		});
		expect(screen.getAllByRole('button', { name: /View details for/ })).toHaveLength(3);
		expect(screen.getByRole('button', { name: 'View details for Lot 5' })).toBeInTheDocument();
		expect(screen.getByText('Best fit for the requested profile')).toBeInTheDocument();
	});

	it('is readable without a canvas target and does not fetch or navigate on mount', () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		const onAction = vi.fn();
		render(InlineCoffeeResults, { block: block([coffee(17)]), onAction });
		expect(screen.getByRole('heading', { name: 'Lot 17' })).toBeInTheDocument();
		expect(screen.getByText('Example Importer')).toBeInTheDocument();
		expect(screen.getByText('$8.50/lb')).toBeInTheDocument();
		expect(screen.getByText(/Prices and availability may have changed/)).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Open evidence' })).not.toBeInTheDocument();
		expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
		expect(fetchSpy).not.toHaveBeenCalled();
		expect(onAction).not.toHaveBeenCalled();
	});

	it('inspects the exact returned coffee and returns keyboard focus to its answer', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		render(InlineCoffeeResults, { block: block([coffee(17), coffee(21)]) });
		const trigger = screen.getByRole('button', { name: 'View details for Lot 21' });
		await fireEvent.click(trigger);
		const detail = screen.getByRole('complementary', { name: 'Lot 21' });
		expect(within(detail).getByRole('link', { name: 'View in catalog' })).toHaveAttribute(
			'href',
			'/catalog?coffee=21'
		);
		expect(fetchSpy).not.toHaveBeenCalled();
		await fireEvent.click(within(detail).getByRole('button', { name: 'Back to answer' }));
		expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
		expect(trigger).toHaveFocus();
	});

	it('preserves unknown price, origin, process and availability without fabricated facts', () => {
		render(InlineCoffeeResults, {
			block: block([
				coffee(1, {
					price_per_lb: null,
					country: null,
					region: null,
					processing: null,
					stocked: null
				})
			])
		});
		expect(screen.getByText('Price unavailable')).toBeInTheDocument();
		expect(screen.getByText(/Origin unavailable/)).toBeInTheDocument();
		expect(screen.getByText('Process label unavailable')).toBeInTheDocument();
		expect(screen.getByText(/Availability unknown/)).toBeInTheDocument();
		expect(screen.queryByText('$0.00/lb')).not.toBeInTheDocument();
	});

	it('keeps the inspected snapshot open through a curated result replacement', async () => {
		const { rerender } = render(InlineCoffeeResults, { block: block([coffee(17)]) });
		await fireEvent.click(screen.getByRole('button', { name: 'View details for Lot 17' }));
		await rerender({ block: block([coffee(21)]) });
		const detail = screen.getByRole('complementary', { name: 'Lot 17' });
		expect(within(detail).getByRole('link', { name: 'View in catalog' })).toHaveAttribute(
			'href',
			'/catalog?coffee=17'
		);
		expect(
			screen.queryByRole('button', { name: 'View details for Lot 21' })
		).not.toBeInTheDocument();
		await fireEvent.click(within(detail).getByRole('button', { name: 'Back to answer' }));
		expect(screen.getByRole('button', { name: 'View details for Lot 21' })).toBeInTheDocument();
		expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
		expect(screen.getByRole('region', { name: 'Coffee results' })).toHaveFocus();
	});

	it('uses canonical tier pricing and exposes quantity basis before inspection', async () => {
		render(InlineCoffeeResults, {
			block: block([
				coffee(1, {
					price_per_lb: null,
					price_tiers: [
						{ min_lbs: 10, price: 8 },
						{ min_lbs: 1, price: 9 }
					]
				})
			])
		});
		expect(screen.getByText('$9.00/lb')).toBeInTheDocument();
		expect(screen.getByText('2 tiers from 1+ lb $9.00/lb to 10+ lb $8.00/lb')).toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'View details for Lot 1' }));
		await fireEvent.click(screen.getByRole('tab', { name: 'Pricing' }));
		expect(screen.getByText('10+ lb')).toBeInTheDocument();
		expect(screen.getByText('$8.00/lb')).toBeInTheDocument();
	});

	it('opens existing expanded evidence only after an explicit click', async () => {
		const onAction = vi.fn();
		render(InlineCoffeeResults, { block: block(), canvasBlockId: 'evidence-17', onAction });
		expect(onAction).not.toHaveBeenCalled();
		await fireEvent.click(screen.getByRole('button', { name: 'Open evidence' }));
		expect(onAction).toHaveBeenCalledTimes(1);
		expect(onAction).toHaveBeenCalledWith({
			type: 'focus-canvas-block',
			blockId: 'evidence-17'
		});
	});
});
