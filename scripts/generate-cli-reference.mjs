#!/usr/bin/env node
// Snapshot the published @purveyors/cli manifest as plain JSON for the /docs/cli reference.
// Runs at build time; coffee-app never imports CLI code at runtime (ADR-017).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CLI_REFERENCE_PATH = resolve(repoRoot, 'src/lib/docs/generated/cli-manifest.json');

function readCliPackageJson() {
	const require = createRequire(import.meta.url);
	// package.json is not in the CLI's export map, so walk up from the manifest entry.
	let dir = dirname(require.resolve('@purveyors/cli/manifest'));
	for (;;) {
		try {
			const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
			if (pkg.name === '@purveyors/cli') return pkg;
		} catch {
			// keep walking
		}
		const parent = dirname(dir);
		if (parent === dir) throw new Error('Could not locate @purveyors/cli/package.json');
		dir = parent;
	}
}

export async function buildCliReferenceSnapshot() {
	const { getCliManifest } = await import('@purveyors/cli/manifest');
	const pkg = readCliPackageJson();
	return {
		packageName: pkg.name,
		version: pkg.version,
		nodeEngine: pkg.engines?.node ?? null,
		manifest: getCliManifest()
	};
}

/** @param {Awaited<ReturnType<typeof buildCliReferenceSnapshot>>} snapshot */
export function serializeCliReferenceSnapshot(snapshot) {
	return `${JSON.stringify(snapshot, null, '\t')}\n`;
}

async function main() {
	const check = process.argv.includes('--check');
	const next = serializeCliReferenceSnapshot(await buildCliReferenceSnapshot());
	let current = null;
	try {
		current = readFileSync(CLI_REFERENCE_PATH, 'utf8');
	} catch {
		current = null;
	}

	if (check) {
		if (current !== next) {
			console.error(
				'CLI reference snapshot is stale. Run `pnpm docs:cli-reference` and commit the result.'
			);
			process.exit(1);
		}
		console.log('CLI reference snapshot matches the installed @purveyors/cli manifest.');
		return;
	}

	mkdirSync(dirname(CLI_REFERENCE_PATH), { recursive: true });
	if (current !== next) writeFileSync(CLI_REFERENCE_PATH, next);
	const { version } = JSON.parse(next);
	console.log(`CLI reference snapshot written from @purveyors/cli@${version}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
