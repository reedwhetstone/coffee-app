import { describe, expect, it } from 'vitest';

import { getDocsPage } from '$lib/docs/content';
import { CLI_REFERENCE, formatNodeRequirement } from '$lib/docs/cliReference';
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

	it('is what the copyable setup prompt points to', () => {
		expect(AGENT_SETUP_PROMPT).toContain('https://purveyors.io/docs/agents/setup.md');
		expect(AGENT_SETUP_PROMPT).not.toMatch(/api key/i);
	});
});
