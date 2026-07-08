<script lang="ts">
	import {
		AXIS_LABEL_COLOR,
		GRIDLINE_COLOR,
		MARKER_PRIMARY,
		SERIES_LABEL_COLOR,
		TOOLTIP_MUTED_COLOR
	} from '$lib/styles/chartColors';

	interface SupplierRow {
		source: string;
		count: number;
		min: number;
		median: number;
		max: number;
	}

	interface Props {
		rows: SupplierRow[];
		maxSuppliers?: number;
	}

	let { rows: rangeRows = [], maxSuppliers = 12 }: Props = $props();

	const WIDTH = 680;
	const ROW_H = 30;
	const PAD = { top: 22, right: 56, bottom: 8, left: 180 };

	let allRows = $derived.by((): SupplierRow[] =>
		[...rangeRows].filter((row) => row.count > 0 && row.max > 0).sort((a, b) => a.median - b.median)
	);
	let rows = $derived(allRows.slice(0, maxSuppliers));

	let domain = $derived.by(() => {
		if (rows.length === 0) return { min: 0, max: 10 };
		const min = Math.floor(Math.min(...rows.map((r) => r.min)) - 0.25);
		const max = Math.ceil(Math.max(...rows.map((r) => r.max)) + 0.25);
		return { min: Math.max(0, min), max: max > min ? max : min + 1 };
	});

	let height = $derived(PAD.top + rows.length * ROW_H + PAD.bottom);

	function xAt(price: number): number {
		const { min, max } = domain;
		return PAD.left + ((price - min) / (max - min)) * (WIDTH - PAD.left - PAD.right);
	}
</script>

{#if rows.length > 0}
	<div>
		<svg
			viewBox="0 0 {WIDTH} {height}"
			class="h-auto w-full"
			role="img"
			aria-label="Supplier price ranges: min to max per pound with the median marked"
		>
			{#each [domain.min, (domain.min + domain.max) / 2, domain.max] as tick}
				<line
					x1={xAt(tick)}
					y1={PAD.top - 12}
					x2={xAt(tick)}
					y2={height - PAD.bottom}
					stroke={GRIDLINE_COLOR}
				/>
				<text
					x={xAt(tick)}
					y={PAD.top - 14}
					text-anchor="middle"
					font-size="10"
					fill={AXIS_LABEL_COLOR}
				>
					${tick.toFixed(2)}
				</text>
			{/each}
			{#each rows as row, i}
				{@const cy = PAD.top + i * ROW_H + ROW_H / 2}
				<text
					x={PAD.left - 10}
					y={cy + 4}
					text-anchor="end"
					font-size="12"
					fill={SERIES_LABEL_COLOR}
				>
					{row.source.length > 22 ? row.source.slice(0, 21) + '…' : row.source}
				</text>
				<line
					x1={xAt(row.min)}
					y1={cy}
					x2={xAt(row.max)}
					y2={cy}
					stroke={MARKER_PRIMARY}
					stroke-opacity="0.35"
					stroke-width="4"
					stroke-linecap="round"
				/>
				<circle cx={xAt(row.median)} {cy} r="5" fill={MARKER_PRIMARY}>
					<title>{row.source}: median ${row.median.toFixed(2)}/lb across {row.count} lots</title>
				</circle>
				<text x={WIDTH - PAD.right + 8} y={cy + 4} font-size="11" fill={TOOLTIP_MUTED_COLOR}>
					{row.count} lots
				</text>
			{/each}
		</svg>
		<p class="mt-2 text-xs text-muted">
			Bar = min to max $/lb per supplier · dot = median. Sorted cheapest median first.
			{#if rows.length < allRows.length}
				Showing {rows.length} of {allRows.length} suppliers.
			{:else}
				Showing all {allRows.length} suppliers.
			{/if}
		</p>
	</div>
{/if}
