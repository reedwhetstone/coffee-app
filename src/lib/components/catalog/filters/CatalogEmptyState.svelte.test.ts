import { render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import CatalogEmptyState from './CatalogEmptyState.svelte';
import type { ActiveCatalogFilter, CatalogFilterSnapshot } from '$lib/catalog/filterModel';

function snapshot(): CatalogFilterSnapshot {
	return {
		filters: { country: ['Kenya'], grade_code: ['KE:AA'] },
		showWholesale: true,
		wholesaleOnly: false,
		includeUnstocked: false
	};
}

function filters(gradeLabel = 'KE:AA'): ActiveCatalogFilter[] {
	return [
		{
			id: 'country:Kenya',
			label: 'Origin: Kenya',
			remove: { kind: 'filter', key: 'country', value: [] },
			inPanel: false
		},
		{
			id: 'grade_code:KE:AA',
			label: `Grade: ${gradeLabel}`,
			remove: { kind: 'filter', key: 'grade_code', value: [] },
			inPanel: true
		}
	];
}

const props = { onRemove: vi.fn(), onClearAll: vi.fn() };
const totalReads = () => vi.mocked(fetch).mock.calls.map(([input]) => String(input));
const suggestion = () =>
	screen
		.getByRole('button', { name: /^Remove Grade/ })
		.textContent?.replace(/\s+/g, ' ')
		.trim();

beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async (input: RequestInfo | URL) => {
			// Removing the grade brings coffees back; removing the origin does not.
			const total = String(input).includes('grade_code=') ? 0 : 39;
			return new Response(JSON.stringify({ data: [], pagination: { total } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		})
	);
});

describe('CatalogEmptyState', () => {
	it('reads each total once, and names a filter as the page does when its name arrives later', async () => {
		const view = render(CatalogEmptyState, {
			...props,
			filters: filters(),
			snapshot: snapshot()
		});
		await waitFor(() => expect(suggestion()).toBe('Remove Grade: KE:AA 39 coffees'));
		expect(totalReads()).toHaveLength(2);

		// The page hands over new objects for the same selection, and the grade's
		// name once the option lists have loaded.
		await view.rerender({ filters: filters('Kenya AA'), snapshot: snapshot() });
		expect(suggestion()).toBe('Remove Grade: Kenya AA 39 coffees');
		await view.rerender({ filters: filters('Kenya AA'), snapshot: snapshot() });
		expect(suggestion()).toBe('Remove Grade: Kenya AA 39 coffees');
		expect(totalReads()).toHaveLength(2);
	});

	it('looks nothing up while the rows for the filters are still being read', async () => {
		const view = render(CatalogEmptyState, {
			...props,
			filters: filters(),
			snapshot: snapshot(),
			pending: true
		});
		expect(screen.getByText('Checking which filter to remove.')).toBeInTheDocument();
		await Promise.resolve();
		expect(totalReads()).toEqual([]);

		await view.rerender({ pending: false });
		await waitFor(() => expect(suggestion()).toBe('Remove Grade: KE:AA 39 coffees'));
		expect(totalReads()).toHaveLength(2);
	});
});
