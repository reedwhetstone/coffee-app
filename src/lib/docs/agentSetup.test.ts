import { describe, expect, it } from 'vitest';

import { getDocsPage, getPublishedDocsPages } from '$lib/docs/content';
import { CLI_REFERENCE, formatNodeRequirement, getGroupCommands } from '$lib/docs/cliReference';
import { renderDocsPageMarkdown } from '$lib/docs/markdown';
import { AGENT_SETUP_PROMPT } from '$lib/components/docs/AgentSetupPrompt.svelte';

const page = getDocsPage('agents', 'setup');
const markdown = page ? renderDocsPageMarkdown(page, 'https://purveyors.io') : '';

describe('agent setup page', () => {
	it('exists with a Markdown twin', () => {
		expect(page).toBeDefined();
		expect(markdown.startsWith('# Set up your agent\n')).toBe(true);
	});

	it('walks through install, headless browser sign-in, status, skill install, and a first command in order', () => {
		const steps = [
			'npm install -g @purveyors/cli',
			'purvey auth login --headless',
			'purvey auth status',
			'purvey skill install --target',
			'purvey catalog search'
		];
		const positions = steps.map((step) => markdown.indexOf(step));
		positions.forEach((position, index) => expect(position, steps[index]).toBeGreaterThan(-1));
		expect([...positions].sort((a, b) => a - b)).toEqual(positions);
	});

	it('states the Node requirement from the CLI package engines field', () => {
		expect(CLI_REFERENCE.nodeEngine).toBeTruthy();
		expect(markdown).toContain(formatNodeRequirement(CLI_REFERENCE.nodeEngine));
	});

	it('relies on browser approval and never asks for or supplies an API key', () => {
		expect(markdown).toContain('approve access');
		expect(markdown).toContain('Never ask for an API key');
		expect(markdown).not.toMatch(/export\s+(PARCHMENT|PURVEYORS)_API_KEY/);
		expect(markdown).not.toMatch(/(PARCHMENT|PURVEYORS)_API_KEY\s*=/);
		expect(markdown).not.toMatch(/--api-key|--token/);
		expect(markdown).not.toMatch(/paste (your|the) (api )?key/i);
		// No credential-shaped strings.
		expect(markdown).not.toMatch(/\b[A-Za-z0-9_-]{32,}\b/);
	});

	it('names the agents that cannot follow it yet and has troubleshooting', () => {
		expect(markdown).toContain('Claude Desktop and ChatGPT');
		expect(markdown).toContain('## Troubleshooting');
	});

	it('sends Claude Code to --target claude and Agent Skills tools to --target agents', () => {
		expect(markdown).toContain('`--target claude` if you are Claude Code');
		expect(markdown).toContain('`--target agents` if you are Codex, Cursor');
		expect(markdown).toContain('| Claude Code | `purvey skill install --target claude` |');
	});

	it('describes the skill as the two files the CLI writes', () => {
		// purveyors-cli#150 writes SKILL.md plus workflows.md for --target claude and agents.
		expect(markdown).toContain('SKILL.md, the guide your agent loads first, and workflows.md');
		expect(markdown).toContain('The command writes both.');
		expect(markdown).not.toMatch(/where the file will go/);
	});

	it('links repo-level AGENTS.md instructions so Claude Code reads them past a CLAUDE.md', () => {
		expect(markdown).toContain('purvey skill install --target agents-md --link-claude-md');
		expect(markdown).toContain(
			'Claude Code reads AGENTS.md only when there is no CLAUDE.md, .claude/CLAUDE.md, or CLAUDE.local.md'
		);
		expect(markdown).toContain('never edits CLAUDE.local.md');
	});

	it('uses only skill install flags and targets that the pinned CLI ships', () => {
		const install = getGroupCommands(
			CLI_REFERENCE.manifest.commandGroups.find((group) => group.name === 'skill')!
		).find((command) => command.name === 'install');
		expect(install).toBeDefined();
		const optionFlags = (install!.options ?? []).map((option) => option.flags);
		const flags = new Set(optionFlags.map((spec) => spec.match(/--[a-z-]+/)![0]));
		// The manifest lists targets in the option description: "claude, agents, or agents-md".
		const targetOption = install!.options?.find((option) => option.flags.startsWith('--target'));
		const targets = new Set(targetOption?.description?.match(/[a-z][a-z-]*/g) ?? []);
		expect(targets).toContain('claude');
		const invocations = [...markdown.matchAll(/purvey skill install([^`\n]*)/g)];
		expect(invocations.length).toBeGreaterThan(0);
		for (const [, args] of invocations) {
			for (const flag of args.match(/--[a-z-]+/g) ?? []) expect(flags, flag).toContain(flag);
			const target = args.match(/--target ([a-z-]+)/)?.[1];
			if (target) expect(targets, target).toContain(target);
		}
		for (const flag of markdown.match(/--(?:scope|force|dry-run|link-claude-md)\b/g) ?? []) {
			expect(flags, flag).toContain(flag);
		}
	});

	it('is what the copyable setup prompt points to', () => {
		expect(AGENT_SETUP_PROMPT).toContain('https://purveyors.io/docs/agents/setup.md');
		expect(AGENT_SETUP_PROMPT).not.toMatch(/api key/i);
	});
});

/** Words that follow "purvey" in prose, such as "purvey gives you". */
const PROSE_AFTER_PURVEY = new Set(['did', 'gives', 'in', 'signs', 'to']);

describe('docs command references', () => {
	const groups = new Map(
		CLI_REFERENCE.manifest.commandGroups.map((group) => [
			group.name,
			{
				hasRoot: Boolean(group.command),
				subcommands: new Set(getGroupCommands(group).map((command) => command.name))
			}
		])
	);

	it('only names commands the pinned CLI ships', () => {
		for (const docsPage of getPublishedDocsPages()) {
			const text = renderDocsPageMarkdown(docsPage, 'https://purveyors.io');
			for (const [, groupName, next] of text.matchAll(
				/\bpurvey ([a-z][a-z-]*)(?: ([a-z][a-z-]*))?/g
			)) {
				const group = groups.get(groupName);
				const where = `${docsPage.section}/${docsPage.slug}: purvey ${groupName} ${next ?? ''}`;
				if (!group && PROSE_AFTER_PURVEY.has(groupName)) continue;
				expect(group, where).toBeDefined();
				if (next && !group!.hasRoot) expect(group!.subcommands.has(next), where).toBe(true);
			}
		}
	});
});
