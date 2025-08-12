<script lang="ts">
	import {
		sum,
		group,
		select,
		extent,
		max,
		axisBottom,
		axisLeft,
		scaleLinear,
		scaleTime,
		curveMonotoneX,
		line,
		area,
		pointer
	} from 'd3';
	import { onMount } from 'svelte';

	interface SaleData {
		id: number;
		green_coffee_inv_id: number;
		oz_sold: number;
		price: number;
		buyer: string;
		batch_name: string;
		sell_date: string;
		purchase_date: string;
		coffee_name?: string;
		totalCost?: number;
	}

	interface ProfitData {
		id: number;
		purchase_date: string;
		coffee_name: string;
		purchased_qty_lbs: number;
		purchased_qty_oz: number;
		bean_cost: number;
		tax_ship_cost: number;
		total_sales: number;
		oz_sold: number;
		oz_in: number;
		oz_out: number;
		profit: number;
		profit_margin: number;
	}

	// Props
	let { salesData = [], profitData = [] } = $props<{
		salesData: SaleData[];
		profitData: ProfitData[];
	}>();

	// Chart dimensions and container
	let chartContainer: HTMLDivElement;
	let width: number;
	let height = 400;
	let margin = { top: 40, right: 80, bottom: 60, left: 80 };

	// Chart control states
	let selectedTimeRange = $state('All');
	let selectedViewType = $state('cumulative');
	let showProfitLine = $state(true);
	let showCostLine = $state(true);
	let showTargetLine = $state(true);

	// Tooltip state for smooth management
	let tooltipState = $state({
		visible: false,
		x: 0,
		y: 0,
		data: null as any
	});

	// Time range options
	const timeRangeOptions = [
		{ label: '3M', value: '3M', months: 3 },
		{ label: '6M', value: '6M', months: 6 },
		{ label: 'YTD', value: 'YTD', months: 12 },
		{ label: 'All', value: 'All', months: null }
	];

	// View type options
	const viewTypeOptions = [
		{ label: 'Cumulative', value: 'cumulative', description: 'Running totals over time' },
		{ label: 'Monthly', value: 'monthly', description: 'Monthly aggregated values' },
		{ label: 'Profit %', value: 'margin', description: 'Profit margin percentage' }
	];

	// Filter data based on selected time range
	let filteredSalesData = $derived(() => {
		if (selectedTimeRange === 'All') return salesData;
		
		const range = timeRangeOptions.find(r => r.value === selectedTimeRange);
		if (!range || !range.months) return salesData;
		
		const cutoffDate = new Date();
		cutoffDate.setMonth(cutoffDate.getMonth() - range.months);
		
		return salesData.filter((sale: SaleData) => new Date(sale.sell_date) >= cutoffDate);
	});

	// Process data based on selected view type
	let processedChartData = $derived(() => {
		const data = filteredSalesData();
		if (selectedViewType === 'monthly') {
			return aggregateMonthlyData(data);
		} else if (selectedViewType === 'margin') {
			return calculateMarginData(data);
		}
		return calculateCumulativeData(data);
	});

	// Data processing functions
	function calculateCumulativeData(salesData: SaleData[]) {
		const sortedSales = [...salesData].sort(
			(a, b) => new Date(a.sell_date).getTime() - new Date(b.sell_date).getTime()
		);

		const sortedProfitData = [...profitData].sort(
			(a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime()
		);

		let runningRevenue = 0;
		let runningCost = 0;

		return sortedSales.map((sale) => {
			runningRevenue += sale.price;
			// Find all costs up to this sale date
			runningCost = sum(
				sortedProfitData.filter((p) => new Date(p.purchase_date) <= new Date(sale.sell_date)),
				(p) => (+p.bean_cost || 0) + (+p.tax_ship_cost || 0)
			);

			// Calculate target based on inventory
			const lbsPurchased = sum(
				sortedProfitData.filter((p) => new Date(p.purchase_date) <= new Date(sale.sell_date)),
				(p) => +p.purchased_qty_lbs || 0
			);
			const lbsSold = sum(
				sortedSales.filter((s) => new Date(s.sell_date) <= new Date(sale.sell_date)),
				(s) => (+s.oz_sold || 0) / 16
			);
			const targetRevenue = (lbsPurchased - lbsSold) * 18 + runningRevenue;

			return {
				date: sale.sell_date,
				revenue: runningRevenue,
				cost: runningCost,
				profit: runningRevenue - runningCost,
				target: targetRevenue,
				margin: runningRevenue > 0 ? ((runningRevenue - runningCost) / runningRevenue) * 100 : 0,
				saleData: sale
			};
		});
	}

	function aggregateMonthlyData(salesData: SaleData[]) {
		const monthlyGroups = group(salesData, (d) => {
			const date = new Date(d.sell_date);
			return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		});

		const result: any[] = [];
		monthlyGroups.forEach((sales, monthKey) => {
			const monthRevenue = sum(sales, (s) => s.price);
			const firstDay = new Date(monthKey + '-01');
			const monthCosts = sum(
				profitData.filter((p: ProfitData) => {
					const pDate = new Date(p.purchase_date);
					return pDate.getFullYear() === firstDay.getFullYear() && 
						   pDate.getMonth() === firstDay.getMonth();
				}),
				(p: ProfitData) => (+p.bean_cost || 0) + (+p.tax_ship_cost || 0)
			);

			result.push({
				date: firstDay.toISOString(),
				revenue: monthRevenue,
				cost: monthCosts,
				profit: monthRevenue - monthCosts,
				target: monthRevenue * 1.3,
				margin: monthRevenue > 0 ? ((monthRevenue - monthCosts) / monthRevenue) * 100 : 0,
				salesCount: sales.length
			});
		});

		return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	}

	function calculateMarginData(salesData: SaleData[]) {
		return calculateCumulativeData(salesData).map(d => ({
			...d,
			revenue: d.margin,
			cost: 0,
			target: 25
		}));
	}

	// Reactive chart updates
	$effect(() => {
		if (chartContainer && (salesData.length > 0 || profitData.length > 0)) {
			createChart();
		}
	});

	// Main chart creation function
	function createChart() {
		// Get the container width
		width = chartContainer.clientWidth - margin.left - margin.right;

		// Clear existing chart
		select(chartContainer).selectAll('*').remove();

		const chartData = processedChartData();
		if (!chartData.length) return;

		// Create SVG
		const svg = select(chartContainer)
			.append('svg')
			.attr('width', '100%')
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Create dynamic scales based on view type
		const xScale = scaleTime()
			.domain(extent(chartData, (d) => new Date(d.date)) as [Date, Date])
			.range([0, width]);

		let yDomain: [number, number];
		if (selectedViewType === 'margin') {
			yDomain = [0, Math.max(max(chartData, (d) => d.margin) || 0, 100)];
		} else {
			yDomain = [
				0,
				Math.max(
					max(chartData, (d) => d.revenue) || 0,
					max(chartData, (d) => d.cost) || 0,
					max(chartData, (d) => d.target) || 0
				)
			];
		}

		const yScale = scaleLinear()
			.domain(yDomain)
			.range([height, 0]);

		// Enhanced axes with better formatting
		const xAxis = axisBottom(xScale)
			.tickFormat((d) => {
				const date = d as Date;
				if (selectedViewType === 'monthly') {
					return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
				}
				return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
			})
			.ticks(6);

		const yAxisFormat = selectedViewType === 'margin' 
			? (d: any) => `${d}%`
			: (d: any) => `$${d.toLocaleString()}`;
		
		const yAxis = axisLeft(yScale)
			.tickFormat(yAxisFormat)
			.ticks(6);

		// Add grid lines (following UI framework subtle styling)
		svg.append('g')
			.attr('class', 'grid')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(xScale)
				.tickSize(-height)
				.tickFormat(() => '')
			)
			.style('stroke-dasharray', '2,2')
			.style('opacity', 0.1)
			.style('stroke', 'rgb(156 163 175)');

		svg.append('g')
			.attr('class', 'grid')
			.call(axisLeft(yScale)
				.tickSize(-width)
				.tickFormat(() => '')
			)
			.style('stroke-dasharray', '2,2')
			.style('opacity', 0.1)
			.style('stroke', 'rgb(156 163 175)');

		// Add styled axes
		svg
			.append('g')
			.attr('class', 'x-axis')
			.attr('transform', `translate(0,${height})`)
			.call(xAxis)
			.style('color', 'rgb(156 163 175)')
			.selectAll('text')
			.style('fill', 'rgb(156 163 175)')
			.style('font-size', '12px');

		svg.append('g')
			.attr('class', 'y-axis')
			.call(yAxis)
			.style('color', 'rgb(156 163 175)')
			.selectAll('text')
			.style('fill', 'rgb(156 163 175)')
			.style('font-size', '12px');

		// Create line generators with improved styling
		const revenueLine = line<any>()
			.x((d) => xScale(new Date(d.date)))
			.y((d) => yScale(d.revenue))
			.curve(curveMonotoneX);

		const costLine = line<any>()
			.x((d) => xScale(new Date(d.date)))
			.y((d) => yScale(d.cost))
			.curve(curveMonotoneX);

		const targetLine = line<any>()
			.x((d) => xScale(new Date(d.date)))
			.y((d) => yScale(d.target))
			.curve(curveMonotoneX);

		// Add gradient definitions (following UI framework semantic colors)
		const defs = svg.append('defs');

		// Revenue gradient (semantic green)
		const revenueGradient = defs.append('linearGradient')
			.attr('id', 'revenueGradient')
			.attr('x1', '0%').attr('y1', '0%')
			.attr('x2', '0%').attr('y2', '100%');
		revenueGradient.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', 'rgb(34 197 94)')
			.attr('stop-opacity', 0.8);
		revenueGradient.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', 'rgb(34 197 94)')
			.attr('stop-opacity', 0.1);

		// Add area fills first (behind lines)
		if (showProfitLine && selectedViewType !== 'margin') {
			svg.append('path')
				.datum(chartData)
				.attr('fill', 'url(#revenueGradient)')
				.attr('d', area<any>()
					.x((d) => xScale(new Date(d.date)))
					.y0(height)
					.y1((d) => yScale(d.revenue))
					.curve(curveMonotoneX)
				);
		}

		// Add enhanced lines with conditional visibility (semantic colors from UI framework)
		if (showProfitLine) {
			svg
				.append('path')
				.datum(chartData)
				.attr('fill', 'none')
				.attr('stroke', selectedViewType === 'margin' ? 'rgb(59 130 246)' : 'rgb(34 197 94)')
				.attr('stroke-width', 3)
				.attr('stroke-linecap', 'round')
				.attr('d', revenueLine)
				.style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))');
		}

		if (showCostLine && selectedViewType !== 'margin') {
			svg
				.append('path')
				.datum(chartData)
				.attr('fill', 'none')
				.attr('stroke', 'rgb(239 68 68)')
				.attr('stroke-width', 2)
				.attr('stroke-linecap', 'round')
				.attr('d', costLine)
				.style('filter', 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))');
		}

		if (showTargetLine) {
			svg
				.append('path')
				.datum(chartData)
				.attr('fill', 'none')
				.attr('stroke', 'rgb(139 92 246)')
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', '8,4')
				.attr('stroke-linecap', 'round')
				.attr('d', targetLine)
				.style('opacity', 0.7);
		}

		// Add interactive overlay for smooth tooltip management
		addInteractiveOverlay(svg, chartData, xScale, yScale);

		// Enhanced interactive legend
		addLegend(svg, width);
	}

	function addInteractiveOverlay(svg: any, chartData: any[], xScale: any, yScale: any) {
		// Create overlay for capturing mouse events
		const overlay = svg
			.append('rect')
			.attr('class', 'overlay')
			.attr('width', width)
			.attr('height', height)
			.attr('fill', 'transparent')
			.style('cursor', 'crosshair');

		// Mouse tracking with smooth state management
		overlay
			.on('mouseover', function() {
				tooltipState.visible = true;
			})
			.on('mousemove', function(this: SVGRectElement, event: any) {
				try {
					const [mouseX] = pointer(event, this);
					const x0 = xScale.invert(mouseX);
					
					// Find closest data point
					let closestIndex = 0;
					let minDistance = Math.abs(new Date(chartData[0].date).getTime() - x0.getTime());
					
					for (let i = 1; i < chartData.length; i++) {
						const distance = Math.abs(new Date(chartData[i].date).getTime() - x0.getTime());
						if (distance < minDistance) {
							minDistance = distance;
							closestIndex = i;
						}
					}
					
					const d = chartData[closestIndex];
					
					if (d) {
						// Get mouse position relative to viewport
						const rect = chartContainer.getBoundingClientRect();
						const mouseX = event.clientX;
						const mouseY = event.clientY;
						
						// Update tooltip state smoothly
						tooltipState.data = d;
						tooltipState.x = mouseX;
						tooltipState.y = mouseY;
						
						// Show vertical line indicator
						showVerticalIndicator(svg, xScale(new Date(d.date)));
					}
				} catch (error) {
					console.warn('Tooltip error:', error);
				}
			})
			.on('mouseout', function() {
				tooltipState.visible = false;
				tooltipState.data = null;
				hideVerticalIndicator(svg);
			});
	}

	function showVerticalIndicator(svg: any, xPos: number) {
		// Remove existing indicator
		svg.selectAll('.hover-line').remove();
		
		// Add new indicator
		svg.append('line')
			.attr('class', 'hover-line')
			.attr('x1', xPos)
			.attr('x2', xPos)
			.attr('y1', 0)
			.attr('y2', height)
			.attr('stroke', 'rgb(156 163 175)')
			.attr('stroke-width', 1)
			.attr('stroke-dasharray', '3,3')
			.style('opacity', 0.7);
	}

	function hideVerticalIndicator(svg: any) {
		svg.selectAll('.hover-line').remove();
	}

	function addLegend(svg: any, width: number) {
		const legend = svg
			.append('g')
			.attr('class', 'legend')
			.attr('transform', `translate(${width - 140}, 20)`);

		const legendItems = [
			{ 
				label: selectedViewType === 'margin' ? 'Profit Margin' : 'Revenue', 
				color: selectedViewType === 'margin' ? 'rgb(59 130 246)' : 'rgb(34 197 94)',
				visible: showProfitLine,
				dashed: false
			},
			{ 
				label: 'Costs', 
				color: 'rgb(239 68 68)',
				visible: showCostLine && selectedViewType !== 'margin',
				dashed: false
			},
			{ 
				label: selectedViewType === 'margin' ? 'Target (25%)' : 'Target', 
				color: 'rgb(139 92 246)',
				visible: showTargetLine,
				dashed: true
			}
		].filter(item => item.visible);

		legendItems.forEach((item, i) => {
			const legendGroup = legend.append('g')
				.attr('transform', `translate(0, ${i * 22})`)
				.style('cursor', 'pointer')
				.style('opacity', 0.9)
				.on('mouseover', function(this: SVGGElement) {
					select(this).style('opacity', 1);
				})
				.on('mouseout', function(this: SVGGElement) {
					select(this).style('opacity', 0.9);
				});

			legendGroup
				.append('line')
				.attr('x1', 0)
				.attr('x2', 20)
				.attr('y1', 0)
				.attr('y2', 0)
				.attr('stroke', item.color)
				.attr('stroke-width', 2.5)
				.attr('stroke-linecap', 'round')
				.attr('stroke-dasharray', item.dashed ? '6,3' : 'none');

			legendGroup
				.append('text')
				.attr('x', 28)
				.attr('y', 4)
				.text(item.label)
				.style('fill', 'rgb(156 163 175)')
				.style('font-size', '12px')
				.style('font-weight', '500');
		});
	}

	// Format functions for tooltip
	const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	const formatPercent = (value: number) => `${value.toFixed(1)}%`;
	const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', {
		weekday: 'short',
		month: 'short', 
		day: 'numeric',
		year: 'numeric'
	});

	// Resize handler
	onMount(() => {
		const handleResize = () => {
			createChart();
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<!-- Enhanced Performance Chart Component -->
<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
	<!-- Chart Header with Controls -->
	<div class="mb-6">
		<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h3 class="text-lg font-semibold text-text-primary-light">Sales Performance Dashboard</h3>
				<p class="text-sm text-text-secondary-light">
					Interactive analysis with {selectedTimeRange} data in {viewTypeOptions.find(v => v.value === selectedViewType)?.label.toLowerCase()} view
				</p>
			</div>
			
			<!-- Chart Controls -->
			<div class="flex flex-wrap items-center gap-3">
				<!-- Time Range Selector -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium text-text-secondary-light">Period:</span>
					<div class="flex rounded-md border border-border-light overflow-hidden bg-background-primary-light">
						{#each timeRangeOptions as option}
							<button
								type="button"
								class="px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedTimeRange === option.value 
									? 'bg-background-tertiary-light text-white' 
									: 'text-text-secondary-light hover:text-text-primary-light hover:bg-background-tertiary-light hover:bg-opacity-10'}"
								onclick={() => selectedTimeRange = option.value}
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- View Type Selector -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium text-text-secondary-light">View:</span>
					<div class="flex rounded-md border border-border-light overflow-hidden bg-background-primary-light">
						{#each viewTypeOptions as option}
							<button
								type="button"
								class="px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedViewType === option.value 
									? 'bg-background-tertiary-light text-white' 
									: 'text-text-secondary-light hover:text-text-primary-light hover:bg-background-tertiary-light hover:bg-opacity-10'}"
								onclick={() => selectedViewType = option.value}
								title="{option.description}"
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Legend and Line Controls -->
		<div class="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-border-light">
			<span class="text-xs font-medium text-text-secondary-light">Display:</span>
			
			{#if selectedViewType !== 'margin'}
				<label class="flex items-center gap-2 cursor-pointer">
					<input 
						type="checkbox" 
						bind:checked={showProfitLine}
						class="w-4 h-4 text-green-500 bg-background-primary-light border-border-light rounded focus:ring-green-500 focus:ring-2"
					/>
					<div class="flex items-center gap-2">
						<div class="w-4 h-0.5 bg-green-500 rounded"></div>
						<span class="text-xs text-text-primary-light">Revenue</span>
					</div>
				</label>

				<label class="flex items-center gap-2 cursor-pointer">
					<input 
						type="checkbox" 
						bind:checked={showCostLine}
						class="w-4 h-4 text-red-500 bg-background-primary-light border-border-light rounded focus:ring-red-500 focus:ring-2"
					/>
					<div class="flex items-center gap-2">
						<div class="w-4 h-0.5 bg-red-500 rounded"></div>
						<span class="text-xs text-text-primary-light">Costs</span>
					</div>
				</label>
			{:else}
				<div class="flex items-center gap-2">
					<div class="w-4 h-0.5 bg-blue-500 rounded"></div>
					<span class="text-xs text-text-primary-light">Profit Margin</span>
				</div>
			{/if}

			<label class="flex items-center gap-2 cursor-pointer">
				<input 
					type="checkbox" 
					bind:checked={showTargetLine}
					class="w-4 h-4 text-purple-500 bg-background-primary-light border-border-light rounded focus:ring-purple-500 focus:ring-2"
				/>
				<div class="flex items-center gap-2">
					<div class="w-4 h-0.5 bg-purple-500 rounded border-t border-dashed"></div>
					<span class="text-xs text-text-primary-light">Target</span>
				</div>
			</label>
		</div>
	</div>

	<!-- Chart Container -->
	<div class="relative">
		<div bind:this={chartContainer} class="w-full" style="min-height: 400px;"></div>
		{#if !processedChartData().length}
			<div class="absolute inset-0 flex items-center justify-center bg-background-secondary-light bg-opacity-90 rounded">
				<div class="text-center">
					<div class="text-4xl mb-2 opacity-50">📊</div>
					<div class="text-sm text-text-secondary-light">No sales data for selected period</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Smart Insights Panel -->
	{#if processedChartData().length > 1}
		<div class="mt-6 p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100">
			<div class="flex items-start gap-3">
				<div class="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
					<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
				</div>
				<div class="flex-1">
					<h4 class="font-semibold text-gray-800 mb-2">📊 Performance Insights</h4>
					{#if processedChartData().length > 0}
						{@const data = processedChartData()}
						{@const latestRevenue = data[data.length - 1]?.revenue || 0}
						{@const earliestRevenue = data[0]?.revenue || 0}
						{@const growthRate = earliestRevenue > 0 ? ((latestRevenue - earliestRevenue) / earliestRevenue) * 100 : 0}
						{@const avgMargin = data.reduce((sum, d) => sum + (d.margin || 0), 0) / data.length}
						{@const isGrowthPositive = growthRate > 0}
						{@const isMarginHealthy = avgMargin >= 20}
						<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">

							<div class="flex items-center gap-2 p-3 bg-white bg-opacity-50 rounded-lg">
								<span class="text-lg">{isGrowthPositive ? '📈' : '📉'}</span>
								<div>
									<div class="font-medium text-gray-700">
										{selectedViewType === 'margin' ? 'Margin Trend' : 'Revenue Growth'}
									</div>
									<div class="text-xs text-gray-600">
										{#if selectedViewType === 'margin'}
											Average {avgMargin.toFixed(1)}% • {isMarginHealthy ? 'Healthy' : 'Needs attention'}
										{:else}
											{Math.abs(growthRate).toFixed(1)}% {isGrowthPositive ? 'increase' : 'decrease'}
										{/if}
									</div>
								</div>
							</div>

							<div class="flex items-center gap-2 p-3 bg-white bg-opacity-50 rounded-lg">
								<span class="text-lg">🎯</span>
								<div>
									<div class="font-medium text-gray-700">Target Performance</div>
									<div class="text-xs text-gray-600">
										{data.filter(d => selectedViewType === 'margin' ? d.revenue >= d.target : d.revenue >= d.target).length} of {data.length} periods meet target ({Math.round(data.filter(d => selectedViewType === 'margin' ? d.revenue >= d.target : d.revenue >= d.target).length/data.length*100)}%)
									</div>
								</div>
							</div>
						</div>
						
						{#if selectedViewType === 'cumulative'}
							<div class="mt-3 p-3 bg-blue-50 bg-opacity-70 rounded-lg border-l-4 border-blue-400">
								<div class="text-xs text-gray-700">
									<strong>💡 Recommendation:</strong>
									{#if avgMargin < 15}
										Consider increasing prices or reducing costs - your {avgMargin.toFixed(1)}% margin is below industry standards.
									{:else if avgMargin > 30}
										Excellent margins! Consider reinvesting profits into inventory expansion or premium equipment.
									{:else}
										Healthy margins! Focus on consistent quality and customer retention to maintain growth.
									{/if}
								</div>
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Smooth Tooltip Implementation (Following UI Framework) -->
{#if tooltipState.visible && tooltipState.data}
	{@const d = tooltipState.data}
	{@const isTargetMet = selectedViewType === 'margin' ? d.revenue >= d.target : d.revenue >= d.target}
	{@const targetDiff = selectedViewType === 'margin' ? d.revenue - d.target : d.revenue - d.target}
	
	{@const tooltipWidth = 300}
	{@const tooltipHeight = 200}
	{@const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200}
	{@const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800}
	{@const leftPos = tooltipState.x + tooltipWidth + 15 > viewportWidth ? tooltipState.x - tooltipWidth - 15 : tooltipState.x + 15}
	{@const topPos = tooltipState.y + tooltipHeight + 15 > viewportHeight ? tooltipState.y - tooltipHeight - 15 : tooltipState.y + 15}
	
	<div 
		class="fixed z-[1000] pointer-events-none transition-all duration-200 ease-out"
		style="left: {leftPos}px; top: {topPos}px;"
	>
		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light shadow-lg backdrop-blur-sm bg-opacity-95 max-w-xs">
			<div class="font-semibold text-text-primary-light mb-3 text-sm">
				📅 {formatDate(d.date)}
			</div>
			
			<div class="space-y-2 text-xs">
				{#if selectedViewType === 'margin'}
					<div class="flex justify-between">
						<span class="text-text-secondary-light">Profit Margin:</span>
						<span class="font-semibold text-blue-500">{formatPercent(d.revenue)}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-text-secondary-light">Target:</span>
						<span class="font-medium text-purple-500">{formatPercent(d.target)}</span>
					</div>
				{:else}
					<div class="flex justify-between">
						<span class="text-text-secondary-light">Revenue:</span>
						<span class="font-semibold text-green-500">{formatCurrency(d.revenue)}</span>
					</div>
					{#if selectedViewType !== 'margin'}
						<div class="flex justify-between">
							<span class="text-text-secondary-light">Costs:</span>
							<span class="font-medium text-red-500">{formatCurrency(d.cost)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-text-secondary-light">Profit:</span>
							<span class="font-semibold {d.profit >= 0 ? 'text-green-500' : 'text-red-500'}">{formatCurrency(d.profit)}</span>
						</div>
					{/if}
					<div class="flex justify-between">
						<span class="text-text-secondary-light">Target:</span>
						<span class="font-medium text-purple-500">{formatCurrency(d.target)}</span>
					</div>
				{/if}
			</div>
			
			<div class="mt-3 pt-3 border-t border-border-light">
				<div class="text-xs font-medium text-text-primary-light mb-1">📊 Performance</div>
				<div class="text-xs {isTargetMet ? 'text-green-600' : 'text-orange-600'}">
					{isTargetMet ? '✅ On track' : '⚠️ Below target'} 
					{#if selectedViewType === 'margin'}
						({Math.abs(targetDiff).toFixed(1)}% {isTargetMet ? 'above' : 'below'})
					{:else}
						({formatCurrency(Math.abs(targetDiff))})
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}