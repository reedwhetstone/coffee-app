import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
	MarketBriefCoffeeHighlight,
	MarketBriefReaderExport,
	MarketBriefSnapshot
} from '$lib/types/blog.types';
import MarketBriefArticle from './MarketBriefArticle.svelte';

const writeText = vi.fn();

const reader: MarketBriefReaderExport = {
	canonicalUrl: 'https://www.purveyors.io/blog/market-brief-007',
	markdown: '## Market read\n\nQuiet.\n',
	sections: [
		{
			id: 'market-read',
			title: 'Market read: quiet pricing',
			kind: 'market-read',
			html: '<p>The <a href="https://example.com/market">market source</a> stayed quiet.</p>'
		},
		{
			id: 'supply-tightens',
			title: 'Supply tightens',
			kind: 'take',
			html: '<p>Offers narrowed according to the <a href="https://example.com/report">source report</a>.</p>'
		},
		{
			id: 'coffee-highlights',
			title: 'Coffee highlights',
			kind: 'coffee-highlights',
			html: '<p>One current coffee.</p>'
		}
	]
};

const snapshot: MarketBriefSnapshot = {
	asOf: '2026-09-01',
	scope: 'US green coffee · retail pricing + all-market signals',
	movementPercent: -0.2,
	movementLabel: 'Quiet',
	listings: 593,
	matchedListings: 524,
	suppliers: 24,
	totalSignals: 124,
	belowBenchmark: 117,
	scoreOutliers: 7,
	priceDrops: 0,
	priceStatsUrl: 'https://example.com/prices',
	signalsUrl: 'https://example.com/signals'
};

const coffeeHighlights: MarketBriefCoffeeHighlight[] = [
	{
		catalogId: 9762,
		name: 'Kahondo Station Natural',
		supplier: 'Burman Coffee Traders',
		supplierUrl: 'https://example.com/kahondo',
		catalogUrl: '/catalog?coffee=9762',
		origin: 'Congo',
		region: 'North Kivu',
		process: 'Natural',
		variety: 'Bourbon',
		pricePerLb: 8.69,
		priceContext: '$7.49/lb at 60 lb',
		stockedDate: '2026-08-08',
		tastingNotes: {
			body: { tag: 'syrupy', color: '#b06a3b', score: 4 },
			flavor: { tag: 'dark berry', color: '#9d2f5e', score: 5 },
			acidity: { tag: 'soft citric', color: '#f4d03f', score: 4 },
			sweetness: { tag: 'milk chocolate', color: '#7a4a2b', score: 5 },
			fragrance_aroma: { tag: 'blackberry jam', color: '#7b2d8b', score: 5 }
		},
		rationale: 'This makes the origin-access story concrete.'
	}
];

describe('Market Brief article presentation', () => {
	beforeEach(() => {
		writeText.mockReset();
		writeText.mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText }
		});
	});

	it('renders numbers, a visual market read, section-local sources, and catalog coffee cards', () => {
		render(MarketBriefArticle, {
			title: 'Coffee finds a floor',
			reader,
			snapshot,
			coffeeHighlights
		});

		expect(screen.getByRole('heading', { name: 'This week in numbers' })).toBeInTheDocument();
		expect(screen.getByText('524')).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'quiet pricing' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'market source' })).toHaveAttribute(
			'href',
			'https://example.com/market'
		);
		expect(screen.getByRole('heading', { name: 'Supply tightens' })).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'source report' })).toHaveAttribute(
			'href',
			'https://example.com/report'
		);
		expect(screen.getByRole('heading', { name: 'Kahondo Station Natural' })).toBeInTheDocument();
		expect(screen.getByText('$8.69')).toBeInTheDocument();
		expect(screen.getByText('blackberry jam')).toBeInTheDocument();
	});

	it('keeps each take share link inside its own card', async () => {
		render(MarketBriefArticle, {
			title: 'Coffee finds a floor',
			reader,
			snapshot,
			coffeeHighlights
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Copy take link' }));
		expect(writeText).toHaveBeenCalledWith(
			'https://www.purveyors.io/blog/market-brief-007#supply-tightens'
		);
		expect(screen.getByRole('link', { name: 'Reddit' })).toHaveAttribute(
			'href',
			expect.stringContaining('supply-tightens')
		);
	});

	it('keeps coffee cards visual when aggregate or tasting evidence is unavailable', () => {
		const sparseCoffee = {
			...coffeeHighlights[0]!,
			stockedDate: undefined,
			tastingNotes: undefined
		};
		render(MarketBriefArticle, {
			title: 'Coffee finds a floor',
			reader: {
				...reader,
				sections: reader.sections.filter((section) => section.kind !== 'market-read')
			},
			coffeeHighlights: [sparseCoffee]
		});

		expect(screen.queryByRole('heading', { name: 'This week in numbers' })).not.toBeInTheDocument();
		expect(screen.getByText('Available when selected')).toBeInTheDocument();
		expect(
			screen.getByText('Structured tasting notes are not yet published for this listing.')
		).toBeInTheDocument();
	});
});
