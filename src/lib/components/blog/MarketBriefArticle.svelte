<script lang="ts">
	import { onDestroy } from 'svelte';
	import TastingNotesRadar from '$lib/components/TastingNotesRadar.svelte';
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';
	import {
		MARKER_PRIMARY,
		MARKER_SECONDARY,
		NEUTRAL_CATEGORY_COLOR
	} from '$lib/styles/chartColors';
	import type {
		MarketBriefCoffeeHighlight,
		MarketBriefReaderExport,
		MarketBriefReaderSection,
		MarketBriefSnapshot
	} from '$lib/types/blog.types';

	let { title, reader, snapshot, coffeeHighlights } = $props<{
		title: string;
		reader: MarketBriefReaderExport;
		snapshot?: MarketBriefSnapshot;
		coffeeHighlights: MarketBriefCoffeeHighlight[];
	}>();

	let copiedId = $state<string | null>(null);
	let copyFailedId = $state<string | null>(null);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;

	let marketRead = $derived(
		reader.sections.find((section: MarketBriefReaderSection) => section.kind === 'market-read')
	);
	let takes = $derived(
		reader.sections.filter((section: MarketBriefReaderSection) => section.kind === 'take')
	);
	let signalTotal = $derived(Math.max(snapshot?.totalSignals ?? 0, 1));

	function sectionUrl(section: MarketBriefReaderSection): string {
		return `${reader.canonicalUrl}#${encodeURIComponent(section.id)}`;
	}

	function shareUrl(platform: 'reddit' | 'x', section: MarketBriefReaderSection): string {
		const destination =
			platform === 'reddit'
				? new URL('https://www.reddit.com/submit')
				: new URL('https://twitter.com/intent/tweet');
		destination.searchParams.set('url', sectionUrl(section));
		if (platform === 'reddit') destination.searchParams.set('title', `${section.title} · ${title}`);
		else destination.searchParams.set('text', `${section.title} · ${title}`);
		return destination.toString();
	}

	async function copySectionLink(section: MarketBriefReaderSection): Promise<void> {
		if (resetTimer) clearTimeout(resetTimer);
		try {
			if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
			await navigator.clipboard.writeText(sectionUrl(section));
			copiedId = section.id;
			copyFailedId = null;
		} catch {
			copiedId = null;
			copyFailedId = section.id;
		}
		resetTimer = setTimeout(() => {
			copiedId = null;
			copyFailedId = null;
		}, 2000);
	}

	function noteTags(coffee: MarketBriefCoffeeHighlight): string[] {
		if (!coffee.tastingNotes) return [];
		return [
			coffee.tastingNotes.body.tag,
			coffee.tastingNotes.flavor.tag,
			coffee.tastingNotes.acidity.tag,
			coffee.tastingNotes.sweetness.tag,
			coffee.tastingNotes.fragrance_aroma.tag
		];
	}

	function formatDate(value: string): string {
		return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function supplierLabel(value: string): string {
		return value
			.split(/[_-]+/u)
			.map((part) => `${part.charAt(0).toLocaleUpperCase('en-US')}${part.slice(1)}`)
			.join(' ');
	}

	onDestroy(() => {
		if (resetTimer) clearTimeout(resetTimer);
	});
</script>

<div class="space-y-8">
	{#if snapshot}
		<section aria-labelledby="week-in-numbers-heading">
			<div class="mb-3 flex items-end justify-between gap-4">
				<div>
					<p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">At a glance</p>
					<h2 id="week-in-numbers-heading" class="mt-1 font-serif text-3xl font-semibold text-ink">
						This week in numbers
					</h2>
				</div>
				<p class="hidden text-right text-xs text-muted sm:block">
					{snapshot.scope}<br />as of {formatDate(snapshot.asOf)}
				</p>
			</div>

			<div
				class="grid grid-cols-2 divide-line overflow-hidden rounded-xl border border-line bg-surface-raised shadow-sm lg:grid-cols-4 lg:divide-x"
			>
				<div class="border-b border-line p-4 sm:p-5 lg:border-b-0">
					<p class="text-xs font-medium text-muted">7-day movement</p>
					<p class="mt-2 text-3xl font-semibold tabular-nums text-accent">
						{snapshot.movementPercent > 0 ? '+' : ''}{snapshot.movementPercent.toFixed(1)}%
					</p>
					<p class="mt-1 text-xs text-muted">{snapshot.movementLabel} market</p>
				</div>
				<div class="border-b border-line p-4 sm:p-5 lg:border-b-0">
					<p class="text-xs font-medium text-muted">Matched listings</p>
					<p class="mt-2 text-3xl font-semibold tabular-nums text-ink">
						{snapshot.matchedListings}
					</p>
					<p class="mt-1 text-xs text-muted">of {snapshot.listings} observed</p>
				</div>
				<div class="p-4 sm:p-5">
					<p class="text-xs font-medium text-muted">Supplier coverage</p>
					<p class="mt-2 text-3xl font-semibold tabular-nums text-ink">{snapshot.suppliers}</p>
					<p class="mt-1 text-xs text-muted">US green-coffee sources</p>
				</div>
				<div class="p-4 sm:p-5">
					<p class="text-xs font-medium text-muted">Value signals</p>
					<p class="mt-2 text-3xl font-semibold tabular-nums text-ink">
						{snapshot.totalSignals}
					</p>
					<p class="mt-1 text-xs text-muted">worth a closer look</p>
				</div>
			</div>
		</section>
	{/if}

	{#if marketRead}
		<section
			id={marketRead.id}
			class="scroll-mt-28 overflow-hidden rounded-2xl border border-accent/20 bg-gradient-to-br from-surface-canvas via-surface-canvas to-surface-panel shadow-sm"
			aria-labelledby={`${marketRead.id}-heading`}
		>
			<div class="grid {snapshot ? 'lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,0.75fr)]' : ''}">
				<div class="relative p-5 pl-8 sm:p-7 sm:pl-10">
					<AccentSpine />
					<p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Market read</p>
					<h2
						id={`${marketRead.id}-heading`}
						class="mt-2 font-serif text-2xl font-semibold leading-tight text-ink sm:text-3xl"
					>
						{marketRead.title.replace(/^Market read:\s*/i, '')}
					</h2>
					<div class="market-brief-copy mt-4 text-sm leading-7 text-muted sm:text-base">
						<!-- Markdown tokens reject raw HTML and unsafe link protocols before this render. -->
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html marketRead.html}
					</div>
				</div>

				{#if snapshot}
					<div class="border-t border-line bg-surface-panel p-5 sm:p-6 lg:border-l lg:border-t-0">
						<div class="flex items-start justify-between gap-4">
							<div>
								<p class="text-xs font-semibold text-muted">Signal composition</p>
								<p class="mt-1 text-sm text-ink">{snapshot.totalSignals} public signals</p>
							</div>
							<span class="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
								{snapshot.movementLabel}
							</span>
						</div>

						<div class="mt-6 flex h-4 overflow-hidden rounded-full bg-line" aria-hidden="true">
							<div
								style:width={`${(snapshot.belowBenchmark / signalTotal) * 100}%`}
								style:background-color={MARKER_PRIMARY}
							></div>
							<div
								style:width={`${(snapshot.scoreOutliers / signalTotal) * 100}%`}
								style:background-color={MARKER_SECONDARY}
							></div>
							{#if snapshot.priceDrops > 0}
								<div
									style:width={`${(snapshot.priceDrops / signalTotal) * 100}%`}
									style:background-color={NEUTRAL_CATEGORY_COLOR}
								></div>
							{/if}
						</div>

						<dl class="mt-5 space-y-3 text-sm">
							<div class="flex items-center justify-between gap-4">
								<dt class="flex items-center gap-2 text-muted">
									<span class="h-2.5 w-2.5 rounded-full" style:background-color={MARKER_PRIMARY}
									></span>
									Below benchmark
								</dt>
								<dd class="font-semibold tabular-nums text-ink">{snapshot.belowBenchmark}</dd>
							</div>
							<div class="flex items-center justify-between gap-4">
								<dt class="flex items-center gap-2 text-muted">
									<span class="h-2.5 w-2.5 rounded-full" style:background-color={MARKER_SECONDARY}
									></span>
									Supplier-score outliers
								</dt>
								<dd class="font-semibold tabular-nums text-ink">{snapshot.scoreOutliers}</dd>
							</div>
							<div class="flex items-center justify-between gap-4">
								<dt class="flex items-center gap-2 text-muted">
									<span
										class="h-2.5 w-2.5 rounded-full"
										style:background-color={NEUTRAL_CATEGORY_COLOR}
									></span>
									Qualifying price drops
								</dt>
								<dd class="font-semibold tabular-nums text-ink">{snapshot.priceDrops}</dd>
							</div>
						</dl>

						<a
							href="/analytics"
							class="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-link underline decoration-accent/40 underline-offset-4 hover:text-accent"
						>
							Explore market analytics <span aria-hidden="true">→</span>
						</a>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	{#if takes.length > 0}
		<section aria-labelledby="weekly-takes-heading">
			<div class="mb-4">
				<p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
					Reported this week
				</p>
				<h2 id="weekly-takes-heading" class="mt-1 font-serif text-3xl font-semibold text-ink">
					The week’s takes
				</h2>
			</div>

			<div class="space-y-4">
				{#each takes as section, index}
					<article
						id={section.id}
						class="scroll-mt-28 rounded-xl border border-line bg-surface-panel p-5 shadow-sm sm:p-7"
						aria-labelledby={`${section.id}-heading`}
					>
						<div class="grid gap-4 sm:grid-cols-[3.5rem_minmax(0,1fr)]">
							<div
								class="flex h-11 w-11 items-center justify-center rounded-full border border-accent/30 bg-accent/10 font-serif text-lg font-semibold tabular-nums text-accent"
								aria-hidden="true"
							>
								{String(index + 1).padStart(2, '0')}
							</div>
							<div>
								<h3 id={`${section.id}-heading`} class="font-serif text-2xl font-semibold text-ink">
									{section.title}
								</h3>
								<div class="market-brief-copy mt-3 text-base leading-7 text-muted">
									<!-- Markdown tokens reject raw HTML and unsafe link protocols before this render. -->
									<!-- eslint-disable-next-line svelte/no-at-html-tags -->
									{@html section.html}
								</div>

								<div
									class="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4 text-xs font-semibold"
								>
									<button
										type="button"
										class="rounded-full border border-line px-3 py-1.5 text-ink transition-colors hover:border-accent hover:text-accent"
										onclick={() => copySectionLink(section)}
									>
										{copiedId === section.id
											? 'Link copied'
											: copyFailedId === section.id
												? 'Copy failed'
												: 'Copy take link'}
									</button>
									<a
										href={shareUrl('reddit', section)}
										target="_blank"
										rel="noopener noreferrer"
										class="rounded-full border border-line px-3 py-1.5 text-ink transition-colors hover:border-accent hover:text-accent"
										>Reddit</a
									>
									<a
										href={shareUrl('x', section)}
										target="_blank"
										rel="noopener noreferrer"
										class="rounded-full border border-line px-3 py-1.5 text-ink transition-colors hover:border-accent hover:text-accent"
										>X</a
									>
								</div>
							</div>
						</div>
					</article>
				{/each}
			</div>
		</section>
	{/if}

	<section id="coffee-highlights" class="scroll-mt-28" aria-labelledby="coffee-highlights-heading">
		<div class="mb-4 max-w-2xl">
			<p class="text-xs font-semibold uppercase tracking-[0.14em] text-accent">From the catalog</p>
			<h2 id="coffee-highlights-heading" class="mt-1 font-serif text-3xl font-semibold text-ink">
				Coffee highlights
			</h2>
			<p class="mt-2 text-sm leading-6 text-muted">
				Current coffees selected after this week’s takes were finalized, chosen for the market or
				origin story they make tangible.
			</p>
		</div>

		<div class="grid gap-5 {coffeeHighlights.length > 1 ? 'lg:grid-cols-2' : ''}">
			{#each coffeeHighlights as coffee, index}
				<article class="overflow-hidden rounded-xl border border-line bg-surface-panel shadow-sm">
					<div
						class="grid min-h-full sm:grid-cols-[minmax(0,1fr)_11rem] lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_11rem]"
					>
						<div class="p-5 sm:p-6">
							<div class="flex items-start justify-between gap-3">
								<p class="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
									Highlight {String(index + 1).padStart(2, '0')}
								</p>
								<p class="text-right text-xs text-muted">
									{coffee.stockedDate
										? `Stocked ${formatDate(coffee.stockedDate)}`
										: 'Current listing'}
								</p>
							</div>
							<h3 class="mt-3 font-serif text-xl font-semibold leading-snug text-ink">
								{coffee.name}
							</h3>
							<p class="mt-1 text-sm text-muted">{supplierLabel(coffee.supplier)}</p>

							<div class="mt-4 flex flex-wrap gap-2 text-xs">
								<span class="rounded-full bg-surface-canvas px-2.5 py-1 text-ink"
									>{coffee.region}</span
								>
								{#if coffee.process}
									<span class="rounded-full bg-surface-canvas px-2.5 py-1 text-ink"
										>{coffee.process}</span
									>
								{/if}
								{#if coffee.variety}
									<span class="rounded-full bg-surface-canvas px-2.5 py-1 text-ink"
										>{coffee.variety}</span
									>
								{/if}
							</div>

							<p class="mt-4 text-sm leading-6 text-muted">{coffee.rationale}</p>

							<div
								class="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4"
							>
								<div>
									<p class="text-xs text-muted">Current listed price</p>
									<p class="mt-1 text-2xl font-semibold tabular-nums text-ink">
										${coffee.pricePerLb.toFixed(2)}<span class="text-sm font-normal text-muted"
											>/lb</span
										>
									</p>
									{#if coffee.priceContext}<p class="mt-1 text-xs text-muted">
											{coffee.priceContext}
										</p>{/if}
								</div>
								<a
									href={coffee.catalogUrl}
									class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
								>
									View catalog coffee
								</a>
							</div>
						</div>

						<div
							class="border-t border-line bg-ink/[0.035] p-4 sm:border-l sm:border-t-0 lg:border-l-0 lg:border-t xl:border-l xl:border-t-0"
						>
							<p class="mb-2 text-center text-xs font-semibold text-muted">Tasting profile</p>
							{#if coffee.tastingNotes}
								<div class="mx-auto flex justify-center">
									<TastingNotesRadar tastingNotes={coffee.tastingNotes} size={150} lazy={true} />
								</div>
							{:else}
								<p class="py-8 text-center text-xs leading-5 text-muted">
									Structured tasting notes are not yet published for this listing.
								</p>
							{/if}
							<div class="mt-3 flex flex-wrap justify-center gap-1.5">
								{#each noteTags(coffee) as note}
									<span
										class="rounded-full border border-line bg-surface-panel px-2 py-0.5 text-[0.7rem] text-muted"
									>
										{note}
									</span>
								{/each}
							</div>
							<a
								href={coffee.supplierUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="mt-4 block text-center text-xs font-semibold text-link underline decoration-accent/40 underline-offset-4 hover:text-accent"
							>
								Supplier listing ↗
							</a>
						</div>
					</div>
				</article>
			{/each}
		</div>
	</section>

	<p class="sr-only" aria-live="polite">
		{copiedId ? 'Section link copied.' : copyFailedId ? 'Clipboard copy failed.' : ''}
	</p>
</div>

<style>
	.market-brief-copy :global(p) {
		margin-top: 0.8rem;
	}

	.market-brief-copy :global(p:first-child) {
		margin-top: 0;
	}

	.market-brief-copy :global(a) {
		color: var(--color-link, #8d4529);
		text-decoration-line: underline;
		text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
		text-underline-offset: 0.2em;
	}

	.market-brief-copy :global(a:hover) {
		color: var(--color-accent, #c05b2e);
	}
</style>
