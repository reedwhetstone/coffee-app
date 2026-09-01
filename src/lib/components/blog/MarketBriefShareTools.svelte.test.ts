import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MarketBriefShareTools from './MarketBriefShareTools.svelte';

const writeText = vi.fn();

const reader = {
	canonicalUrl: 'https://www.purveyors.io/blog/market-brief-007',
	markdown: '## Supply tightens\n\nOffers narrowed.\n',
	sections: [
		{
			id: 'supply-tightens',
			title: 'Supply tightens',
			kind: 'take' as const,
			html: '<p>Offers narrowed.</p>'
		}
	]
};

describe('Market Brief portable export tools', () => {
	beforeEach(() => {
		writeText.mockReset();
		writeText.mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText }
		});
	});

	it('keeps the bottom utility focused on the portable Markdown artifact', () => {
		render(MarketBriefShareTools, { slug: 'market-brief-007', reader });

		expect(screen.getByRole('heading', { name: 'Markdown export' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Download .md' })).toHaveAttribute(
			'href',
			'/blog/market-brief-007/markdown'
		);
		expect(screen.queryByText('Share an individual take')).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Reddit' })).not.toBeInTheDocument();
	});

	it('copies the exact Markdown export', async () => {
		const { container } = render(MarketBriefShareTools, {
			slug: 'market-brief-007',
			reader
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Copy Markdown' }));
		expect(writeText).toHaveBeenLastCalledWith(reader.markdown);
		expect(container.querySelector('pre code')).toHaveTextContent(
			'## Supply tightens Offers narrowed.'
		);
	});

	it('reports clipboard failure without removing the download path', async () => {
		writeText.mockRejectedValueOnce(new Error('denied'));
		render(MarketBriefShareTools, { slug: 'market-brief-007', reader });

		await fireEvent.click(screen.getByRole('button', { name: 'Copy Markdown' }));
		expect(screen.getByRole('button', { name: 'Copy failed' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Download .md' })).toBeInTheDocument();
	});
});
