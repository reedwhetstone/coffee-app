<script lang="ts">
	import { scaleBand, scaleLinear } from 'd3-scale';
	import { max } from 'd3-array';
	import { select } from 'd3-selection';

	interface OriginBar {
		origin: string;
		price_avg: number;
		supplier_count: number;
		sample_size: number;
	}

	let { data = [] }: { data: OriginBar[] } = $props();

	let containerH = $state(0);
	let containerW = $state(0);

	const padding = { top: 10, right: 100, bottom: 10, left: 120 };

	let innerW = $derived(Math.max(0, containerW - padding.left - padding.right));
	let innerH = $derived(Math.max(0, containerH - padding.top - padding.bottom));

	// Sort by sample_size (volume) descending; show price as bar width
	let sortedData = $derived([...data].sort((a, b) => b.sample_size - a.sample_size).slice(0, 12));

	let yScale = $derived(
		scaleBand()
			.domain(sortedData.map((d) => d.origin))
			.range([0, innerH])
			.padding(0.25)
	);

	let xScale = $derived(
		scaleLinear()
			.domain([0, (max(sortedData.map((d) => d.price_avg)) ?? 10) * 1.1])
			.range([0, innerW])
			.nice()
	);

	let yAxisEl: SVGGElement | undefined = $state();
	let xAxisEl: SVGGElement | undefined = $state();

	$effect(() => {
		if (!yAxisEl || !yScale || innerH <= 0) return;
		const g = select(yAxisEl);
		g.selectAll('*').remove();
		sortedData.forEach((d) => {
			const y = (yScale(d.origin) ?? 0) + yScale.bandwidth() / 2;
			g.append('text')
				.attr('x', -8)
				.attr('y', y)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'middle')
				.attr('fill', 'rgb(107 114 128)')
				.attr('font-size', '12')
				.text(d.origin);
		});
	});

	$effect(() => {
		if (!xAxisEl || !xScale || innerW <= 0) return;
		const g = select(xAxisEl);
		g.selectAll('*').remove();
		g.append('line')
			.attr('x1', 0)
			.attr('x2', innerW)
			.attr('y1', 0)
			.attr('y2', 0)
			.attr('stroke', 'rgb(156 163 175)');
		const ticks = xScale.ticks(5);
		ticks.forEach((t) => {
			const x = xScale(t);
			g.append('line')
				.attr('x1', x)
				.attr('x2', x)
				.attr('y1', 0)
				.attr('y2', 5)
				.attr('stroke', 'rgb(156 163 175)');
			g.append('text')
				.attr('x', x)
				.attr('y', 18)
				.attr('text-anchor', 'middle')
				.attr('fill', 'rgb(156 163 175)')
				.attr('font-size', '11')
				.text(`$${t.toFixed(2)}`);
		});
	});
</script>

<div class="h-full w-full" bind:clientHeight={containerH} bind:clientWidth={containerW}>
	{#if containerW > 0 && containerH > 0 && sortedData.length > 0}
		<svg width={containerW} height={containerH}>
			<g transform="translate({padding.left},{padding.top})">
				<!-- Y axis labels -->
				<g bind:this={yAxisEl}></g>

				<!-- X axis -->
				<g bind:this={xAxisEl} transform="translate(0,{innerH})"></g>

				<!-- Bars -->
				{#each sortedData as d}
					{@const y = yScale(d.origin) ?? 0}
					{@const barW = xScale(d.price_avg)}
					<rect
						x={0}
						{y}
						width={barW}
						height={yScale.bandwidth()}
						fill="#f59e0b"
						fill-opacity="0.8"
						rx="2"
					/>
					<!-- Price + volume label at end of bar -->
					<text
						x={barW + 4}
						y={y + yScale.bandwidth() / 2}
						dominant-baseline="middle"
						font-size="11"
						fill="rgb(156 163 175)"
					>
						${d.price_avg.toFixed(2)}
						{#if d.sample_size > 0}
							<tspan fill="rgb(107 114 128)" font-size="10">, {d.sample_size}</tspan>
						{/if}
					</text>
				{/each}

				<!-- Gridlines -->
				{#each xScale.ticks(5) as t}
					<line
						x1={xScale(t)}
						x2={xScale(t)}
						y1={0}
						y2={innerH}
						stroke="rgb(156 163 175)"
						stroke-opacity="0.2"
						stroke-dasharray="4 4"
					/>
				{/each}
			</g>
		</svg>
	{/if}
</div>
