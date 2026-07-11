<script lang="ts">
	import { AXIS_LABEL_COLOR, GRIDLINE_COLOR } from '$lib/styles/chartColors';
	import type { MetadataSeriesItem } from '$lib/types/marketIndex.types';

	interface Props {
		series: MetadataSeriesItem[];
		colorFor: (key: string) => string;
		labelFor?: (key: string) => string;
	}

	let { series, colorFor, labelFor = (key) => key }: Props = $props();

	const WIDTH = 640;
	const HEIGHT = 200;
	const PAD_BOTTOM = 24;
	const GAP = 10;

	interface ShareBucket {
		key: string;
		share: number;
		count: number;
	}

	let periods = $derived.by(() =>
		series.map((item) => ({
			period: item.period,
			lotCount: item.lotCount,
			buckets: item.buckets
				.filter(
					(b): b is ShareBucket & { supplierCount: number } => 'share' in b && b.share != null
				)
				.map((b) => ({ key: b.key, share: b.share ?? 0, count: b.count }))
		}))
	);

	// Stable legend order: largest average share first; undisclosed last.
	let legendKeys = $derived.by(() => {
		const totals = new Map<string, number>();
		for (const p of periods) {
			for (const b of p.buckets) totals.set(b.key, (totals.get(b.key) ?? 0) + b.share);
		}
		return [...totals.entries()]
			.sort((a, b) => {
				if (a[0] === 'undisclosed') return 1;
				if (b[0] === 'undisclosed') return -1;
				return b[1] - a[1];
			})
			.map(([key]) => key);
	});

	let columnWidth = $derived(
		periods.length > 0 ? (WIDTH - GAP * (periods.length - 1)) / periods.length : WIDTH
	);

	function formatPeriod(period: string): string {
		const [year, month] = period.split('-');
		if (!month) return period;
		const date = new Date(Number(year), Number(month) - 1, 1);
		return date.toLocaleDateString('en-US', { month: 'short' });
	}

	function stack(buckets: { key: string; share: number }[]): {
		key: string;
		y: number;
		h: number;
	}[] {
		const chartHeight = HEIGHT - PAD_BOTTOM;
		const ordered = legendKeys
			.map((key) => buckets.find((b) => b.key === key))
			.filter((b): b is { key: string; share: number } => Boolean(b));
		let y = chartHeight;
		return ordered.map((b) => {
			const h = Math.max(0, b.share * chartHeight);
			y -= h;
			return { key: b.key, y, h };
		});
	}

	let latest = $derived(periods.at(-1) ?? null);
</script>

{#if periods.length > 0}
	<div>
		<svg
			viewBox="0 0 {WIDTH} {HEIGHT}"
			class="h-auto w-full"
			role="img"
			aria-label="Composition trend by period"
		>
			<line
				x1="0"
				y1={HEIGHT - PAD_BOTTOM}
				x2={WIDTH}
				y2={HEIGHT - PAD_BOTTOM}
				stroke={GRIDLINE_COLOR}
			/>
			{#each periods as p, i}
				{@const x = i * (columnWidth + GAP)}
				{#each stack(p.buckets) as seg}
					<rect
						{x}
						y={seg.y}
						width={columnWidth}
						height={seg.h}
						fill={colorFor(seg.key)}
						fill-opacity="0.9"
						rx="2"
					>
						<title>{p.period} · {labelFor(seg.key)}</title>
					</rect>
				{/each}
				<text
					x={x + columnWidth / 2}
					y={HEIGHT - 8}
					text-anchor="middle"
					font-size="11"
					fill={AXIS_LABEL_COLOR}
				>
					{formatPeriod(p.period)}
				</text>
			{/each}
		</svg>
		<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1">
			{#each legendKeys as key}
				{@const latestBucket = latest?.buckets.find((b) => b.key === key)}
				<div class="flex items-center gap-1.5 text-xs text-muted">
					<span class="h-2.5 w-2.5 rounded-sm" style="background:{colorFor(key)}"></span>
					<span>{labelFor(key)}</span>
					{#if latestBucket}
						<span class="font-medium text-ink">{Math.round(latestBucket.share * 100)}%</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
