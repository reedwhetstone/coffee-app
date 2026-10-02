// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getDocsPage } from '$lib/docs/content';
import {
	CLI_NOTE_EXCLUSIONS,
	CLI_REFERENCE,
	getCliGroupPageSlugs,
	getGroupCommands
} from '$lib/docs/cliReference';
import { renderDocsPageMarkdown } from '$lib/docs/markdown';

const manifest = CLI_REFERENCE.manifest;

function commandTitle(groupName: string, commandName: string): string {
	return commandName === groupName ? `purvey ${groupName}` : `purvey ${groupName} ${commandName}`;
}

describe('generated CLI reference', () => {
	it('matches the pinned @purveyors/cli package', async () => {
		const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
		const { buildCliReferenceSnapshot, serializeCliReferenceSnapshot } = await import(
			'../../../scripts/generate-cli-reference.mjs'
		);

		expect(pkg.devDependencies['@purveyors/cli']).toBe(CLI_REFERENCE.version);
		const committed = readFileSync(resolve('src/lib/docs/generated/cli-manifest.json'), 'utf8');
		expect(committed).toBe(serializeCliReferenceSnapshot(await buildCliReferenceSnapshot()));
	});

	it('documents every manifest command group and command on a docs page', () => {
		const slugs = getCliGroupPageSlugs();
		expect(manifest.commandGroups.length).toBeGreaterThan(0);

		for (const group of manifest.commandGroups) {
			const page = getDocsPage('cli', slugs[group.name]);
			expect(page, `page for ${group.name}`).toBeDefined();
			const titles = page!.sections.map((section) => section.title);
			for (const command of getGroupCommands(group)) {
				expect(titles).toContain(commandTitle(group.name, command.name));
			}
		}
	});

	it('closes the market, price-index, procurement, and reference-profile gaps', () => {
		for (const slug of ['market', 'price-index', 'procurement', 'reference-profile']) {
			expect(getDocsPage('cli', slug), slug).toBeDefined();
		}
	});

	it('renders every documented flag from the manifest', () => {
		const slugs = getCliGroupPageSlugs();
		for (const group of manifest.commandGroups) {
			const markdown = renderDocsPageMarkdown(
				getDocsPage('cli', slugs[group.name])!,
				'https://purveyors.io'
			);
			for (const command of getGroupCommands(group)) {
				for (const option of command.options ?? []) {
					expect(markdown).toContain(`\`${option.flags.split('|').join('\\|')}\``);
				}
			}
		}
	});

	it('only excludes notes that still exist in the pinned manifest', () => {
		const notes = new Set<string>();
		for (const group of manifest.commandGroups) {
			for (const command of getGroupCommands(group)) {
				command.notes?.forEach((note) => notes.add(note));
				command.options?.forEach((option) => option.notes?.forEach((note) => notes.add(note)));
			}
		}
		for (const excluded of CLI_NOTE_EXCLUSIONS) {
			expect(notes.has(excluded), excluded).toBe(true);
		}
	});
});

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return /\.(svelte|ts|js)$/.test(entry) && !/\.test\.ts$/.test(entry) ? [path] : [];
	});
}

describe('CLI dependency boundary (ADR-017)', () => {
	const files = sourceFiles(resolve('src'));

	it('never imports CLI runtime code into app source', () => {
		for (const file of files) {
			const source = readFileSync(file, 'utf8');
			const runtimeImports = source.match(
				/^import\s+(?!type\b)[^;]*from\s+'@purveyors\/cli[^']*'/gm
			);
			expect(runtimeImports, file).toBeNull();
		}
	});

	it('keeps docs content and the manifest snapshot out of browser components', () => {
		for (const file of files.filter((path) => path.endsWith('.svelte'))) {
			const source = readFileSync(file, 'utf8');
			expect(source, file).not.toMatch(/from '\$lib\/docs\/(content|cliReference|markdown)'/);
			expect(source, file).not.toContain('cli-manifest.json');
		}
	});
});
