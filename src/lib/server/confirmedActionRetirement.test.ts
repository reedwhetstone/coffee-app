import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

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

describe('confirmed-action dispatcher retirement', () => {
	it('prevents the direct database RPC and duplicated mutation dispatcher from returning', () => {
		const offenders = runtimeSourceFiles(sourceRoot).filter((file) => {
			const source = readFileSync(file, 'utf8');
			return /\.rpc\(\s*['"]execute_chat_action['"]/.test(source);
		});

		expect(offenders).toEqual([]);
	});
});
