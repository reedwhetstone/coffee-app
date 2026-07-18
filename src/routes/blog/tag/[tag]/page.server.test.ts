import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

function loadTag(tag: string) {
	return load({
		params: { tag },
		url: new URL(`https://purveyors.io/blog/tag/${tag}`)
	} as never);
}

describe('/blog/tag/[tag]', () => {
	it('permanently redirects retired tags to their canonical destination', async () => {
		await expect(loadTag('agentic')).rejects.toMatchObject({
			status: 308,
			location: '/blog/tag/agents'
		});
	});

	it('returns 404 for unknown tags', async () => {
		await expect(loadTag('not-a-real-tag')).rejects.toMatchObject({
			status: 404,
			body: { message: 'Blog tag not found' }
		});
	});
});
