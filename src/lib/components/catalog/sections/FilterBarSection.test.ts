import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import FilterBarSection from './FilterBarSection.svelte';

const filterStore = vi.hoisted(() => {
	const state = {
		filters: {},
		showWholesale: true,
		uniqueValues: { countries: ['Colombia'], processing: ['Washed'] }
	};

	return {
		state,
		subscribe(run: (value: typeof state) => void) {
			run(state);
			return () => {};
		},
		setFilter: vi.fn(),
		setShowWholesale: vi.fn(),
		clearFilters: vi.fn()
	};
});

vi.mock('$lib/stores/filterStore', () => ({ filterStore }));

describe('FilterBarSection', () => {
	it('exposes hobbyist-only narrowing to anonymous catalog visitors', async () => {
		render(FilterBarSection, { hasInlineFilters: false });

		const checkbox = screen.getByRole('checkbox', { name: 'Hobbyist suppliers only' });
		expect(checkbox).not.toBeChecked();

		await fireEvent.click(checkbox);

		expect(filterStore.setShowWholesale).toHaveBeenCalledWith(false);
	});
});
