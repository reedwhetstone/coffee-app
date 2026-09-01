import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import MarketBriefHeroFallback from './MarketBriefHeroFallback.svelte';

describe('Market Brief hero fallback', () => {
	it('keeps a missing edition image visually branded and identifiable', () => {
		const { container } = render(MarketBriefHeroFallback, {
			title: 'Coffee growth is pulling closer to origin',
			edition: 3
		});

		expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
		expect(screen.getByText('Market Brief · Edition 003')).toBeInTheDocument();
		expect(screen.getByText('Coffee growth is pulling closer to origin')).toBeInTheDocument();
	});
});
