<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { MarketBriefReaderExport } from '$lib/types/blog.types';

	let { editionTitle, slug, reader } = $props<{
		editionTitle: string;
		slug: string;
		reader: MarketBriefReaderExport;
	}>();

	let copiedKey = $state<string | null>(null);
	let failedKey = $state<string | null>(null);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	let shareHeadingId = $derived(`market-wire-share-controls-${slug}`);
	let markdownHeadingId = $derived(`market-wire-markdown-export-${slug}`);

	function sectionUrl(id: string): string {
		return `${reader.canonicalUrl}#${encodeURIComponent(id)}`;
	}

	function redditUrl(id: string, title: string): string {
		const url = new URL('https://www.reddit.com/submit');
		url.searchParams.set('url', sectionUrl(id));
		url.searchParams.set('title', `${title} · ${editionTitle}`);
		return url.toString();
	}

	function xUrl(id: string, title: string): string {
		const url = new URL('https://twitter.com/intent/tweet');
		url.searchParams.set('url', sectionUrl(id));
		url.searchParams.set('text', `${title} · ${editionTitle}`);
		return url.toString();
	}

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

{#if reader.sections.length > 0}
	<section
		class="mt-14 rounded-lg border border-line bg-surface-canvas p-5 sm:p-6"
		aria-labelledby={shareHeadingId}
	>
		<div class="mb-5 max-w-2xl">
			<p class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">Market Wire</p>
			<h2 id={shareHeadingId} class="font-serif text-2xl font-semibold text-ink">
				Share an individual take
			</h2>
			<p class="mt-2 text-sm leading-relaxed text-muted">
				Each section has a stable link, so you can share the useful part without sending the full
				edition.
			</p>
		</div>

		<ul class="space-y-3">
			{#each reader.sections as section}
				<li class="rounded-md border border-line bg-surface-panel p-4">
					<a
						class="font-serif text-lg font-medium text-ink underline decoration-accent/40 underline-offset-4 hover:text-accent"
						href={`#${section.id}`}
					>
						{section.title}
					</a>
					<div class="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium">
						<button
							type="button"
							class="rounded-md border border-line px-3 py-1.5 text-ink transition-colors hover:border-accent hover:text-accent"
							onclick={() => copyValue(`section:${section.id}`, sectionUrl(section.id))}
						>
							{copiedKey === `section:${section.id}`
								? 'Link copied'
								: failedKey === `section:${section.id}`
									? 'Copy failed'
									: 'Copy link'}
						</button>
						<a
							href={redditUrl(section.id, section.title)}
							target="_blank"
							rel="noopener noreferrer"
							class="rounded-md border border-line px-3 py-1.5 text-ink transition-colors hover:border-accent hover:text-accent"
						>
							Reddit
						</a>
						<a
							href={xUrl(section.id, section.title)}
							target="_blank"
							rel="noopener noreferrer"
							class="rounded-md border border-line px-3 py-1.5 text-ink transition-colors hover:border-accent hover:text-accent"
						>
							X
						</a>
					</div>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<section
	class="mt-8 rounded-lg border border-line bg-surface-canvas p-5 sm:p-6"
	aria-labelledby={markdownHeadingId}
>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="max-w-2xl">
			<p class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
				Portable edition
			</p>
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
