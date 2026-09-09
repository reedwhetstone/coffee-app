import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

const runtimeFiles = globSync('src/**/*.{ts,svelte}', {
	ignore: ['src/**/*.test.ts', 'src/lib/types/database.types.ts']
});

describe('conversation state ownership boundary', () => {
	it('keeps all active conversation persistence behind Parchment', () => {
		for (const file of runtimeFiles) {
			const source = readFileSync(file, 'utf8');
			expect(source, file).not.toMatch(
				/\.from\(['"](?:workspaces|workspace_messages|user_memory)['"]\)/
			);
		}
	});

	it('pins the published conversation SDK contract', () => {
		const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
		expect(manifest.dependencies['@purveyors/sdk']).toBe('0.40.0');
	});

	it('carries every optimistic-concurrency token through the browser store', () => {
		const store = readFileSync('src/lib/stores/workspaceStore.svelte.ts', 'utf8');
		expect(store).toContain('expected_reset_epoch');
		expect(store).toContain('expected_canvas_version');
		expect(store).toContain('next_message_sequence');
		const memory = readFileSync('src/lib/components/chat/MemoryPanel.svelte', 'utf8');
		expect(memory).toContain('expected_version');
	});
});
