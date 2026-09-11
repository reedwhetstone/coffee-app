import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatAnswerMarkdown from './ChatAnswerMarkdown.svelte';
const read = {
	type: 'tool-coffee_catalog_search',
	state: 'output-available',
	output: { coffees: [{ id: 7, name: 'Washed Guji', country: 'Ethiopia', cost_lb: 8 }] }
};
function props(source = 'Try [Washed Guji](/catalog?coffee=7).') {
	return {
		source,
		messages: [{ id: 'answer', role: 'assistant', parts: [read, { type: 'text', text: source }] }],
		messageIndex: 0,
		partIndex: 1
	};
}
afterEach(cleanup);
describe('grounded Markdown coffee references', () => {
	it('opens the exact historical record without fetching and returns keyboard focus', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		render(ChatAnswerMarkdown, props());
		const reference = screen.getByRole('button', { name: 'Washed Guji' });
		await fireEvent.click(reference);
		expect(screen.getByRole('heading', { name: 'Washed Guji' })).toBeVisible();
		expect(
			screen.getByText(
				'Details retrieved for this answer. Prices and availability may have changed.'
			)
		).toBeVisible();
		expect(screen.getByRole('link', { name: 'View in catalog' })).toHaveAttribute(
			'href',
			'/catalog?coffee=7'
		);
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Back to answer' })).toHaveFocus()
		);
		await fireEvent.keyDown(window, { key: 'Escape' });
		await waitFor(() => expect(reference).toHaveFocus());
		expect(screen.queryByRole('heading', { name: 'Washed Guji' })).not.toBeInTheDocument();
		expect(fetchSpy).not.toHaveBeenCalled();
		fetchSpy.mockRestore();
	});
	it('does not promote forged IDs, future reads, or presentation-only evidence', () => {
		const data = props('[Missing](/catalog?coffee=99) and [Future](/catalog?coffee=7)');
		data.partIndex = 0;
		render(ChatAnswerMarkdown, data);
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
		expect(screen.queryByRole('link')).not.toBeInTheDocument();
		expect(screen.getByText('Missing')).toBeVisible();
	});
	it('uses the record name instead of a mismatched model label; leaves code and external links alone', () => {
		render(
			ChatAnswerMarkdown,
			props(
				'[Wrong name](/catalog?coffee=7) and `Washed Guji` and [Supplier](https://supplier.test/lot) and [Bad](javascript:alert%281%29)'
			)
		);
		expect(screen.getByRole('button', { name: 'Washed Guji' })).toBeVisible();
		expect(screen.queryByText('Wrong name')).not.toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Supplier' })).toHaveAttribute(
			'href',
			'https://supplier.test/lot'
		);
		expect(screen.queryByRole('link', { name: 'Bad' })).not.toBeInTheDocument();
	});
	it('keeps an inspected snapshot stable while later observations arrive, including restored history', async () => {
		const data = props();
		const mounted = render(ChatAnswerMarkdown, JSON.parse(JSON.stringify(data)));
		await fireEvent.click(screen.getByRole('button', { name: 'Washed Guji' }));
		await mounted.rerender({
			...data,
			messages: [
				...data.messages,
				{
					id: 'later',
					role: 'assistant',
					parts: [
						{ ...read, output: { coffees: [{ id: 7, name: 'Renamed coffee', cost_lb: 20 }] } }
					]
				}
			]
		});
		expect(screen.getByRole('heading', { name: 'Washed Guji' })).toBeVisible();
		expect(screen.queryByText('Renamed coffee')).not.toBeInTheDocument();
	});
});
