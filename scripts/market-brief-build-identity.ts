/** Only these non-secret Vercel build fields may enter the application bundle. */
export function marketBriefBuildIdentity(environment: Record<string, string | undefined>) {
	const target = environment.VERCEL_ENV;
	const commit = environment.VERCEL_GIT_COMMIT_SHA;
	if (environment.VERCEL === '1' && !target) {
		throw new Error('Market Brief Vercel build requires an explicit deployment target');
	}
	if (target === 'production' && !/^[0-9a-f]{40}$/.test(commit ?? '')) {
		throw new Error('Market Brief production build requires an exact Vercel Git commit');
	}
	return target === 'production'
		? { VERCEL_ENV: target, VERCEL_GIT_COMMIT_SHA: commit! }
		: { VERCEL_ENV: target ?? 'development' };
}
