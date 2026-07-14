import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CoffeeCardsBlock from './CoffeeCardsBlock.svelte';
import type { CoffeeCardsBlock as CoffeeCardsBlockData } from '$lib/types/genui';

vi.mock('$lib/components/CoffeeCard.svelte', () => ({ default: vi.fn() }));

const block: CoffeeCardsBlockData = {
	type: 'coffee-cards',
	version: 1,
	data: [
		{ id: 1, name: 'Kochere' } as never,
		{ id: 2, name: 'Guji' } as never,
		{ id: 3, name: 'Kericho' } as never
	]
};

describe('CoffeeCardsBlock focused navigation', () => {
	beforeEach(() => {
		Element.prototype.scrollIntoView = vi.fn();
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
			callback(0);
			return 1;
		});
	});

	it('presents one snap-scene position with explicit comparison navigation', async () => {
		render(CoffeeCardsBlock, { block });

		expect(screen.getByText('Coffee 1 of 3')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Previous coffee' })).toBeDisabled();

		await fireEvent.click(screen.getByRole('button', { name: 'Next coffee' }));

		expect(screen.getByText('Coffee 2 of 3')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Previous coffee' })).not.toBeDisabled();
		expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
	});

	it('starts on the focused coffee when the block identifies one', () => {
		const { container } = render(CoffeeCardsBlock, { block: { ...block, focusId: 2 } });

		expect(screen.getByText('Coffee 2 of 3')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show coffee 2: Guji' })).toHaveAttribute(
			'aria-current',
			'true'
		);
		expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
			behavior: 'instant',
			block: 'nearest',
			inline: 'start'
		});
		expect(container.querySelectorAll('[inert]')).toHaveLength(2);
	});

	it('starts on the first highlighted coffee when no focus is provided', () => {
		render(CoffeeCardsBlock, {
			block: {
				...block,
				annotations: [
					{ id: 2, highlight: true },
					{ id: 3, highlight: true }
				]
			}
		});

		expect(screen.getByText('Coffee 2 of 3')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Show coffee 2: Guji' })).toHaveAttribute(
			'aria-current',
			'true'
		);
	});
});
