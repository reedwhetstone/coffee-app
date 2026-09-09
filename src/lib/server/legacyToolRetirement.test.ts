import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const retiredRoutes = ['bean-tasting', 'coffee-chunks', 'green-coffee-inv', 'roast-profiles'];
const retiredChatRuntimePaths = [
	'src/lib/services/tools.ts',
	'src/lib/services/tools/index.ts',
	'src/lib/services/tools/catalogTools.ts',
	'src/lib/services/tools/inventoryTools.ts',
	'src/lib/services/tools/marketTools.ts',
	'src/lib/services/tools/presentationTools.ts',
	'src/lib/services/tools/roastTools.ts',
	'src/lib/services/tools/tastingTools.ts',
	'src/lib/server/agentPriceIndex.ts',
	'src/lib/server/agentSimilarity.ts'
];
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
		for (const path of retiredChatRuntimePaths) {
			expect(existsSync(resolve(path))).toBe(false);
		}
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

	it('keeps provider credentials and orchestration out of production BFF routes', () => {
		const dreamRoute = readFileSync(resolve('src/routes/api/memory/dream/+server.ts'), 'utf8');
		const chatRoute = readFileSync(resolve('src/routes/api/chat/+server.ts'), 'utf8');
		for (const retiredProviderDependency of [
			'OPENROUTER_API_KEY',
			'openrouter.ai',
			'CHERRY_RUNTIME_MODEL',
			'createOpenAI',
			'streamText',
			'createChatTools'
		]) {
			expect(chatRoute).not.toContain(retiredProviderDependency);
			expect(dreamRoute).not.toContain(retiredProviderDependency);
		}
		expect(chatRoute).toContain('client.conversation.chat.stream');
		expect(dreamRoute).toContain('dreamConversationMemory');
		const providerOffenders = runtimeSourceFiles(sourceRoot).filter((file) => {
			const source = readFileSync(file, 'utf8');
			return source.includes('OPENROUTER_API_KEY') || source.includes('openrouter.ai');
		});
		expect(providerOffenders).toEqual([]);
		const summaryRoute = readFileSync(
			resolve('src/routes/api/workspaces/[id]/summarize/+server.ts'),
			'utf8'
		);
		for (const retiredSummaryDependency of [
			'OPENROUTER_API_KEY',
			'openrouter.ai',
			'CHERRY_RUNTIME_MODEL'
		]) {
			expect(summaryRoute).not.toContain(retiredSummaryDependency);
		}
	});
});
