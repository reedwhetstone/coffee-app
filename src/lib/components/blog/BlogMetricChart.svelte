<script lang="ts" module>
	export interface BlogMetricRow {
		label: string;
		value: number;
		low?: number;
		high?: number;
		display: string;
		detail?: string;
		muted?: boolean;
	}
</script>

<script lang="ts">
	import { CHART_SERIES } from '$lib/styles/chartColors';

	let {
		title,
		subtitle = '',
		rows,
		mark = 'bar',
		domain,
		ticks,
		tickFormat = (n: number) => String(n),
		axisLabel = '',
		source = '',
		valueHeader = 'Value',
		wideValue = false
	}: {
		title: string;
		subtitle?: string;
		rows: BlogMetricRow[];
		mark?: 'bar' | 'dot';
		domain: [number, number];
		ticks: number[];
		tickFormat?: (n: number) => string;
		axisLabel?: string;
		source?: string;
		valueHeader?: string;
		wideValue?: boolean;
	} = $props();

	const SERIES = CHART_SERIES[0];
	let active = $state<number | null>(null);

	function pct(n: number): number {
		const [min, max] = domain;
		return Math.max(0, Math.min(100, ((n - min) / (max - min)) * 100));
	}
</script>

<figure class="not-prose my-10 rounded-lg border border-line bg-surface-raised p-4 sm:p-6">
	<figcaption class="mb-5">
		<p class="font-sans text-base font-semibold text-ink">{title}</p>
		{#if subtitle}
			<p class="mt-1 font-sans text-sm text-muted">{subtitle}</p>
		{/if}
	</figcaption>

	<div class="font-sans" role="list" aria-label={title}>
		{#each rows as row, i (row.label)}
			<div
				class="grid grid-cols-[minmax(6rem,36%)_1fr] items-center gap-3 py-1.5 sm:grid-cols-[minmax(9rem,32%)_1fr]"
				role="listitem"
				aria-label={`${row.label}: ${row.display}${row.detail ? `. ${row.detail}` : ''}`}
				onmouseenter={() => (active = i)}
				onmouseleave={() => (active = null)}
			>
				<span class="text-right text-sm leading-tight text-ink"
					>{row.label}<span class="block text-xs tabular-nums text-muted sm:hidden"
						>{row.display}</span
					></span
				>
				<div class="relative h-7">
					<div
						class={`absolute inset-y-0 left-0 ${wideValue ? 'right-0 sm:right-32' : 'right-0 sm:right-20'}`}
					>
						{#each ticks as t (t)}
							<span
								class="absolute inset-y-0 w-px bg-line"
								style:left={`${pct(t)}%`}
								aria-hidden="true"
							></span>
						{/each}
						{#if mark === 'bar'}
							<span
								class="absolute inset-y-1 left-0 rounded-r"
								style:width={`${pct(row.value)}%`}
								style:background={row.muted ? 'transparent' : SERIES}
								style:border={row.muted ? `2px dashed ${SERIES}` : 'none'}
								style:opacity={active === null || active === i ? 1 : 0.55}
								aria-hidden="true"
							></span>
						{:else}
							{#if row.low !== undefined && row.high !== undefined}
								<span
									class="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
									style:left={`${pct(row.low)}%`}
									style:width={`${pct(row.high) - pct(row.low)}%`}
									style:background={SERIES}
									style:opacity={0.28}
									aria-hidden="true"
								></span>
							{/if}
							<span
								class="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface-raised"
								style:left={`${pct(row.value)}%`}
								style:background={SERIES}
								style:opacity={active === null || active === i ? 1 : 0.55}
								aria-hidden="true"
							></span>
						{/if}
					</div>
					<span
						class={`absolute inset-y-0 right-0 hidden items-center justify-end text-sm tabular-nums text-muted sm:flex ${wideValue ? 'sm:w-32' : 'sm:w-20'}`}
						>{row.display}</span
					>
					{#if active === i && row.detail}
						<span
							class="absolute bottom-full left-0 z-10 mb-1 max-w-xs rounded-md border border-line bg-surface-raised px-3 py-2 text-xs text-ink shadow-md"
							role="tooltip">{row.detail}</span
						>
					{/if}
				</div>
			</div>
		{/each}

		<div
			class="grid grid-cols-[minmax(6rem,36%)_1fr] gap-3 sm:grid-cols-[minmax(9rem,32%)_1fr]"
			aria-hidden="true"
		>
			<span></span>
			<div class={`relative h-5 ${wideValue ? 'mr-0 sm:mr-32' : 'mr-0 sm:mr-20'}`}>
				{#each ticks as t (t)}
					<span
						class="absolute -translate-x-1/2 text-xs tabular-nums text-muted"
						style:left={`${pct(t)}%`}>{tickFormat(t)}</span
					>
				{/each}
			</div>
		</div>
		{#if axisLabel}
			<p class="mt-1 text-center text-xs text-muted" aria-hidden="true">{axisLabel}</p>
		{/if}
	</div>

	<details class="mt-4 font-sans text-sm text-muted">
		<summary class="cursor-pointer">View data</summary>
		<table class="mt-2 w-full text-left text-sm">
			<thead>
				<tr class="border-b border-line text-ink">
					<th class="py-1 pr-3 font-semibold">Item</th>
					<th class="py-1 pr-3 font-semibold">{valueHeader}</th>
					<th class="py-1 font-semibold">Detail</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.label)}
					<tr class="border-b border-line">
						<td class="py-1 pr-3 text-ink">{row.label}</td>
						<td class="py-1 pr-3 tabular-nums">{row.display}</td>
						<td class="py-1">{row.detail ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</details>

	{#if source}
		<p class="mt-3 font-sans text-xs text-muted">{source}</p>
	{/if}
</figure>
