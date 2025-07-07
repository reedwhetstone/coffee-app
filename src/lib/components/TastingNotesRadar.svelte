<script lang="ts">
	import { onMount } from 'svelte';
	import { select, scaleLinear, line, type Selection } from 'd3';
	import type { TastingNotes, RadarDataPoint } from '$lib/types/coffee.types';

	export let tastingNotes: TastingNotes | null = null;
	export let userTastingNotes: TastingNotes | null = null;
	export let showOverlay: boolean = false;
	export let size: number = 120;
	export let responsive: boolean = false;

	let svgElement: SVGSVGElement;
	let mounted = false;

	const radius = size / 2 - 10; // Leave margin for labels
	const center = size / 2;
	const levels = 5; // 1-5 scale

	// Transform tasting notes to radar data
	$: radarData = tastingNotes ? transformToRadarData(tastingNotes) : [];
	$: userRadarData = userTastingNotes ? transformToRadarData(userTastingNotes) : [];

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

		// Draw axis lines (neutral color)
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

		// Helper function to draw circles for a dataset
		function drawCircles(data: RadarDataPoint[], isUser: boolean = false) {
			data.forEach((d, i) => {
				if (d.value > 0) {
					const angle = angleSlice * i - Math.PI / 2;

					// Circle radius based on score (diameter = score, so radius = score/2)
					// Scale to fit within the radar chart sections
					const circleRadius = (d.value / 2) * (radius / 5); // Each unit fills 1/5 of the radius

					// Position circle center so it's tangent at the center axis
					// Circle extends outward from center by its radius
					const centerX = center + circleRadius * Math.cos(angle);
					const centerY = center + circleRadius * Math.sin(angle);

					const circle = g.append('circle')
						.attr('cx', centerX)
						.attr('cy', centerY)
						.attr('r', circleRadius)
						.attr('fill', d.color)
						.style('cursor', 'pointer');

					if (isUser) {
						// User data styling: lighter fill, dashed stroke
						circle
							.attr('fill-opacity', 0.3)
							.attr('stroke', d.color)
							.attr('stroke-width', 2)
							.attr('stroke-dasharray', '4,4')
							.attr('stroke-opacity', 0.8);
					} else {
						// AI data styling: existing solid style
						circle
							.attr('fill-opacity', 0.5)
							.attr('stroke', d.color)
							.attr('stroke-width', 1)
							.attr('stroke-opacity', 1);
					}

					circle.append('title')
						.text(`${isUser ? 'User' : 'AI'} ${d.axis}: ${d.tag} (${d.value}/5)`);
				}
			});
		}

		// Draw AI circles first (underneath)
		drawCircles(radarData, false);

		// Draw user circles on top if overlay is enabled and user data exists
		if (showOverlay && userRadarData.length > 0) {
			drawCircles(userRadarData, true);
		}

		// Add legend if showing overlay
		if (showOverlay && userRadarData.length > 0) {
			const legend = g.append('g')
				.attr('class', 'legend')
				.attr('transform', `translate(${size - 60}, 10)`);

			// AI legend item
			legend.append('circle')
				.attr('cx', 8)
				.attr('cy', 0)
				.attr('r', 6)
				.attr('fill', '#6b7280')
				.attr('fill-opacity', 0.5)
				.attr('stroke', '#6b7280')
				.attr('stroke-width', 1);

			legend.append('text')
				.attr('x', 20)
				.attr('y', 4)
				.text('AI')
				.attr('font-size', '8px')
				.attr('fill', '#6b7280')
				.attr('font-weight', '500');

			// User legend item
			legend.append('circle')
				.attr('cx', 8)
				.attr('cy', 15)
				.attr('r', 6)
				.attr('fill', '#6b7280')
				.attr('fill-opacity', 0.3)
				.attr('stroke', '#6b7280')
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', '4,4');

			legend.append('text')
				.attr('x', 20)
				.attr('y', 19)
				.text('User')
				.attr('font-size', '8px')
				.attr('fill', '#6b7280')
				.attr('font-weight', '500');
		}
	}

	onMount(() => {
		mounted = true;
		drawChart();
	});

	$: if (mounted && (radarData || userRadarData)) {
		drawChart();
	}
</script>

<div class="tasting-radar">
	{#if (tastingNotes && radarData.length > 0) || (userTastingNotes && userRadarData.length > 0)}
		<svg
			bind:this={svgElement}
			width={responsive ? '100%' : size}
			height={responsive ? '100%' : size}
			viewBox="0 0 {size} {size}"
			class="overflow-visible {responsive ? 'aspect-square' : ''}"
		></svg>
	{:else}
		<!-- Fallback for missing data -->
		<div
			class="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 {responsive
				? 'aspect-square'
				: ''}"
			style={responsive ? '' : `width: ${size}px; height: ${size}px;`}
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
