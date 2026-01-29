<script lang="ts">
	import { onMount } from 'svelte';
	import type { TastingNotes, RadarDataPoint } from '$lib/types/coffee.types';

	let {
		tastingNotes = null,
		userTastingNotes = null,
		showOverlay = false,
		size = 120,
		responsive = false,
		lazy = true
	} = $props<{
		tastingNotes?: TastingNotes | null;
		userTastingNotes?: TastingNotes | null;
		showOverlay?: boolean;
		size?: number;
		responsive?: boolean;
		lazy?: boolean;
	}>();

	let svgElement = $state<SVGSVGElement>();
	let mounted = $state(false);
	let d3Loaded = $state(false);
	let isVisible = $state(!lazy); // If not lazy, always visible
	let containerElement: HTMLElement;

	const radius = size / 2 - 10; // Leave margin for labels
	const center = size / 2;
	const levels = 5; // 1-5 scale

	// Transform tasting notes to radar data
	let radarData = $derived(tastingNotes ? transformToRadarData(tastingNotes) : []);
	let userRadarData = $derived(userTastingNotes ? transformToRadarData(userTastingNotes) : []);

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

	async function loadD3AndDraw() {
		if (!d3Loaded) {
			// Dynamically import D3 when needed
			const d3Module = await import('d3');
			window.d3 = d3Module; // Store for use in drawChart
			d3Loaded = true;
		}
		drawChart();
	}

	function drawChart() {
		if (!mounted || !svgElement || radarData.length === 0 || !d3Loaded || !window.d3) return;

		const { select } = window.d3;
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

					const circle = g
						.append('circle')
						.attr('cx', centerX)
						.attr('cy', centerY)
						.attr('r', circleRadius)
						.style('cursor', 'pointer');

					if (isUser) {
						// User data styling: lighter fill, dashed stroke
						circle
							.attr('fill', d.color)
							.attr('fill-opacity', 0.5)
							.attr('stroke', d.color)
							.attr('stroke-width', 1)
							.attr('stroke-opacity', 1);
					} else {
						// AI data styling: Single color orange dotted, no fill
						if (showOverlay && userRadarData.length > 0) {
							circle

								.attr('fill-opacity', 0) // % opacity
								.attr('stroke', '#f9a57b')
								.attr('stroke-width', 1.5)
								.attr('stroke-opacity', 0.5)
								.attr('stroke-dasharray', '4,4');
						} else {
							// Original AI styling when no overlay
							circle
								.attr('fill', d.color)
								.attr('fill-opacity', 0.5)
								.attr('stroke', d.color)
								.attr('stroke-width', 1)
								.attr('stroke-opacity', 1);
						}
					}

					circle
						.append('title')
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
			const legend = g
				.append('g')
				.attr('class', 'legend')
				.attr('transform', `translate(${size - 60}, 10)`);

			// AI legend item - orange dotted line with no fill
			legend
				.append('circle')
				.attr('cx', 8)
				.attr('cy', 0)
				.attr('r', 6)
				.attr('fill-opacity', 0)
				.attr('stroke', '#f9a57b')
				.attr('stroke-width', 1.5)
				.attr('stroke-opacity', 0.5)
				.attr('stroke-dasharray', '4,4');

			legend
				.append('text')
				.attr('x', 20)
				.attr('y', 4)
				.text('Supplier')
				.attr('font-size', '8px')
				.attr('fill', '#6b7280')
				.attr('font-weight', '500');

			// User legend item - solid fill with stroke
			legend
				.append('circle')
				.attr('cx', 8)
				.attr('cy', 15)
				.attr('r', 6)
				.attr('fill', '#6b7280')
				.attr('fill-opacity', 0.5)
				.attr('stroke', '#6b7280')
				.attr('stroke-width', 1);

			legend
				.append('text')
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

		// Set up intersection observer if lazy loading is enabled
		if (lazy && containerElement) {
			const observer = new IntersectionObserver(
				([entry]) => {
					if (entry.isIntersecting) {
						isVisible = true;
						observer.unobserve(containerElement);
						// Use requestIdleCallback for better performance
						if (typeof requestIdleCallback !== 'undefined') {
							requestIdleCallback(() => loadD3AndDraw());
						} else {
							setTimeout(() => loadD3AndDraw(), 0);
						}
					}
				},
				{ threshold: 0.1, rootMargin: '50px' }
			);
			observer.observe(containerElement);

			return () => observer.unobserve(containerElement);
		} else {
			// If not lazy, load immediately
			isVisible = true;
			loadD3AndDraw();
		}
	});

	$effect(() => {
		if (mounted && d3Loaded && isVisible && (radarData.length > 0 || userRadarData.length > 0)) {
			drawChart();
		}
	});
</script>

<div class="tasting-radar" bind:this={containerElement}>
	{#if !isVisible || !d3Loaded}
		<!-- Loading skeleton -->
		<div
			class="flex animate-pulse items-center justify-center rounded-lg bg-background-secondary-light/50 {responsive
				? 'aspect-square'
				: ''}"
			style={responsive ? '' : `width: ${size}px; height: ${size}px;`}
		>
			<div class="h-4 w-4 animate-pulse rounded-full bg-background-tertiary-light/20"></div>
		</div>
	{:else if (tastingNotes && radarData.length > 0) || (userTastingNotes && userRadarData.length > 0)}
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
