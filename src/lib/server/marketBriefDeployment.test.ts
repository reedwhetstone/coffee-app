import { describe, expect, it } from 'vitest';
import { marketBriefBuildIdentity } from '../../../scripts/market-brief-build-identity';

describe('Market Brief build provenance', () => {
	it('does not silently treat missing Vercel system fields as a local build', () => {
		expect(() => marketBriefBuildIdentity({ VERCEL: '1' })).toThrow(
			'requires an explicit deployment target'
		);
	});
	it('captures only the exact production identity, never unrelated environment values', () => {
		expect(
			marketBriefBuildIdentity({
				VERCEL_ENV: 'production',
				VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
				UNRELATED_VALUE: 'must-not-enter-bundle'
			})
		).toEqual({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) });
	});

	it.each([undefined, '', 'main', 'a'.repeat(7), 'g'.repeat(40)])(
		'rejects a production build without an exact commit (%s)',
		(commit) => {
			expect(() =>
				marketBriefBuildIdentity({ VERCEL_ENV: 'production', VERCEL_GIT_COMMIT_SHA: commit })
			).toThrow('requires an exact Vercel Git commit');
		}
	);

	it.each([undefined, 'development', 'preview', 'staging'])(
		'keeps non-production builds outside the email identity path (%s)',
		(target) => {
			expect(
				marketBriefBuildIdentity({ VERCEL_ENV: target, VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40) })
			).toEqual({ VERCEL_ENV: target ?? 'development' });
		}
	);
});
