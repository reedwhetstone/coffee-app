<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { MarketBriefReaderExport } from '$lib/types/blog.types';

	let { slug, reader } = $props<{
		slug: string;
		reader: MarketBriefReaderExport;
	}>();

	let copiedKey = $state<string | null>(null);
	let failedKey = $state<string | null>(null);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	let markdownHeadingId = $derived(`market-wire-markdown-export-${slug}`);

	async function copyValue(key: string, value: string): Promise<void> {
		if (resetTimer) clearTimeout(resetTimer);
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
			await navigator.clipboard.writeText(value);
			copiedKey = key;
			failedKey = null;
		} catch {
			copiedKey = null;
			failedKey = key;
		}
		resetTimer = setTimeout(() => {
			copiedKey = null;
			failedKey = null;
		}, 2000);
	}

	onDestroy(() => {
		if (resetTimer) clearTimeout(resetTimer);
	});
</script>

<section
	class="mt-10 rounded-lg border border-line bg-surface-canvas p-5 sm:p-6"
	aria-labelledby={markdownHeadingId}
>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="max-w-2xl">
			<p class="mb-1 text-xs font-semibold text-accent">Portable edition</p>
			<h2 id={markdownHeadingId} class="font-serif text-2xl font-semibold text-ink">
				Markdown export
			</h2>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Use the clean source in notes, research tools, or any Markdown reader.
			</p>
		</div>
		<div class="flex flex-wrap gap-2 text-sm font-medium">
			<button
				type="button"
				class="rounded-md border border-line px-3 py-2 text-ink transition-colors hover:border-accent hover:text-accent"
				onclick={() => copyValue('markdown', reader.markdown)}
			>
				{copiedKey === 'markdown'
					? 'Markdown copied'
					: failedKey === 'markdown'
						? 'Copy failed'
						: 'Copy Markdown'}
			</button>
			<a
				href={`/blog/${slug}/markdown`}
				download={`${slug}.md`}
				class="rounded-md bg-accent px-3 py-2 text-white transition-opacity hover:opacity-90"
			>
				Download .md
			</a>
		</div>
	</div>

	<details class="mt-5 rounded-md border border-line bg-surface-panel">
		<summary class="cursor-pointer px-4 py-3 text-sm font-medium text-ink">View Markdown</summary>
		<pre
			class="max-h-96 overflow-auto border-t border-line p-4 text-xs leading-relaxed text-ink"><code
				>{reader.markdown}</code
			></pre>
	</details>
	<p class="sr-only" aria-live="polite">
		{copiedKey ? 'Copied to clipboard.' : failedKey ? 'Clipboard copy failed.' : ''}
	</p>
</section>
