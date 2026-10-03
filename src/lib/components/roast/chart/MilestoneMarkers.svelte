<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { ScaleLinear } from 'd3-scale';
	import type { ChartEvent } from './chart-types';
	import { layoutMarkerLabels, milestoneLabel } from './chart-utils';

	let { events }: { events: ChartEvent[] } = $props();

	const { width, height, xScale } = getContext('LayerCake') as {
		width: Writable<number>;
		height: Writable<number>;
		xScale: Writable<ScaleLinear<number, number>>;
	};

	const LINE_COLOR = '#4ade80';
	const LABEL_COLOR = '#15803d';
	const ROW_HEIGHT = 13;

	// A milestone outside the plotted time range has no place on this chart.
	let markers = $derived.by(() => {
		const [start, end] = $xScale.domain();
		return layoutMarkerLabels(
			events
				.filter((event) => event.timeMinutes >= start && event.timeMinutes <= end)
				.map((event) => ({
					x: $xScale(event.timeMinutes),
					label: event.label ?? milestoneLabel(event.name),
					color: event.color,
					dashed: event.dashed
				})),
			$width
		);
	});
</script>

{#each markers as marker}
	<line
		x1={marker.x}
		x2={marker.x}
		y1={0}
		y2={$height}
		stroke={marker.color ?? LINE_COLOR}
		stroke-width="1"
		stroke-dasharray={marker.dashed === false ? 'none' : '4,4'}
	/>
{/each}
<!-- Labels are drawn after every line so a neighbouring marker never runs through the text. -->
{#each markers as marker}
	<text
		class="chart-milestone-label"
		x={marker.anchor === 'start' ? marker.x + 4 : marker.x - 4}
		y={10 + marker.row * ROW_HEIGHT}
		fill={marker.color ?? LABEL_COLOR}
		font-size="11"
		text-anchor={marker.anchor}
		stroke="#FCFAF8"
		stroke-width="3"
		stroke-linejoin="round"
		paint-order="stroke"
	>
		{marker.label}
	</text>
{/each}
