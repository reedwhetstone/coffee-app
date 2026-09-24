import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import type { CoffeeCardsBlock } from '$lib/types/genui';
import InlineCoffeeResults from './InlineCoffeeResults.svelte';

const block: CoffeeCardsBlock = {
	type: 'coffee-cards',
	version: 1,
	data: [
		{ id: 1, name: 'Lot 1' },
		{ id: 2, name: 'Lot 2' }
	] as CoffeeCardsBlock['data']
};

describe('InlineCoffeeResults', () => {
	it('shows one compact canvas link rather than coffee cards in chat', async () => {
		const onAction = vi.fn();
		render(InlineCoffeeResults, { block, canvasBlockId: 'coffee-view', onAction });
		expect(screen.queryByRole('article')).not.toBeInTheDocument();
		await fireEvent.click(screen.getByRole('button', { name: 'View 2 coffees on canvas' }));
		expect(onAction).toHaveBeenCalledWith({ type: 'focus-canvas-block', blockId: 'coffee-view' });
	});

	it('keeps a compact transcript marker when the canvas component is gone', () => {
		render(InlineCoffeeResults, { block });
		expect(screen.getByText('2 coffees · No longer on canvas')).toBeVisible();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});
});
