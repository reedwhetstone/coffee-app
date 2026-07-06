<script lang="ts">
	import {
		ARRIVAL_COLOR,
		AXIS_LABEL_COLOR,
		DELISTING_COLOR,
		GRIDLINE_COLOR,
		SERIES_LABEL_COLOR
	} from '$lib/styles/chartColors';

	interface MovementBeanLike {
		country: string | null;
	}

	interface Props {
		arrivals: MovementBeanLike[];
		delistings: MovementBeanLike[];
		maxOrigins?: number;
	}

	let { arrivals, delistings, maxOrigins = 10 }: Props = $props();

	interface OriginRow {
		origin: string;
		arrivals: number;
		delistings: number;
	}

	const WIDTH = 680;
	const ROW_H = 28;
	const PAD = { top: 26, right: 44, bottom: 8, left: 130 };
	const CENTER_GAP = 4;

	let rows = $derived.by((): OriginRow[] => {
		const counts = new Map<string, { arrivals: number; delistings: number }>();
		const bump = (list: MovementBeanLike[], key: 'arrivals' | 'delistings') => {
			for (const bean of list) {
				const origin = bean.country ?? 'Unknown';
				const entry = counts.get(origin) ?? { arrivals: 0, delistings: 0 };
				entry[key] += 1;
				counts.set(origin, entry);
			}
		};
		bump(arrivals, 'arrivals');
		bump(delistings, 'delistings');
		return [...counts.entries()]
			.map(([origin, entry]) => ({ origin, ...entry }))
			.sort((a, b) => b.arrivals + b.delistings - (a.arrivals + a.delistings))
			.slice(0, maxOrigins);
	});

	let maxCount = $derived(Math.max(1, ...rows.map((r) => Math.max(r.arrivals, r.delistings))));

	let height = $derived(PAD.top + rows.length * ROW_H + PAD.bottom);
	let center = $derived(PAD.left + (WIDTH - PAD.left - PAD.right) / 2);
	let halfWidth = $derived((WIDTH - PAD.left - PAD.right) / 2 - CENTER_GAP);

	function barWidth(count: number): number {
		return (count / maxCount) * halfWidth;
	}
</script>

{#if rows.length > 0}
	<div>
		<svg
			viewBox="0 0 {WIDTH} {height}"
			class="h-auto w-full"
			role="img"
			aria-label="Arrivals and delistings by origin"
		>
			<text
				x={center - CENTER_GAP - 6}
				y={PAD.top - 12}
				text-anchor="end"
				font-size="10"
				font-weight="600"
				fill={DELISTING_COLOR}
			>
				← Delistings
			</text>
			<text
				x={center + CENTER_GAP + 6}
				y={PAD.top - 12}
				text-anchor="start"
				font-size="10"
				font-weight="600"
				fill={ARRIVAL_COLOR}
			>
				Arrivals →
			</text>
			<line
				x1={center}
				y1={PAD.top - 8}
				x2={center}
				y2={height - PAD.bottom}
				stroke={GRIDLINE_COLOR}
			/>
			{#each rows as row, i}
				{@const cy = PAD.top + i * ROW_H + ROW_H / 2}
				<text
					x={PAD.left - 10}
					y={cy + 4}
					text-anchor="end"
					font-size="12"
					fill={SERIES_LABEL_COLOR}
				>
					{row.origin.length > 16 ? row.origin.slice(0, 15) + '…' : row.origin}
				</text>
				{#if row.delistings > 0}
					<rect
						x={center - CENTER_GAP - barWidth(row.delistings)}
						y={cy - 8}
						width={barWidth(row.delistings)}
						height="16"
						rx="3"
						fill={DELISTING_COLOR}
						fill-opacity="0.8"
					>
						<title>{row.origin}: {row.delistings} delisted</title>
					</rect>
					<text
						x={center - CENTER_GAP - barWidth(row.delistings) - 6}
						y={cy + 4}
						text-anchor="end"
						font-size="11"
						fill={AXIS_LABEL_COLOR}
					>
						{row.delistings}
					</text>
				{/if}
				{#if row.arrivals > 0}
					<rect
						x={center + CENTER_GAP}
						y={cy - 8}
						width={barWidth(row.arrivals)}
						height="16"
						rx="3"
						fill={ARRIVAL_COLOR}
						fill-opacity="0.85"
					>
						<title>{row.origin}: {row.arrivals} arrived</title>
					</rect>
					<text
						x={center + CENTER_GAP + barWidth(row.arrivals) + 6}
						y={cy + 4}
						text-anchor="start"
						font-size="11"
						fill={AXIS_LABEL_COLOR}
					>
						{row.arrivals}
					</text>
				{/if}
			{/each}
		</svg>
	</div>
{/if}
