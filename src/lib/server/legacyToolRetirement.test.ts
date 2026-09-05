import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const retiredRoutes = ['bean-tasting', 'coffee-chunks', 'green-coffee-inv', 'roast-profiles'];
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

describe('legacy tool route retirement', () => {
	it('keeps all four compatibility routes and the route-only RAG helper deleted', () => {
		for (const route of retiredRoutes) {
			expect(existsSync(resolve(`src/routes/api/tools/${route}/+server.ts`))).toBe(false);
		}
		expect(existsSync(resolve('src/lib/services/ragService.ts'))).toBe(false);
	});

	it('prevents the retired RAG RPC and route paths from returning to runtime source', () => {
		const forbidden = [
			/\.rpc\(\s*['"]match_coffee_chunks['"]/,
			/\/api\/tools\/(?:bean-tasting|coffee-chunks|green-coffee-inv|roast-profiles)/
		];
		const offenders = runtimeSourceFiles(sourceRoot).filter((file) => {
			const source = readFileSync(file, 'utf8');
			return forbidden.some((pattern) => pattern.test(source));
		});

		expect(offenders).toEqual([]);
	});

	it('retains the shared provider credential while active callers still need it', () => {
		for (const path of [
			'src/routes/api/chat/+server.ts',
			'src/routes/api/workspaces/[id]/summarize/+server.ts',
			'src/routes/api/memory/dream/+server.ts'
		]) {
			expect(readFileSync(resolve(path), 'utf8')).toContain('OPENROUTER_API_KEY');
		}
	});
});
