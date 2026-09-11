import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import CoffeeCardsBlock from './CoffeeCardsBlock.svelte';
import type { CoffeeCardsBlock as CoffeeCardsBlockData } from '$lib/types/genui';
const block: CoffeeCardsBlockData = {
	type: 'coffee-cards',
	version: 1,
	data: [
		{ id: 1, name: 'Kochere' },
		{ id: 2, name: 'Guji' },
		{ id: 3, name: 'Kericho' }
	] as never
};
describe('CoffeeCardsBlock comparison', () => {
	it('exposes every coffee without stepping through a carousel and opens the exact detail', async () => {
		render(CoffeeCardsBlock, { block });
		expect(screen.getByText('Compare 3 coffees')).toBeVisible();
		for (const name of ['Kochere', 'Guji', 'Kericho'])
			expect(screen.getByRole('button', { name: `View details for ${name}` })).toBeVisible();
		await fireEvent.click(screen.getByRole('button', { name: 'View details for Guji' }));
		expect(screen.getByRole('link', { name: 'View in catalog' })).toHaveAttribute(
			'href',
			'/catalog?coffee=2'
		);
	});
	it('preserves curation annotations alongside the shared cards', () => {
		render(CoffeeCardsBlock, {
			block: {
				...block,
				focusId: 2,
				annotations: [{ id: 2, annotation: 'Best fit for filter', highlight: true }]
			}
		});
		expect(screen.getByText('Best fit for filter')).toBeVisible();
	});
});
