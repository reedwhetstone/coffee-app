import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_ROAST_LIST_FILTERS, type RoastListFilters } from '$lib/roast/roast-list-filters';
import RoastListControls from './RoastListControls.svelte';

const coffeeOptions = [
	{ id: 102, name: 'Colombia Sierra Nevada' },
	{ id: 101, name: 'Ethiopia Yirgacheffe Wush Wush' }
];

function renderControls(filters: Partial<RoastListFilters> = {}, extra: Record<string, unknown> = {}) {
	const onChange = vi.fn();
	const view = render(RoastListControls, {
		filters: { ...NO_ROAST_LIST_FILTERS, ...filters },
		coffeeOptions,
		onChange,
		...extra
	});
	return { onChange, ...view };
}

const search = () => screen.getByRole('searchbox', { name: 'Search roasts' });
const select = (name: string) => screen.getByRole('combobox', { name }) as HTMLSelectElement;

/** Chooses an option the way a member does: the select takes the value and reports a change. */
async function choose(name: string, value: string) {
	const control = select(name);
	control.value = value;
	await fireEvent.change(control);
}

describe('the roast list’s controls', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('applies a search a moment after typing stops, not on every key', async () => {
		const { onChange } = renderControls({ market: 'retail' });

		await fireEvent.input(search(), { target: { value: 'gu' } });
		await fireEvent.input(search(), { target: { value: ' guji ' } });
		expect(onChange).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(300);

		expect(onChange).toHaveBeenCalledOnce();
		expect(onChange).toHaveBeenCalledWith({ ...NO_ROAST_LIST_FILTERS, market: 'retail', q: 'guji' });
	});

	it('applies a search at once on Enter, and only once', async () => {
		const { onChange } = renderControls();

		await fireEvent.input(search(), { target: { value: '#4531' } });
		await fireEvent.keyDown(search(), { key: 'Enter' });
		expect(onChange).toHaveBeenCalledWith({ ...NO_ROAST_LIST_FILTERS, q: '#4531' });

		await vi.advanceTimersByTimeAsync(1000);
		expect(onChange).toHaveBeenCalledOnce();
	});

	it('clears a search when the box is emptied, and asks for nothing when it did not change', async () => {
		const { onChange } = renderControls({ q: 'guji' });

		await fireEvent.input(search(), { target: { value: 'guji ' } });
		await vi.advanceTimersByTimeAsync(300);
		expect(onChange).not.toHaveBeenCalled();

		await fireEvent.input(search(), { target: { value: '' } });
		await vi.advanceTimersByTimeAsync(300);
		expect(onChange).toHaveBeenCalledWith(NO_ROAST_LIST_FILTERS);
	});

	it('holds a search to the length the list accepts', () => {
		renderControls();

		expect(search()).toHaveAttribute('maxlength', '100');
	});

	it('follows the search in the address when it changes from outside', async () => {
		const view = renderControls({ q: 'guji' });
		expect(search()).toHaveValue('guji');

		await view.rerender({ filters: NO_ROAST_LIST_FILTERS });

		expect(search()).toHaveValue('');
	});

	it('narrows to one coffee and back to all coffees', async () => {
		const { onChange } = renderControls({ q: 'guji' });

		await choose('Coffee', '101');
		expect(onChange).toHaveBeenLastCalledWith({ ...NO_ROAST_LIST_FILTERS, q: 'guji', coffee: 101 });

		await choose('Coffee', '');
		expect(onChange).toHaveBeenLastCalledWith({ ...NO_ROAST_LIST_FILTERS, q: 'guji', coffee: null });
	});

	it('still names a coffee that is not among the portfolio’s choices', () => {
		renderControls({ coffee: 999 }, { coffeeName: 'Kenya Nyeri' });

		expect(select('Coffee')).toHaveValue('999');
		expect(within(select('Coffee')).getByRole('option', { name: 'Kenya Nyeri' })).toBeInTheDocument();
	});

	it.each([
		['7d', 'Last 7 days'],
		['30d', 'Last 30 days'],
		['ytd', 'This year']
	])('sets the %s date preset and drops a first and last day', async (range, label) => {
		const { onChange } = renderControls({ from: '2026-09-01', to: '2026-09-30' });
		expect(within(select('Roast date')).getByRole('option', { name: label })).toHaveValue(range);

		await choose('Roast date', range);

		expect(onChange).toHaveBeenCalledWith({ ...NO_ROAST_LIST_FILTERS, range });
	});

	it('returns to any time', async () => {
		const { onChange } = renderControls({ range: '7d', coffee: 101 });

		await choose('Roast date', '');

		expect(onChange).toHaveBeenCalledWith({ ...NO_ROAST_LIST_FILTERS, coffee: 101 });
	});

	it('shows a first and a last day for custom dates, and sets each', async () => {
		const { onChange } = renderControls();
		expect(screen.queryByLabelText('From')).toBeNull();

		await choose('Roast date', 'custom');
		// Nothing changes until a day is chosen.
		expect(onChange).not.toHaveBeenCalled();

		await fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });
		expect(onChange).toHaveBeenLastCalledWith({ ...NO_ROAST_LIST_FILTERS, from: '2026-09-01' });

		await fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-30' } });
		expect(onChange).toHaveBeenLastCalledWith({ ...NO_ROAST_LIST_FILTERS, to: '2026-09-30' });
	});

	it('opens on custom dates when the address carries a first or last day', async () => {
		const { onChange } = renderControls({ from: '2026-09-01', to: '2026-09-30' });

		expect(select('Roast date')).toHaveValue('custom');
		expect(screen.getByLabelText('From')).toHaveValue('2026-09-01');
		expect(screen.getByLabelText('To')).toHaveValue('2026-09-30');
		// Each day keeps the other from crossing it.
		expect(screen.getByLabelText('From')).toHaveAttribute('max', '2026-09-30');
		expect(screen.getByLabelText('To')).toHaveAttribute('min', '2026-09-01');

		await fireEvent.change(screen.getByLabelText('To'), { target: { value: '' } });
		expect(onChange).toHaveBeenCalledWith({ ...NO_ROAST_LIST_FILTERS, from: '2026-09-01' });
	});

	it('moves from a preset to custom dates by dropping the preset', async () => {
		const { onChange } = renderControls({ range: '30d' });

		await choose('Roast date', 'custom');

		expect(onChange).toHaveBeenCalledWith(NO_ROAST_LIST_FILTERS);
	});

	it('chooses retail or wholesale, and All removes the choice', async () => {
		const { onChange } = renderControls({ coffee: 101 });
		expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

		await fireEvent.click(screen.getByRole('button', { name: 'Wholesale' }));
		expect(onChange).toHaveBeenLastCalledWith({
			...NO_ROAST_LIST_FILTERS,
			coffee: 101,
			market: 'wholesale'
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Retail' }));
		expect(onChange).toHaveBeenLastCalledWith({
			...NO_ROAST_LIST_FILTERS,
			coffee: 101,
			market: 'retail'
		});

		await fireEvent.click(screen.getByRole('button', { name: 'All' }));
		expect(onChange).toHaveBeenLastCalledWith({ ...NO_ROAST_LIST_FILTERS, coffee: 101 });
	});

	it('returns to All when the chosen one is chosen again', async () => {
		const { onChange } = renderControls({ market: 'retail' });

		await fireEvent.click(screen.getByRole('button', { name: 'Retail' }));

		expect(onChange).toHaveBeenCalledWith(NO_ROAST_LIST_FILTERS);
	});

	it('clears every filter at once, and offers that only when one is set', async () => {
		const none = renderControls();
		expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
		none.unmount();

		const { onChange } = renderControls({
			coffee: 101,
			batch: 'aaaaaaaa-0000-4000-8000-000000000001',
			range: '7d',
			q: 'guji',
			market: 'retail'
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

		expect(onChange).toHaveBeenCalledWith(NO_ROAST_LIST_FILTERS);
	});
});
