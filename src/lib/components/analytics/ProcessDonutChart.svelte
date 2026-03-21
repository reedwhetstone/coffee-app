<script lang="ts">
	import { arc, pie } from 'd3-shape';

	interface Bucket {
		name: string;
		count: number;
	}

	let { data = [] }: { data: Bucket[] } = $props();

	const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#6b7280'];

	let containerH = $state(0);
	let containerW = $state(0);

	let total = $derived(data.reduce((s, d) => s + d.count, 0));

	let radius = $derived(Math.min(containerW, containerH) / 2 - 10);
	let innerRadius = $derived(radius * 0.55);

	let slices = $derived.by(() => {
		if (total === 0 || radius <= 0) return [];
		const pieGen = pie<Bucket>()
			.value((d) => d.count)
			.sort(null);
		const arcGen = arc<{
			startAngle: number;
			endAngle: number;
			innerRadius: number;
			outerRadius: number;
		}>()
			.innerRadius(innerRadius)
			.outerRadius(radius);
		return pieGen(data).map((d, i) => ({
			path:
				arcGen({
					startAngle: d.startAngle,
					endAngle: d.endAngle,
					innerRadius,
					outerRadius: radius
				}) ?? '',
			color: COLORS[i % COLORS.length],
			name: d.data.name,
			count: d.data.count,
			pct: total > 0 ? Math.round((d.data.count / total) * 100) : 0
		}));
	});

	let cx = $derived(containerW / 2);
	let cy = $derived(containerH / 2);
</script>

<div class="h-full w-full" bind:clientHeight={containerH} bind:clientWidth={containerW}>
	{#if containerW > 0 && containerH > 0 && slices.length > 0}
		<svg width={containerW} height={containerH}>
			<g transform="translate({cx},{cy})">
				{#each slices as s}
					<path
						d={s.path}
						fill={s.color}
						fill-opacity="0.85"
						stroke="transparent"
						stroke-width="1"
					/>
				{/each}
				<!-- Center text -->
				<text
					x="0"
					y="-8"
					text-anchor="middle"
					font-size="22"
					font-weight="600"
					fill="rgb(55 65 81)">{total}</text
				>
				<text x="0" y="12" text-anchor="middle" font-size="11" fill="rgb(107 114 128)">beans</text>
			</g>
		</svg>

		<!-- Legend -->
		<div class="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 px-2">
			{#each slices as s}
				<div class="flex items-center gap-1.5 text-xs text-text-secondary-light">
					<div class="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style="background:{s.color}"></div>
					<span>{s.name}</span>
					<span class="font-medium text-text-primary-light">{s.pct}%</span>
				</div>
			{/each}
		</div>
	{/if}
</div>
