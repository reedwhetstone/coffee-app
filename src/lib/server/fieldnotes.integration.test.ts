import { describe, expect, it } from 'vitest';
import { compile } from 'mdsvex';
import type { BlogPostFrontmatter } from '$lib/types/blog.types';
import { getAllPosts, normalizeBlogPost } from './blog';
import { buildMarketBriefReaderExport } from './marketBriefReader';
import { buildMarketBriefEmailProjection } from './marketBriefEmail';
import source from './fixtures/fieldnotes-generated.txt?raw';

describe('Fieldnotes scraper-to-reader contract', () => {
	it('admits the exact generated sample into web, email, and Markdown without publishing it', async () => {
		const compiled = await compile(source);
		const metadata = compiled?.data?.fm as BlogPostFrontmatter;
		const post = normalizeBlogPost('market-brief-003', metadata);
		expect(post).toMatchObject({
			newsletter: 'fieldnotes',
			tags: ['coffee', 'technology', 'ideas'],
			edition: 3
		});
		const reader = buildMarketBriefReaderExport(post, source);
		const email = buildMarketBriefEmailProjection(post, source);
		expect(reader.sections).toHaveLength(3);
		expect(reader.sections.every((section) => section.kind === 'take')).toBe(true);
		expect(reader.markdown).toContain('https://research.google/blog/timesfm-3-');
		expect(email.subject).toBe('Fieldnotes 003 · What your coffee tools leave out');
		expect(email.html).toContain('Purveyors Fieldnotes · Edition 003');
		expect(email.text).toContain('Automation needs a window, not just a button');
		expect((await getAllPosts()).some((published) => published.slug === 'market-brief-003')).toBe(
			false
		);
	});
});
