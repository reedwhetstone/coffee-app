<script lang="ts">
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';
	interface KpiCard {
		label: string;
		value: string;
		detail: string;
		/** Visual tone: 'up' = green, 'down' = brand, 'alert' = red, 'neutral' = default */
		tone: string;
	}

	interface InsightCard {
		label: string;
		title: string;
		body: string;
		evidence: string;
	}

	interface Props {
		kpiCards: KpiCard[];
		insightCards: InsightCard[];
	}

	let { kpiCards, insightCards }: Props = $props();

	const TONE_CLASSES: Record<string, string> = {
		up: 'text-success-strong',
		down: 'text-accent',
		alert: 'text-danger-strong',
		neutral: 'text-ink'
	};
</script>

<section
	class="mb-6 grid grid-cols-2 divide-line overflow-hidden rounded-lg border border-line bg-surface-raised shadow-sm max-lg:divide-y lg:grid-cols-4 lg:divide-x"
	aria-label="Market KPI strip"
>
	{#each kpiCards as card}
		<div class="p-4 sm:p-5">
			<p class="text-xs font-medium text-muted">
				{card.label}
			</p>
			<div class="mt-2 text-2xl font-semibold tabular-nums {TONE_CLASSES[card.tone] ?? 'text-ink'}">
				{card.value}
			</div>
			<p class="mt-1 text-xs text-muted">{card.detail}</p>
		</div>
	{/each}
</section>

<section class="mb-6 grid gap-4 lg:grid-cols-3" aria-label="Market insight cards">
	{#each insightCards as insight}
		<article
			class="relative overflow-hidden rounded-lg border border-line bg-surface-panel p-5 pl-7"
		>
			<AccentSpine />
			<p class="text-xs font-semibold text-accent">
				{insight.label}
			</p>
			<h3 class="mt-2 font-serif text-lg font-medium text-ink">{insight.title}</h3>
			<p class="mt-2 text-sm leading-6 text-muted">{insight.body}</p>
			<p class="mt-4 text-xs font-medium text-muted">{insight.evidence}</p>
		</article>
	{/each}
</section>
