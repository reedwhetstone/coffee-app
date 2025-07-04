<script lang="ts">
	import { onMount } from 'svelte';
	import { select, scaleLinear, line, type Selection } from 'd3';
	import type { TastingNotes, RadarDataPoint } from '$lib/types/coffee.types';

	export let tastingNotes: TastingNotes | null = null;
	export let size: number = 120;

	let svgElement: SVGSVGElement;
	let mounted = false;

	const radius = size / 2 - 10; // Leave margin for labels
	const center = size / 2;
	const levels = 5; // 1-5 scale

	// Transform tasting notes to radar data
	$: radarData = tastingNotes ? transformToRadarData(tastingNotes) : [];

	function transformToRadarData(notes: TastingNotes): RadarDataPoint[] {
		const axes = ['Body', 'Flavor', 'Acidity', 'Sweetness', 'Aroma'];
		const noteKeys = ['body', 'flavor', 'acidity', 'sweetness', 'fragrance_aroma'] as const;

		return axes.map((axis, i) => {
			const noteKey = noteKeys[i];
			const note = notes[noteKey];
			return {
				axis,
				value: note?.score || 0,
				color: note?.color || '#ccc',
				tag: note?.tag || ''
			};
		});
	}

	function getRadarPath(data: RadarDataPoint[]): string {
		const angleSlice = (Math.PI * 2) / data.length;

		const pathCoords = data.map((d, i) => {
			const angle = angleSlice * i - Math.PI / 2; // Start from top
			const r = (d.value / 5) * radius; // Scale to radius
			const x = center + r * Math.cos(angle);
			const y = center + r * Math.sin(angle);
			return [x, y];
		});

		// Close the path
		if (pathCoords.length > 0) {
			pathCoords.push(pathCoords[0]);
		}

		return 'M' + pathCoords.map((d) => d.join(',')).join('L');
	}

	function drawChart() {
		if (!mounted || !svgElement || radarData.length === 0) return;

		const svg = select(svgElement);
		svg.selectAll('*').remove(); // Clear previous content

		const g = svg.append('g');

		// Draw concentric circles (background grid)
		for (let i = 1; i <= levels; i++) {
			g.append('circle')
				.attr('cx', center)
				.attr('cy', center)
				.attr('r', (radius / levels) * i)
				.attr('fill', 'none')
				.attr('stroke', '#e5e7eb')
				.attr('stroke-width', 1)
				.attr('opacity', 0.3);
		}

		// Draw axis lines
		const angleSlice = (Math.PI * 2) / radarData.length;
		radarData.forEach((d, i) => {
			const angle = angleSlice * i - Math.PI / 2;
			const x2 = center + radius * Math.cos(angle);
			const y2 = center + radius * Math.sin(angle);

			g.append('line')
				.attr('x1', center)
				.attr('y1', center)
				.attr('x2', x2)
				.attr('y2', y2)
				.attr('stroke', '#e5e7eb')
				.attr('stroke-width', 1)
				.attr('opacity', 0.5);

			// Add axis labels
			const labelDistance = radius + 8;
			const labelX = center + labelDistance * Math.cos(angle);
			const labelY = center + labelDistance * Math.sin(angle);

			g.append('text')
				.attr('x', labelX)
				.attr('y', labelY)
				.attr('text-anchor', 'middle')
				.attr('dominant-baseline', 'middle')
				.attr('font-size', '8px')
				.attr('fill', '#6b7280')
				.attr('font-weight', '500')
				.text(d.axis);
		});

		// Create gradient for area fill
		const defs = svg.append('defs');
		const gradientColors = [...new Set(radarData.map((d) => d.color))];

		gradientColors.forEach((color, index) => {
			const gradient = defs
				.append('radialGradient')
				.attr('id', `radar-gradient-${index}`)
				.attr('cx', '50%')
				.attr('cy', '50%')
				.attr('r', '50%');

			gradient
				.append('stop')
				.attr('offset', '0%')
				.attr('stop-color', color)
				.attr('stop-opacity', 0.3);

			gradient
				.append('stop')
				.attr('offset', '100%')
				.attr('stop-color', color)
				.attr('stop-opacity', 0.1);
		});

		// Draw radar area
		if (radarData.some((d) => d.value > 0)) {
			g.append('path')
				.attr('d', getRadarPath(radarData))
				.attr('fill', `url(#radar-gradient-0)`)
				.attr('fill-opacity', 0.3)
				.attr('stroke', radarData[0]?.color || '#ccc')
				.attr('stroke-width', 1.5)
				.attr('stroke-opacity', 0.8);

			// Draw data points
			radarData.forEach((d, i) => {
				if (d.value > 0) {
					const angle = angleSlice * i - Math.PI / 2;
					const r = (d.value / 5) * radius;
					const x = center + r * Math.cos(angle);
					const y = center + r * Math.sin(angle);

					g.append('circle')
						.attr('cx', x)
						.attr('cy', y)
						.attr('r', 2.5)
						.attr('fill', d.color)
						.attr('stroke', '#fff')
						.attr('stroke-width', 1)
						.style('cursor', 'pointer')
						.append('title')
						.text(`${d.axis}: ${d.tag} (${d.value}/5)`);
				}
			});
		}
	}

	onMount(() => {
		mounted = true;
		drawChart();
	});

	$: if (mounted && radarData) {
		drawChart();
	}
</script>

<div class="tasting-radar">
	{#if tastingNotes && radarData.length > 0}
		<svg
			bind:this={svgElement}
			width={size}
			height={size}
			viewBox="0 0 {size} {size}"
			class="overflow-visible"
		></svg>
	{:else}
		<!-- Fallback for missing data -->
		<div
			class="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50"
			style="width: {size}px; height: {size}px;"
		>
			<span class="text-xs text-gray-400">No tasting data</span>
		</div>
	{/if}
</div>

<style>
	.tasting-radar {
		display: inline-block;
	}
</style>
