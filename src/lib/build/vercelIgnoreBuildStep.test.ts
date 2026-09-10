import { describe, expect, it } from 'vitest';
import { resolveComparisonRange, shouldBuild } from '../../../scripts/vercel-ignore-build-step.mjs';

describe('Vercel ignored build step', () => {
	it('skips documentation, tests, and repository-only metadata', () => {
		expect(
			shouldBuild([
				'notes/LOCAL_VALIDATION.md',
				'src/lib/example.test.ts',
				'src/lib/components/__test-fixtures__/Harness.svelte',
				'.github/workflows/check.yml'
			])
		).toBe(false);
	});

	it('builds when any runtime-affecting file changes', () => {
		expect(shouldBuild(['README.md', 'src/routes/+page.svelte'])).toBe(true);
		expect(shouldBuild(['static/blog/images/example/hero.webp'])).toBe(true);
		expect(shouldBuild(['package.json'])).toBe(true);
	});

	it('uses Vercel commit variables when available', () => {
		expect(
			resolveComparisonRange({
				VERCEL_GIT_PREVIOUS_SHA: 'previous',
				VERCEL_GIT_COMMIT_SHA: 'current'
			})
		).toEqual(['previous', 'current']);
	});

	it('falls back to the current commit parent outside Vercel', () => {
		expect(resolveComparisonRange({})).toEqual(['HEAD^', 'HEAD']);
	});
});
