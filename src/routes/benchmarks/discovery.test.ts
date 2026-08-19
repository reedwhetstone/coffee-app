import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import Footer from '$lib/components/marketing/Footer.svelte';
import { publicNavItems } from '$lib/components/layout/appNavigation';

vi.mock('$lib/server/blog', () => ({
	getPublishedPosts: vi.fn(async () => [])
}));

import { GET as getLlmsText } from '../llms.txt/+server';
import { GET as getSitemap } from '../sitemap.xml/+server';

describe('CoffeeBench public discovery', () => {
	it('links the benchmark index from public navigation and footer', () => {
		expect(publicNavItems).toContainEqual(
			expect.objectContaining({ label: 'Benchmarks', href: '/benchmarks' })
		);
		render(Footer);
		expect(screen.getByRole('link', { name: 'Benchmarks' })).toHaveAttribute('href', '/benchmarks');
	});

	it('indexes the benchmark collection and measured preview with explicit limitations', async () => {
		const url = new URL('https://www.purveyors.io/');
		const sitemap = await getSitemap({ url } as never);
		const llmsText = await getLlmsText({ url } as never);
		const sitemapText = await sitemap.text();
		const llms = await llmsText.text();

		expect(sitemapText).toContain('<loc>https://www.purveyors.io/benchmarks</loc>');
		expect(sitemapText).toContain(
			'<loc>https://www.purveyors.io/benchmarks</loc>\n\t\t<lastmod>2026-08-19</lastmod>'
		);
		expect(sitemapText).toContain('<loc>https://www.purveyors.io/benchmarks/coffeebench-v0</loc>');
		expect(llms).toContain('[Benchmarks](https://www.purveyors.io/benchmarks)');
		expect(llms).toContain(
			'[CoffeeBench v0 uncalibrated preview](https://www.purveyors.io/benchmarks/coffeebench-v0)'
		);
		expect(llms).toContain('Bradley-Terry quality scores and ranks are unavailable');
	});

	it('marks fixture HTML and JSON machine surfaces noindex at the edge', () => {
		const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
			headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
		};
		expect(
			config.headers.find((entry) => entry.source === '/benchmarks/coffeebench-v0')
		).toBeUndefined();
		for (const source of [
			'/benchmarks/coffeebench-v0/results/(.*)',
			'/benchmarks/coffeebench-public-export-v2.json',
			'/benchmarks/coffeebench-public-export-v3.json'
		]) {
			expect(config.headers.find((entry) => entry.source === source)?.headers).toContainEqual(
				expect.objectContaining({ key: 'X-Robots-Tag', value: expect.stringContaining('noindex') })
			);
		}
	});
});
