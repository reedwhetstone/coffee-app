import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const NON_RUNTIME_PATHS = [
	/^\.claude\//,
	/^\.github\//,
	/^notes\//,
	/^tests\//,
	/^playwright-report\//,
	/^(?:AGENTS|CLAUDE|GEMINI|README)\.md$/,
	/^\.cursorrules$/,
	/(?:^|\/)__test-fixtures__\//,
	/\.(?:fixture|spec|test)\.[cm]?[jt]sx?$/
];

/** @param {string[]} changedPaths */
export function shouldBuild(changedPaths) {
	return changedPaths.some((path) => !NON_RUNTIME_PATHS.some((pattern) => pattern.test(path)));
}

export function resolveComparisonRange(environment = process.env) {
	const current = environment.VERCEL_GIT_COMMIT_SHA || 'HEAD';
	const previous = environment.VERCEL_GIT_PREVIOUS_SHA || `${current}^`;
	return [previous, current];
}

function main() {
	const range = resolveComparisonRange();
	let changedPaths;
	try {
		changedPaths = execFileSync('git', ['diff', '--name-only', ...range], {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe']
		})
			.split('\n')
			.filter(Boolean);
	} catch {
		console.error('Unable to establish a safe comparison range; continuing with the build.');
		process.exit(1);
	}

	if (shouldBuild(changedPaths)) {
		console.log('Runtime-affecting files changed; continuing with the build.');
		process.exit(1);
	}

	console.log('Only documentation, tests, or repository metadata changed; skipping the build.');
	process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
