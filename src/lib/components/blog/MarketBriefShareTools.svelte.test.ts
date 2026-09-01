import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarketBriefShareTools from './MarketBriefShareTools.svelte';

const writeText = vi.fn();

const reader = {
	canonicalUrl: 'https://www.purveyors.io/blog/market-brief-007',
	markdown: '## Supply tightens\n\nOffers narrowed.\n',
	sections: [
		{ id: 'supply-tightens', title: 'Supply tightens' },
		{ id: 'buyers-stay-selective', title: 'Buyers stay selective' }
	]
};

describe('Market Brief share tools', () => {
	beforeEach(() => {
		writeText.mockReset();
		writeText.mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText }
		});
	});

	it('exposes a stable direct link and platform share controls for every take', () => {
		render(MarketBriefShareTools, {
			editionTitle: 'Coffee finds a floor',
			slug: 'market-brief-007',
			reader
		});

		expect(screen.getByRole('link', { name: 'Supply tightens' })).toHaveAttribute(
			'href',
			'#supply-tightens'
		);
		const redditLinks = screen.getAllByRole('link', { name: 'Reddit' });
		expect(redditLinks).toHaveLength(2);
		expect(redditLinks[0]).toHaveAttribute(
			'href',
			expect.stringContaining(
				'url=https%3A%2F%2Fwww.purveyors.io%2Fblog%2Fmarket-brief-007%23supply-tightens'
			)
		);
		expect(screen.getAllByRole('link', { name: 'X' })).toHaveLength(2);
	});

	it('copies section links and the exact Markdown export', async () => {
		const { container } = render(MarketBriefShareTools, {
			editionTitle: 'Coffee finds a floor',
			slug: 'market-brief-007',
			reader
		});

		await fireEvent.click(screen.getAllByRole('button', { name: 'Copy link' })[0]!);
		expect(writeText).toHaveBeenLastCalledWith(
			'https://www.purveyors.io/blog/market-brief-007#supply-tightens'
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Copy Markdown' }));
		expect(writeText).toHaveBeenLastCalledWith(reader.markdown);
		expect(screen.getByRole('link', { name: 'Download .md' })).toHaveAttribute(
			'href',
			'/blog/market-brief-007/markdown'
		);
		expect(container.querySelector('pre code')).toHaveTextContent(
			'## Supply tightens Offers narrowed.'
		);
	});

	it('reports clipboard failure without removing other share paths', async () => {
		writeText.mockRejectedValueOnce(new Error('denied'));
		render(MarketBriefShareTools, {
			editionTitle: 'Coffee finds a floor',
			slug: 'market-brief-007',
			reader
		});

		await fireEvent.click(screen.getAllByRole('button', { name: 'Copy link' })[0]!);
		expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
		expect(screen.getAllByRole('link', { name: 'Reddit' })).toHaveLength(2);
	});
});
