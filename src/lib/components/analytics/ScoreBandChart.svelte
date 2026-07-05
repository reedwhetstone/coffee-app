<script lang="ts">
	import { AXIS_LABEL_COLOR, GRIDLINE_COLOR, MARKER_PRIMARY } from '$lib/styles/chartColors';
	import type { MetadataSeriesItem } from '$lib/types/marketIndex.types';

	interface Props {
		series: MetadataSeriesItem[];
	}

	let { series }: Props = $props();

	const WIDTH = 640;
	const HEIGHT = 200;
	const PAD = { top: 12, right: 40, bottom: 24, left: 8 };

	interface Point {
		period: string;
		p25: number;
		p50: number;
		p75: number;
	}

	let points = $derived.by((): Point[] =>
		series
			.map((item) => {
				const stat = (key: 'p25' | 'p50' | 'p75') => {
					const bucket = item.buckets.find((b) => b.key === key);
					return bucket && 'value' in bucket ? bucket.value : null;
				};
				return { period: item.period, p25: stat('p25'), p50: stat('p50'), p75: stat('p75') };
			})
			.filter((p): p is Point => p.p25 != null && p.p50 != null && p.p75 != null)
	);

	let domain = $derived.by(() => {
		if (points.length === 0) return { min: 80, max: 90 };
		const values = points.flatMap((p) => [p.p25, p.p75]);
		const min = Math.floor(Math.min(...values) - 0.5);
		const max = Math.ceil(Math.max(...values) + 0.5);
		return { min, max: max > min ? max : min + 1 };
	});

	function xAt(i: number): number {
		if (points.length === 1) return WIDTH / 2;
		return PAD.left + (i * (WIDTH - PAD.left - PAD.right)) / (points.length - 1);
	}

	function yAt(value: number): number {
		const { min, max } = domain;
		const innerH = HEIGHT - PAD.top - PAD.bottom;
		return PAD.top + innerH * (1 - (value - min) / (max - min));
	}

	function linePath(accessor: (p: Point) => number): string {
		return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(accessor(p))}`).join(' ');
	}

	let bandPath = $derived.by(() => {
		if (points.length === 0) return '';
		const upper = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p.p75)}`).join(' ');
		const lower = [...points]
			.reverse()
			.map((p, i) => `L${xAt(points.length - 1 - i)},${yAt(p.p25)}`)
			.join(' ');
		return `${upper} ${lower} Z`;
	});

	function formatPeriod(period: string): string {
		const [year, month] = period.split('-');
		if (!month) return period;
		return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
			month: 'short'
		});
	}
</script>

{#if points.length > 0}
	<div>
		<svg
			viewBox="0 0 {WIDTH} {HEIGHT}"
			class="h-auto w-full"
			role="img"
			aria-label="Score distribution over time (p25 to p75 band with median line)"
		>
			<line
				x1="0"
				y1={HEIGHT - PAD.bottom}
				x2={WIDTH}
				y2={HEIGHT - PAD.bottom}
				stroke={GRIDLINE_COLOR}
			/>
			<path d={bandPath} fill={MARKER_PRIMARY} fill-opacity="0.15" />
			<path d={linePath((p) => p.p50)} fill="none" stroke={MARKER_PRIMARY} stroke-width="2" />
			{#each points as p, i}
				<circle cx={xAt(i)} cy={yAt(p.p50)} r="3" fill={MARKER_PRIMARY} />
				<text x={xAt(i)} y={HEIGHT - 8} text-anchor="middle" font-size="11" fill={AXIS_LABEL_COLOR}>
					{formatPeriod(p.period)}
				</text>
			{/each}
			{#if points.length > 0}
				{@const last = points[points.length - 1]}
				<text
					x={xAt(points.length - 1) + 8}
					y={yAt(last.p50) + 4}
					font-size="11"
					font-weight="600"
					fill={AXIS_LABEL_COLOR}
				>
					{last.p50.toFixed(1)}
				</text>
			{/if}
		</svg>
		<p class="mt-2 text-xs text-muted">
			Median cup score of stocked supply, with the p25–p75 band.
		</p>
	</div>
{/if}
