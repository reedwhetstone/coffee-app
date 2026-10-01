import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import ComparePage from './+page.svelte';
import { compareSelection } from '$lib/stores/compareSelection.svelte';
import type { CatalogComparison, CompareLoadState } from '$lib/catalog/compareTypes';

const { goto, pageState } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('https://purveyors.io/catalog/compare?ids=1%2C2%2C3&quantityLbs=5') }
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));

const lot = (id: number, name: string) => ({
	id,
	name,
	source: 'burman',
	link: null,
	stocked: true,
	wholesale: false,
	price: {
		quantityLbs: 5,
		atQuantityLb: 7,
		smallestTierLb: 7,
		minOrderLbs: 1,
		tiers: [],
		originMedianLb: null,
		vsOriginMedianPct: null
	}
});

function ready(lots: ReturnType<typeof lot>[], missingIds: number[] = []): CompareLoadState {
	const comparison: CatalogComparison = {
		quantityLbs: 5,
		lots,
		rows: [],
		bestPriceLotIds: [],
		missingIds
	};
	return { status: 'ready', comparison, maxLots: 6 };
}

function data(state: CompareLoadState, ids: number[]) {
	return { state, ids, quantityLbs: 5, quantityOptions: [1, 5, 10], meta: {} } as never;
}

beforeEach(() => {
	goto.mockReset();
	compareSelection.clear();
});
afterEach(() => cleanup());

describe('/catalog/compare page', () => {
	it('syncs the tray to the returned coffees once, without re-running on its own write', () => {
		const replace = vi.spyOn(compareSelection, 'replace');
		render(ComparePage, { data: data(ready([lot(1, 'Brazil'), lot(2, 'Kenya')]), [1, 2]) });
		flushSync();
		expect(compareSelection.items).toEqual([
			{ id: 1, name: 'Brazil' },
			{ id: 2, name: 'Kenya' }
		]);
		expect(replace).toHaveBeenCalledTimes(1);
		replace.mockRestore();
	});

	it('counts only returned coffees when one is removed', async () => {
		render(ComparePage, {
			data: data(ready([lot(1, 'Brazil'), lot(2, 'Kenya')], [3]), [1, 2, 3])
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Remove Brazil from comparison' }));
		expect(goto).toHaveBeenCalledWith('/catalog');
	});

	it('sends signed-out visitors back to the shared comparison after sign-in', () => {
		render(ComparePage, { data: data({ status: 'sign_in' }, [1, 2, 3]) });
		const href = screen.getByRole('link', { name: 'Sign in' }).getAttribute('href')!;
		expect(new URL(href, 'https://purveyors.io').searchParams.get('next')).toBe(
			'/catalog/compare?ids=1%2C2%2C3&quantityLbs=5'
		);
	});
});
