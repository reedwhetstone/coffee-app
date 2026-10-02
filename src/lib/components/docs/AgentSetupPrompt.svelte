<script lang="ts" module>
	export const AGENT_SETUP_URL = 'https://purveyors.io/docs/agents/setup.md';
	export const AGENT_SETUP_PROMPT = `Read ${AGENT_SETUP_URL} and follow it to install the Purveyors CLI, sign me in, and install the Purveyors skill.`;
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';

	let { title = 'Set up your agent', showSetupLink = true } = $props<{
		title?: string;
		showSetupLink?: boolean;
	}>();

	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	async function copyPrompt(): Promise<void> {
		if (resetTimer) clearTimeout(resetTimer);
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
			await navigator.clipboard.writeText(AGENT_SETUP_PROMPT);
			copyState = 'copied';
		} catch {
			copyState = 'failed';
		}
		resetTimer = setTimeout(() => {
			copyState = 'idle';
		}, 2000);
	}

	onDestroy(() => {
		if (resetTimer) clearTimeout(resetTimer);
	});
</script>

<section
	class="rounded-lg border border-line bg-surface-canvas p-5 shadow-sm sm:p-6"
	aria-labelledby="agent-setup-prompt-heading"
>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="max-w-2xl">
			<p class="mb-1 text-xs font-semibold text-accent">For AI agents</p>
			<h2
				id="agent-setup-prompt-heading"
				class="font-serif text-2xl font-medium tracking-tight text-ink"
			>
				{title}
			</h2>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Paste this into Claude Code, Codex, Cursor, or any agent that can run commands. It installs
				the Purveyors CLI, asks you to approve sign-in in your browser, and adds the Purveyors
				skill.
			</p>
		</div>
		<button
			type="button"
			class="shrink-0 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
			onclick={copyPrompt}
		>
			{copyState === 'copied'
				? 'Prompt copied'
				: copyState === 'failed'
					? 'Copy failed'
					: 'Copy prompt'}
		</button>
	</div>

	<div class="mt-4 overflow-hidden rounded-2xl border border-line bg-surface-panel">
		<pre class="whitespace-pre-wrap px-4 py-4 text-xs leading-relaxed text-ink sm:text-sm"><code
				>{AGENT_SETUP_PROMPT}</code
			></pre>
	</div>
	<p class="mt-3 text-xs leading-relaxed text-muted">
		Agents that cannot run commands, such as Claude Desktop and ChatGPT, cannot complete this setup
		yet.
		{#if showSetupLink}
			<a href="/docs/agents/setup" class="text-accent hover:underline">Read the setup steps</a>.
		{/if}
	</p>
	<p class="sr-only" aria-live="polite">
		{copyState === 'copied'
			? 'Prompt copied to clipboard.'
			: copyState === 'failed'
				? 'Clipboard copy failed.'
				: ''}
	</p>
</section>
