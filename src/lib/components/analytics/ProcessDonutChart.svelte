<script lang="ts">
	import { arc, pie } from 'd3-shape';

	interface Bucket {
		name: string;
		count: number;
	}

	let { data = [] }: { data: Bucket[] } = $props();

	// Known-category colors; "Other" always gets neutral gray
	const KNOWN_COLORS: Record<string, string> = {
		Washed: '#3b82f6',
		Natural: '#f59e0b',
		Honey: '#10b981',
		Anaerobic: '#ec4899',
		'Wet Hulled': '#8b5cf6',
		Unknown: '#9ca3af'
	};
	const OTHER_COLOR = '#6b7280';
	const FALLBACK_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6'];

	let containerH = $state(0);
	let containerW = $state(0);

	let total = $derived(data.reduce((s, d) => s + d.count, 0));

	// Merge slices < 3% into "Other"
	let mergedData = $derived.by((): Bucket[] => {
		if (total === 0) return data;
		const threshold = total * 0.03;
		const main: Bucket[] = [];
		let otherCount = 0;
		// Find existing "Other" first so we don't double-count
		for (const d of data) {
			if (d.name === 'Other' || d.name === 'Unknown') {
				// Keep Unknown separate if it's big enough, else fold into Other
				if (d.count >= threshold) {
					main.push(d);
				} else {
					otherCount += d.count;
				}
			} else if (d.count < threshold) {
				otherCount += d.count;
			} else {
				main.push(d);
			}
		}
		if (otherCount > 0) {
			// Merge into existing Other bucket if present
			const existingOther = main.find((d) => d.name === 'Other');
			if (existingOther) {
				existingOther.count += otherCount;
			} else {
				main.push({ name: 'Other', count: otherCount });
			}
		}
		return main.sort((a, b) => b.count - a.count);
	});

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

		// Label arc: midpoint of outer radius for label placement
		const labelRadius = radius * 0.75;
		const labelArcGen = arc<{
			startAngle: number;
			endAngle: number;
			innerRadius: number;
			outerRadius: number;
		}>()
			.innerRadius(labelRadius)
			.outerRadius(labelRadius);

		return pieGen(mergedData).map((d, i) => {
			const color =
				d.data.name === 'Other'
					? OTHER_COLOR
					: (KNOWN_COLORS[d.data.name] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]);

			const pct = total > 0 ? Math.round((d.data.count / total) * 100) : 0;

			// Centroid for percentage label (inside arc)
			const centroid = labelArcGen.centroid({
				startAngle: d.startAngle,
				endAngle: d.endAngle,
				innerRadius: labelRadius,
				outerRadius: labelRadius
			});

			// Only show label if arc is large enough (>= 8% to avoid overlap)
			const showLabel = pct >= 8;

			return {
				path:
					arcGen({
						startAngle: d.startAngle,
						endAngle: d.endAngle,
						innerRadius,
						outerRadius: radius
					}) ?? '',
				color,
				name: d.data.name,
				count: d.data.count,
				pct,
				labelX: centroid[0],
				labelY: centroid[1],
				showLabel
			};
		});
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

				<!-- Percentage labels inside arcs (top segments >= 8%) -->
				{#each slices as s}
					{#if s.showLabel}
						<text
							x={s.labelX}
							y={s.labelY}
							text-anchor="middle"
							dominant-baseline="middle"
							font-size="11"
							font-weight="600"
							fill="white"
							pointer-events="none"
						>
							{s.pct}%
						</text>
					{/if}
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
