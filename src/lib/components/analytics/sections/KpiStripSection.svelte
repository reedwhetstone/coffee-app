<script lang="ts">
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
</script>

<section class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Market KPI strip">
	{#each kpiCards as card}
		<div class="rounded-xl border border-border-light bg-background-primary-light p-4 shadow-sm">
			<p class="text-xs font-semibold text-text-secondary-light">
				{card.label}
			</p>
			<div
				class="mt-2 text-2xl font-bold {card.tone === 'up'
					? 'text-emerald-700'
					: card.tone === 'down'
						? 'text-background-tertiary-light'
						: card.tone === 'alert'
							? 'text-red-700'
							: 'text-text-primary-light'}"
			>
				{card.value}
			</div>
			<p class="mt-1 text-xs text-text-secondary-light">{card.detail}</p>
		</div>
	{/each}
</section>

<section class="mb-6 grid gap-4 lg:grid-cols-3" aria-label="Market insight cards">
	{#each insightCards as insight}
		<article
			class="rounded-xl border border-border-light bg-background-primary-light p-5 shadow-sm"
		>
			<p class="text-xs font-semibold text-background-tertiary-light">
				{insight.label}
			</p>
			<h2 class="mt-2 text-lg font-semibold text-text-primary-light">{insight.title}</h2>
			<p class="mt-2 text-sm leading-6 text-text-secondary-light">{insight.body}</p>
			<p class="mt-4 text-xs font-medium text-text-secondary-light">{insight.evidence}</p>
		</article>
	{/each}
</section>
