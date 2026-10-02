// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getDocsPage } from '$lib/docs/content';
import {
	CLI_ACCESS_OVERRIDES,
	CLI_COPY_REWRITES,
	CLI_INTERNAL_COPY,
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

	it('only rewrites manifest text that still exists in the pinned manifest', () => {
		const texts = new Set<string>(manifest.outputContract.notes);
		manifest.idTypes.forEach((id) => texts.add(id.source));
		for (const group of manifest.commandGroups) {
			texts.add(group.summary);
			for (const command of getGroupCommands(group)) {
				texts.add(command.summary);
				command.notes?.forEach((note) => texts.add(note));
				command.arguments?.forEach((arg) => texts.add(arg.description));
				command.options?.forEach((option) => {
					if (option.description) texts.add(option.description);
					option.notes?.forEach((note) => texts.add(note));
				});
			}
		}
		for (const text of Object.keys(CLI_COPY_REWRITES)) {
			expect(texts.has(text), text).toBe(true);
		}
	});

	it('ends each sentence before the next one starts in flag details', () => {
		for (const slug of Object.values(getCliGroupPageSlugs())) {
			const markdown = renderDocsPageMarkdown(getDocsPage('cli', slug)!, 'https://purveyors.io');
			expect(markdown, slug).not.toMatch(/\) (?:Default|Range|Required unless):/);
		}
	});

	it('keeps CLI implementation detail off every generated page', () => {
		const slugs = new Set(['overview', ...Object.values(getCliGroupPageSlugs())]);
		for (const slug of slugs) {
			const markdown = renderDocsPageMarkdown(getDocsPage('cli', slug)!, 'https://purveyors.io');
			const leaks = markdown.split('\n').filter((line) => CLI_INTERNAL_COPY.test(line));
			expect(leaks, slug).toEqual([]);
		}
	});

	it('applies access overrides only where the manifest still has the listed value', () => {
		for (const [path, override] of Object.entries(CLI_ACCESS_OVERRIDES)) {
			const [, groupName, commandName] = path.split(' ');
			const group = manifest.commandGroups.find((candidate) => candidate.name === groupName);
			const command = group && getGroupCommands(group).find((item) => item.name === commandName);
			expect(command?.auth, path).toBe(override.manifest);
		}
	});

	it('states that any signed-in account or API key with catalog:read can use catalog similar', () => {
		const catalogPage = renderDocsPageMarkdown(
			getDocsPage('cli', 'catalog')!,
			'https://purveyors.io'
		);
		const similar = catalogPage
			.slice(catalogPage.indexOf('## purvey catalog similar'))
			.split('\n## ')[0];
		expect(similar).toContain('catalog:read');
		expect(similar).toContain('Green');
		expect(similar).not.toContain('Requires member access');
		expect(similar).not.toMatch(/paid plan/i);
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
