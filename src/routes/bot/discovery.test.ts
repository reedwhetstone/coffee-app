import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import Footer from '$lib/components/marketing/Footer.svelte';
import type { BlogPost } from '$lib/types/blog.types';

const { marketBrief } = vi.hoisted(() => ({
	marketBrief: {
		slug: 'market-brief-001',
		title: 'Market Brief One',
		date: '2026-08-17',
		updated: '2026-08-18',
		description: 'The first Market Brief fixture.',
		tags: ['coffee', 'data', 'supply-chain'],
		pillar: 'market-intelligence',
		draft: false,
		format: 'market-brief',
		edition: 1
	} as BlogPost
}));

vi.mock('$lib/server/blog', () => ({
	getPublishedPosts: vi.fn(async () => [marketBrief])
}));

import { GET as getLlmsText } from '../llms.txt/+server';
import { GET as getSitemap } from '../sitemap.xml/+server';

describe('PurveyorsBot public discovery', () => {
	it('links the operator page from the public footer', () => {
		render(Footer);

		expect(screen.getByRole('link', { name: 'PurveyorsBot' })).toHaveAttribute('href', '/bot');
	});

	it('includes the operator page in the sitemap and llms.txt', async () => {
		const url = new URL('https://www.purveyors.io/');
		const sitemap = await getSitemap({ url } as never);
		const llmsText = await getLlmsText({ url } as never);

		await expect(sitemap.text()).resolves.toContain('<loc>https://www.purveyors.io/bot</loc>');
		await expect(llmsText.text()).resolves.toContain(
			'[PurveyorsBot](https://www.purveyors.io/bot)'
		);
	});

	it('projects one canonical published edition into sitemap and llms.txt', async () => {
		const url = new URL('https://www.purveyors.io/');
		const sitemap = await getSitemap({ url } as never);
		const llmsText = await getLlmsText({ url } as never);
		const sitemapBody = await sitemap.text();
		const llmsBody = await llmsText.text();

		expect(sitemapBody).toContain('<loc>https://www.purveyors.io/blog/market-brief-001</loc>');
		expect(sitemapBody).toContain('<lastmod>2026-08-18</lastmod>');
		expect(llmsBody).toContain(
			'[Market Brief One](https://www.purveyors.io/blog/market-brief-001)'
		);
		expect(`${sitemapBody}${llmsBody}`).not.toContain('market_read');
	});
});
