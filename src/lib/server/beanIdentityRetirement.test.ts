import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const retiredModule = resolve('src/lib/server/beanIdentity.ts');
const retiredTest = resolve('src/lib/server/beanIdentity.test.ts');
const sourceRoot = resolve('src');

function runtimeSourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return runtimeSourceFiles(path);
		if (!entry.isFile() || !/\.(?:ts|svelte)$/.test(entry.name)) return [];
		if (/\.(?:test|spec)\.ts$/.test(entry.name)) return [];
		if (path.endsWith('/src/lib/types/database.types.ts')) return [];
		return [path];
	});
}

describe('bean identity helper retirement', () => {
	it('keeps the orphaned helper and its implementation tests deleted', () => {
		expect(existsSync(retiredModule)).toBe(false);
		expect(existsSync(retiredTest)).toBe(false);
	});

	it('prevents direct identity-table and review-RPC access from returning to runtime source', () => {
		const forbidden = [
			/\.from\(\s*['"]bean_(?:identities|identity_links|identity_events)['"]\s*\)/,
			/\.rpc\(\s*['"](?:create_bean_identity_candidate|review_bean_identity_link)['"]/
		];
		const offenders = runtimeSourceFiles(sourceRoot).filter((file) => {
			const source = readFileSync(file, 'utf8');
			return forbidden.some((pattern) => pattern.test(source));
		});

		expect(offenders).toEqual([]);
	});
});
