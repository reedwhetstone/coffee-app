<script lang="ts">
	import type { LegendEntry } from './chart-types';

	let { entries }: { entries: LegendEntry[] } = $props();
</script>

{#if entries.length > 0}
	{#each entries as entry, i}
		<g transform="translate(0, {i * 16})">
			<line
				x1={0}
				x2={20}
				y1={0}
				y2={0}
				stroke={entry.color}
				stroke-width={entry.strokeWidth}
				stroke-dasharray={entry.dashed ? '5,5' : 'none'}
			/>
			<text x={25} y={0} dy="0.35em" font-size="10" fill="#374151">{entry.label}</text>
		</g>
	{/each}
{/if}
