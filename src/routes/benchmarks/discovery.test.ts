import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import Footer from '$lib/components/marketing/Footer.svelte';
import { publicNavItems } from '$lib/components/layout/appNavigation';

vi.mock('$lib/server/blog', () => ({
	getAllPosts: vi.fn(async () => [])
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

	it('includes the index and versioned report in sitemap and llms.txt', async () => {
		const url = new URL('https://www.purveyors.io/');
		const sitemap = await getSitemap({ url } as never);
		const llmsText = await getLlmsText({ url } as never);
		const sitemapText = await sitemap.text();
		const llms = await llmsText.text();

		expect(sitemapText).toContain('<loc>https://www.purveyors.io/benchmarks</loc>');
		expect(sitemapText).toContain('<loc>https://www.purveyors.io/benchmarks/coffeebench-v0</loc>');
		expect(llms).toContain('[Benchmarks](https://www.purveyors.io/benchmarks)');
		expect(llms).toContain('[CoffeeBench v0](https://www.purveyors.io/benchmarks/coffeebench-v0)');
	});
});
