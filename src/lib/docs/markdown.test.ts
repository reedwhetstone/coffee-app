import { describe, expect, it } from 'vitest';

import { getPublishedDocsPages, getPublishedDocsSections } from '$lib/docs/content';
import { docsMarkdownPath } from '$lib/docs/markdown';
import { GET as getPageMarkdown } from '../../routes/docs/[section]/[slug].md/+server';
import { GET as getSectionMarkdown } from '../../routes/docs/[section].md/+server';
import { GET as getIndexMarkdown } from '../../routes/docs.md/+server';
import { GET as getLlmsFull } from '../../routes/llms-full.txt/+server';
import { GET as getLlms } from '../../routes/llms.txt/+server';

const origin = 'https://purveyors.io';

type Handler = (event: never) => Promise<Response> | Response;

function call(handler: Handler, path: string, params: Record<string, string> = {}) {
	return handler({ params, url: new URL(`${origin}${path}`) } as never);
}

async function expectRedirect(promise: Promise<Response> | Response, location: string) {
	await expect(Promise.resolve(promise)).rejects.toMatchObject({ status: 307, location });
}

describe('docs Markdown twins', () => {
	const pages = getPublishedDocsPages();

	it('publishes every navigation item as a page', () => {
		const navCount = getPublishedDocsSections().reduce(
			(count, section) => count + section.items.length,
			0
		);
		expect(pages).toHaveLength(navCount);
	});

	it.each(pages.map((page) => [docsMarkdownPath(page), page] as const))(
		'%s returns 200 Markdown from the same page data',
		async (path, page) => {
			const response = await call(getPageMarkdown as Handler, path, {
				section: page.section,
				slug: page.slug
			});
			const body = await response.text();

			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
			expect(body.startsWith(`# ${page.title}\n`)).toBe(true);
			expect(body).toContain(`HTML version: ${origin}/docs/${page.section}/${page.slug}`);
			for (const section of page.sections) {
				expect(body).toContain(`\n## ${section.title}\n`);
			}
		}
	);

	it('returns 404 for unknown pages and redirects API pages to the generated reference', async () => {
		await expect(
			Promise.resolve(
				call(getPageMarkdown as Handler, '/docs/cli/missing.md', {
					section: 'cli',
					slug: 'missing'
				})
			)
		).rejects.toMatchObject({ status: 404 });
		await expectRedirect(
			call(getPageMarkdown as Handler, '/docs/api/catalog.md', { section: 'api', slug: 'catalog' }),
			'https://api.purveyors.io/docs'
		);
	});

	it.each(getPublishedDocsSections().map((section) => [section.key]))(
		'/docs/%s.md lists every page in the section',
		async (key) => {
			const response = await call(getSectionMarkdown as Handler, `/docs/${key}.md`, {
				section: key
			});
			const body = await response.text();
			expect(response.status).toBe(200);
			expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
			for (const page of pages.filter((candidate) => candidate.section === key)) {
				expect(body).toContain(`${origin}${docsMarkdownPath(page)}`);
			}
		}
	);

	it('indexes every page in /docs.md and /llms-full.txt', async () => {
		const index = await (await call(getIndexMarkdown as Handler, '/docs.md')).text();
		const full = await (await call(getLlmsFull as Handler, '/llms-full.txt')).text();

		expect(index).toContain(`${origin}/docs/agents/setup.md`);
		for (const page of pages) {
			expect(index).toContain(`${origin}${docsMarkdownPath(page)}`);
			expect(full).toContain(`Source: ${origin}${docsMarkdownPath(page)}`);
			expect(full).toContain(`\n# ${page.title}\n`);
		}
	});

	it('leads llms.txt with a For AI agents section', async () => {
		const body = await (await call(getLlms as Handler, '/llms.txt')).text();
		const agentsIndex = body.indexOf('## For AI agents');

		expect(agentsIndex).toBeGreaterThan(-1);
		expect(agentsIndex).toBeLessThan(body.indexOf('## Public Pages'));
		expect(body).toContain(`${origin}/docs/agents/setup.md`);
		expect(body).toContain(`${origin}/llms-full.txt`);
		expect(body).toContain(`${origin}/docs.md`);
	});
});
