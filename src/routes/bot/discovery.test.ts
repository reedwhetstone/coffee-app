import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import Footer from '$lib/components/marketing/Footer.svelte';

vi.mock('$lib/server/blog', () => ({
	getAllPosts: vi.fn(async () => [])
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
});
