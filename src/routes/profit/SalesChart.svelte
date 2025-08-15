<script lang="ts">
	import { select, scaleBand, scaleLinear, axisBottom, axisLeft, max, group, sum } from 'd3';
	import { onMount } from 'svelte';
	import { formatDateForDisplay } from '$lib/utils/dates';

	// Data interfaces
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

	interface ChartDataPoint {
		beanName: string;
		value: number;
		rawData: {
			profitData: ProfitData[];
			salesData: SaleData[];
			metrics: {
				salesCount: number;
				ozSold: number;
				investment: number;
				revenue: number;
				profit: number;
				margin: number;
				avgPricePerOz: number;
				inventoryTurnover: number;
				cogs: number;
			};
		};
	}

	// Component props
	let { profitData = [], salesData = [] } = $props<{
		profitData: ProfitData[];
		salesData: SaleData[];
	}>();

	// Chart dimensions and container
	let chartContainer: HTMLDivElement;
	let width: number;
	let height = 400;
	let margin = { top: 40, right: 80, bottom: 80, left: 80 };

	// Filter states
	let selectedMetric = $state('revenue');
	let selectedDateRange = $state('all');
	let selectedPurchaseDates = $state<Set<string>>(new Set());
	let purchaseDatesPanelExpanded = $state(false);

	// Tooltip state
	let tooltipState = $state({
		visible: false,
		x: 0,
		y: 0,
		data: null as ChartDataPoint | null
	});

	// Metric options
	const metricOptions = [
		{
			value: 'salesCount',
			label: 'Number of Sales',
			format: (v: number) => v.toString(),
			color: 'text-indigo-500'
		},
		{
			value: 'ozSold',
			label: 'Oz Sold',
			format: (v: number) => `${v.toFixed(1)} oz`,
			color: 'text-cyan-500'
		},
		{
			value: 'investment',
			label: 'Investment',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: 'text-red-500'
		},
		{
			value: 'revenue',
			label: 'Revenue',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: 'text-green-500'
		},
		{
			value: 'profit',
			label: 'Profit',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: 'text-blue-500'
		},
		{
			value: 'margin',
			label: 'Margin %',
			format: (v: number) => `${v.toFixed(1)}%`,
			color: 'text-purple-500'
		},
		{
			value: 'avgPricePerOz',
			label: 'Avg Price/oz',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: 'text-orange-500'
		},
		{
			value: 'inventoryTurnover',
			label: 'Inventory Turnover',
			format: (v: number) => `${v.toFixed(1)}%`,
			color: 'text-teal-500'
		},
		{
			value: 'cogs',
			label: 'COGS per Bean',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: 'text-gray-500'
		}
	];

	// Date range options
	const dateRangeOptions = [
		{ value: 'all', label: 'All Time' },
		{ value: '30', label: 'Last 30 Days' },
		{ value: '180', label: 'Last 6 Months' },
		{ value: 'ytd', label: 'Year to Date' }
	];

	// Initialize purchase date selection with most recent date when data first loads
	let hasInitializedDates = false;
	$effect(() => {
		if (profitData.length > 0 && !hasInitializedDates) {
			const dates = [
				...new Set(profitData.map((d: ProfitData) => d.purchase_date))
			].sort() as string[];
			if (dates.length > 0) {
				selectedPurchaseDates.add(dates[dates.length - 1]); // Most recent date
				selectedPurchaseDates = new Set(selectedPurchaseDates);
				hasInitializedDates = true;
			}
		}
	});

	// Filter data based on selected filters
	let filteredProfitData = $derived(() => {
		let filtered = profitData;

		// Filter by date range
		if (selectedDateRange !== 'all') {
			const now = new Date();
			let cutoffDate = new Date();

			if (selectedDateRange === '30') {
				cutoffDate.setDate(now.getDate() - 30);
			} else if (selectedDateRange === '180') {
				cutoffDate.setDate(now.getDate() - 180);
			} else if (selectedDateRange === 'ytd') {
				cutoffDate = new Date(now.getFullYear(), 0, 1);
			}

			filtered = filtered.filter((d: ProfitData) => new Date(d.purchase_date) >= cutoffDate);
		}

		// Filter by selected purchase dates
		if (selectedPurchaseDates.size > 0) {
			filtered = filtered.filter((d: ProfitData) => selectedPurchaseDates.has(d.purchase_date));
		}

		return filtered;
	});

	let filteredSalesData = $derived(() => {
		return salesData.filter((sale: SaleData) => {
			const coffeeName = sale.coffee_name;
			return (
				coffeeName && filteredProfitData().some((p: ProfitData) => p.coffee_name === coffeeName)
			);
		});
	});

	// Process chart data
	let chartData = $derived(() => {
		const filtered = filteredProfitData();
		const filteredSales = filteredSalesData();

		const beanGroups = group(filtered, (d: ProfitData) => d.coffee_name);
		const result: ChartDataPoint[] = [];

		beanGroups.forEach((profitItems, beanName) => {
			const beanSales = filteredSalesData().filter((s: SaleData) => s.coffee_name === beanName);

			// Calculate metrics
			const salesCount = beanSales.length;
			const ozSold = sum(beanSales, (d: SaleData) => d.oz_sold);
			const investment = sum(profitItems, (d: ProfitData) => d.bean_cost + d.tax_ship_cost);
			const revenue = sum(profitItems, (d: ProfitData) => d.total_sales);
			const profit = sum(profitItems, (d: ProfitData) => d.profit);
			const totalOzPurchased = sum(
				profitItems,
				(d: ProfitData) => d.purchased_qty_lbs * 16 + d.purchased_qty_oz
			);
			const avgPricePerOz = ozSold > 0 ? revenue / ozSold : 0;
			const inventoryTurnover = totalOzPurchased > 0 ? (ozSold / totalOzPurchased) * 100 : 0;
			const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
			const cogs = investment; // Cost of goods sold per bean

			const metrics = {
				salesCount,
				ozSold,
				investment,
				revenue,
				profit,
				margin,
				avgPricePerOz,
				inventoryTurnover,
				cogs
			};

			const value = metrics[selectedMetric as keyof typeof metrics] || 0;

			result.push({
				beanName: beanName as string,
				value,
				rawData: {
					profitData: profitItems as ProfitData[],
					salesData: beanSales,
					metrics
				}
			});
		});

		return result.sort((a, b) => b.value - a.value);
	});

	// Calculate KPI summary
	let kpiSummary = $derived(() => {
		const totalSales = sum(filteredSalesData(), (d: SaleData) => d.oz_sold);
		const totalRevenue = sum(filteredProfitData(), (d: ProfitData) => d.total_sales);
		const totalInvestment = sum(
			filteredProfitData(),
			(d: ProfitData) => d.bean_cost + d.tax_ship_cost
		);
		const totalProfit = sum(filteredProfitData(), (d: ProfitData) => d.profit);
		const totalOzPurchased = sum(
			filteredProfitData(),
			(d: ProfitData) => d.purchased_qty_lbs * 16 + d.purchased_qty_oz
		);
		const totalPoundsRoasted = sum(filteredProfitData(), (d: ProfitData) => d.purchased_qty_lbs);
		const sellThroughRate = totalOzPurchased > 0 ? (totalSales / totalOzPurchased) * 100 : 0;

		return {
			totalSales: filteredSalesData().length,
			totalOzSold: totalSales,
			totalInvestment,
			totalRevenue,
			totalProfit,
			averageMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
			avgSellingPricePerOz: totalSales > 0 ? totalRevenue / totalSales : 0,
			inventoryTurnover: sellThroughRate,
			totalCogs: totalInvestment,
			totalPoundsRoasted,
			sellThroughRate
		};
	});

	// Get current metric config
	let currentMetric = $derived(() => {
		return metricOptions.find((m) => m.value === selectedMetric) || metricOptions[3];
	});

	// Chart creation effect
	$effect(() => {
		if (chartContainer && chartData().length > 0) {
			createChart();
		}
	});

	function createChart() {
		// Get container width
		width = chartContainer.clientWidth - margin.left - margin.right;

		// Clear existing chart
		select(chartContainer).selectAll('*').remove();

		// Create SVG
		const svg = select(chartContainer)
			.append('svg')
			.attr('width', '100%')
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', `translate(${margin.left},${margin.top})`);

		// Create scales
		const xScale = scaleBand()
			.domain(chartData().map((d: ChartDataPoint) => d.beanName))
			.range([0, width])
			.padding(0.2);

		const yScale = scaleLinear()
			.domain([0, max(chartData(), (d: ChartDataPoint) => d.value) || 0])
			.range([height, 0])
			.nice();

		// Add grid lines
		svg
			.append('g')
			.attr('class', 'grid')
			.attr('transform', `translate(0,${height})`)
			.call(
				axisBottom(xScale)
					.tickSize(-height)
					.tickFormat(() => '')
			)
			.style('stroke-dasharray', '2,2')
			.style('opacity', 0.1)
			.style('stroke', 'rgb(156 163 175)');

		svg
			.append('g')
			.attr('class', 'grid')
			.call(
				axisLeft(yScale)
					.tickSize(-width)
					.tickFormat(() => '')
			)
			.style('stroke-dasharray', '2,2')
			.style('opacity', 0.1)
			.style('stroke', 'rgb(156 163 175)');

		// Add axes
		svg
			.append('g')
			.attr('class', 'x-axis')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(xScale))
			.style('color', 'rgb(156 163 175)')
			.selectAll('text')
			.style('fill', 'rgb(156 163 175)')
			.style('font-size', '12px')
			.attr('transform', 'rotate(-45)')
			.style('text-anchor', 'end');

		svg
			.append('g')
			.attr('class', 'y-axis')
			.call(axisLeft(yScale).tickFormat((d) => currentMetric().format(d as number)))
			.style('color', 'rgb(156 163 175)')
			.selectAll('text')
			.style('fill', 'rgb(156 163 175)')
			.style('font-size', '12px');

		// Create bars with colors based on metric
		const bars = svg
			.selectAll('.bar')
			.data(chartData())
			.enter()
			.append('rect')
			.attr('class', 'bar')
			.attr('x', (d: ChartDataPoint) => xScale(d.beanName) || 0)
			.attr('width', xScale.bandwidth())
			.attr('y', height)
			.attr('height', 0)
			.attr('fill', getMetricColor(selectedMetric))
			.style('cursor', 'pointer')
			.on('mouseover', function (event: any, d: ChartDataPoint) {
				// Highlight bar
				select(this).attr('fill', getMetricColor(selectedMetric, true));

				// Show tooltip
				tooltipState.visible = true;
				tooltipState.x = event.clientX;
				tooltipState.y = event.clientY;
				tooltipState.data = d;
			})
			.on('mouseout', function () {
				// Reset bar color
				select(this).attr('fill', getMetricColor(selectedMetric));

				// Hide tooltip
				tooltipState.visible = false;
				tooltipState.data = null;
			});

		// Animate bars
		bars
			.transition()
			.duration(750)
			.attr('y', (d: ChartDataPoint) => yScale(d.value))
			.attr('height', (d: ChartDataPoint) => height - yScale(d.value));

		// Add axis labels
		svg
			.append('text')
			.attr('transform', 'rotate(-90)')
			.attr('y', 0 - margin.left)
			.attr('x', 0 - height / 2)
			.attr('dy', '1em')
			.style('text-anchor', 'middle')
			.style('fill', 'rgb(156 163 175)')
			.style('font-size', '12px')
			.text(currentMetric().label);

		svg
			.append('text')
			.attr('transform', `translate(${width / 2}, ${height + margin.bottom - 10})`)
			.style('text-anchor', 'middle')
			.style('fill', 'rgb(156 163 175)')
			.style('font-size', '12px')
			.text('Coffee Beans');
	}

	function getMetricColor(metric: string, hover = false) {
		const metricConfig = metricOptions.find((m) => m.value === metric);
		if (!metricConfig) return 'rgb(156 163 175)';

		// Convert Tailwind color class to RGB
		const colorMap: Record<string, string> = {
			'text-indigo-500': hover ? 'rgb(99 102 241)' : 'rgb(79 70 229)',
			'text-cyan-500': hover ? 'rgb(6 182 212)' : 'rgb(14 165 233)',
			'text-red-500': hover ? 'rgb(239 68 68)' : 'rgb(220 38 38)',
			'text-green-500': hover ? 'rgb(34 197 94)' : 'rgb(22 163 74)',
			'text-blue-500': hover ? 'rgb(59 130 246)' : 'rgb(37 99 235)',
			'text-purple-500': hover ? 'rgb(168 85 247)' : 'rgb(147 51 234)',
			'text-orange-500': hover ? 'rgb(249 115 22)' : 'rgb(234 88 12)',
			'text-teal-500': hover ? 'rgb(20 184 166)' : 'rgb(13 148 136)',
			'text-gray-500': hover ? 'rgb(107 114 128)' : 'rgb(75 85 99)'
		};

		return colorMap[metricConfig.color] || 'rgb(156 163 175)';
	}

	// Purchase date management functions
	function togglePurchaseDate(date: string) {
		if (selectedPurchaseDates.has(date)) {
			selectedPurchaseDates.delete(date);
		} else {
			selectedPurchaseDates.add(date);
		}
		selectedPurchaseDates = new Set(selectedPurchaseDates);
	}

	function selectAllPurchaseDates() {
		const dates = [...new Set(profitData.map((d: ProfitData) => d.purchase_date))] as string[];
		selectedPurchaseDates = new Set(dates);
	}

	function clearPurchaseDateSelection() {
		selectedPurchaseDates = new Set();
	}

	// Format functions for tooltip
	const formatCurrency = (value: number) =>
		`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	const formatPercent = (value: number) => `${value.toFixed(1)}%`;
	const formatNumber = (value: number) => value.toLocaleString();

	// Resize handler
	onMount(() => {
		const handleResize = () => {
			if (chartData().length > 0) {
				createChart();
			}
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
</script>

<!-- Sales Chart Component -->
<div class="bg-background-secondary-light ring-border-light rounded-lg">
	<!-- KPI Summary Panel -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="bg-background-primary-light ring-border-light rounded-lg p-4 ring-1">
			<h3 class="text-text-primary-light text-sm font-medium">Total Sales</h3>
			<p class="mt-1 text-2xl font-bold text-indigo-500">{formatNumber(kpiSummary().totalSales)}</p>
			<p class="text-text-secondary-light mt-1 text-xs">Individual transactions</p>
		</div>

		<div class="bg-background-primary-light ring-border-light rounded-lg p-4 ring-1">
			<h3 class="text-text-primary-light text-sm font-medium">Total Revenue</h3>
			<p class="mt-1 text-2xl font-bold text-green-500">
				{formatCurrency(kpiSummary().totalRevenue)}
			</p>
			<p class="text-text-secondary-light mt-1 text-xs">From all sales</p>
		</div>

		<div class="bg-background-primary-light ring-border-light rounded-lg p-4 ring-1">
			<h3 class="text-text-primary-light text-sm font-medium">Total Profit</h3>
			<p class="mt-1 text-2xl font-bold text-blue-500">
				{formatCurrency(kpiSummary().totalProfit)}
			</p>
			<p class="text-text-secondary-light mt-1 text-xs">Net after costs</p>
		</div>

		<div class="bg-background-primary-light ring-border-light rounded-lg p-4 ring-1">
			<h3 class="text-text-primary-light text-sm font-medium">Avg Margin</h3>
			<p class="mt-1 text-2xl font-bold text-purple-500">
				{formatPercent(kpiSummary().averageMargin)}
			</p>
			<p class="text-text-secondary-light mt-1 text-xs">Weighted average</p>
		</div>
	</div>

	<!-- Secondary KPIs -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<div class="bg-background-primary-light ring-border-light rounded-lg p-4 ring-1">
			<h3 class="text-text-primary-light text-sm font-medium">Oz Sold</h3>
			<p class="mt-1 text-xl font-bold text-cyan-500">{kpiSummary().totalOzSold.toFixed(1)}</p>
		</div>

		<div class="bg-background-primary-light ring-border-light rounded-lg p-4 ring-1">
			<h3 class="text-text-primary-light text-sm font-medium">Investment</h3>
			<p class="mt-1 text-xl font-bold text-red-500">
				{formatCurrency(kpiSummary().totalInvestment)}
			</p>
		</div>

		<div class="bg-background-primary-light ring-border-light rounded-lg p-4 ring-1">
			<h3 class="text-text-primary-light text-sm font-medium">Coffee Purchased</h3>
			<p class="mt-1 text-xl font-bold text-indigo-500">
				{kpiSummary().totalPoundsRoasted.toFixed(1)} lbs
			</p>
		</div>

		<div class="bg-background-primary-light ring-border-light rounded-lg p-4 ring-1">
			<h3 class="text-text-primary-light text-sm font-medium">Sell-Through Rate</h3>
			<p class="mt-1 text-xl font-bold text-orange-500">
				{formatPercent(kpiSummary().sellThroughRate)}
			</p>
		</div>

		<div class="bg-background-primary-light ring-border-light rounded-lg p-4 ring-1">
			<h3 class="text-text-primary-light text-sm font-medium">Avg Price/oz</h3>
			<p class="mt-1 text-xl font-bold text-teal-500">
				{formatCurrency(kpiSummary().avgSellingPricePerOz)}
			</p>
		</div>
	</div>

	<!-- Filter Controls -->
	<div
		class="border-border-light mb-6 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex flex-wrap items-center gap-4">
			<!-- Date Range Selector -->
			<div class="flex items-center gap-2">
				<span class="text-text-secondary-light text-xs font-medium">Period:</span>
				<div
					class="border-border-light bg-background-primary-light flex overflow-hidden rounded-md border"
				>
					{#each dateRangeOptions as option}
						<button
							type="button"
							class="px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedDateRange ===
							option.value
								? 'bg-background-tertiary-light text-white'
								: 'text-text-secondary-light hover:bg-background-tertiary-light hover:text-text-primary-light hover:bg-opacity-10'}"
							onclick={() => (selectedDateRange = option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Purchase Date Multi-Select Toggle -->
			<div class="flex items-center gap-2">
				<span class="text-text-secondary-light text-xs font-medium">Purchase Dates:</span>
				<button
					type="button"
					class="border-border-light bg-background-primary-light hover:bg-background-tertiary-light flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-all hover:bg-opacity-10"
					onclick={() => (purchaseDatesPanelExpanded = !purchaseDatesPanelExpanded)}
				>
					<span class="text-text-primary-light font-medium">
						{selectedPurchaseDates.size} selected
					</span>
					<span
						class="text-background-tertiary-light transition-transform duration-200 {purchaseDatesPanelExpanded
							? 'rotate-90'
							: ''}"
					>
						▶
					</span>
				</button>
			</div>

			<!-- Metric Selector -->
			<div class="flex items-center gap-2">
				<span class="text-text-secondary-light text-xs font-medium">Metric:</span>
				<select
					bind:value={selectedMetric}
					class="border-border-light bg-background-primary-light text-text-primary-light focus:ring-background-tertiary-light rounded-md border px-3 py-1.5 text-xs focus:outline-none focus:ring-2"
				>
					{#each metricOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Purchase Date Multi-Select Panel -->
	{#if profitData.length > 0 && purchaseDatesPanelExpanded}
		{@const availableDates = [
			...new Set(profitData.map((d: ProfitData) => d.purchase_date))
		].sort() as string[]}
		<div class="bg-background-primary-light ring-border-light mb-6 rounded-lg p-4 ring-1">
			<div class="mb-4 flex items-center justify-between">
				<h4 class="text-text-primary-light text-sm font-medium">
					Select Purchase Dates ({selectedPurchaseDates.size} of {availableDates.length} selected)
				</h4>
				<div class="flex gap-2">
					<button
						type="button"
						class="border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light rounded-md border px-2 py-1 text-xs transition-all hover:text-white"
						onclick={selectAllPurchaseDates}
					>
						All
					</button>
					<button
						type="button"
						class="rounded-md border border-gray-400 px-2 py-1 text-xs text-gray-600 transition-all hover:bg-gray-400 hover:text-white"
						onclick={clearPurchaseDateSelection}
					>
						Clear
					</button>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
				{#each availableDates as date (date)}
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={selectedPurchaseDates.has(date)}
							onchange={() => togglePurchaseDate(date)}
							class="border-border-light bg-background-primary-light text-background-tertiary-light focus:ring-background-tertiary-light h-4 w-4 rounded focus:ring-2"
						/>
						<span class="text-text-primary-light text-xs">{formatDateForDisplay(date)}</span>
					</label>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Chart Container -->
	<div class="relative">
		<div bind:this={chartContainer} class="w-full" style="min-height: 400px;"></div>
		{#if chartData().length === 0}
			<div
				class="bg-background-secondary-light absolute inset-0 flex items-center justify-center rounded bg-opacity-90"
			>
				<div class="text-center">
					<div class="mb-2 text-4xl opacity-50">📊</div>
					<div class="text-text-secondary-light text-sm">
						No data available for selected filters
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Interactive Tooltip -->
{#if tooltipState.visible && tooltipState.data}
	{@const d = tooltipState.data}
	{@const tooltipWidth = 320}
	{@const tooltipHeight = 280}
	{@const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200}
	{@const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800}
	{@const leftPos =
		tooltipState.x + tooltipWidth + 15 > viewportWidth
			? tooltipState.x - tooltipWidth - 15
			: tooltipState.x + 15}
	{@const topPos =
		tooltipState.y + tooltipHeight + 15 > viewportHeight
			? tooltipState.y - tooltipHeight - 15
			: tooltipState.y + 15}

	<div
		class="pointer-events-none fixed z-[1000] transition-all duration-200 ease-out"
		style="left: {leftPos}px; top: {topPos}px;"
	>
		<div
			class="bg-background-secondary-light ring-border-light max-w-xs rounded-lg bg-opacity-95 p-4 shadow-lg ring-1 backdrop-blur-sm"
		>
			<div class="text-text-primary-light mb-3 text-sm font-semibold">
				☕ {d.beanName}
			</div>

			<div class="space-y-2 text-xs">
				<div class="flex justify-between">
					<span class="text-text-secondary-light">Sales Count:</span>
					<span class="font-semibold text-indigo-500"
						>{formatNumber(d.rawData.metrics.salesCount)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-text-secondary-light">Oz Sold:</span>
					<span class="font-semibold text-cyan-500">{d.rawData.metrics.ozSold.toFixed(1)} oz</span>
				</div>
				<div class="flex justify-between">
					<span class="text-text-secondary-light">Investment:</span>
					<span class="font-semibold text-red-500"
						>{formatCurrency(d.rawData.metrics.investment)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-text-secondary-light">Revenue:</span>
					<span class="font-semibold text-green-500"
						>{formatCurrency(d.rawData.metrics.revenue)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-text-secondary-light">Profit:</span>
					<span class="font-semibold text-blue-500">{formatCurrency(d.rawData.metrics.profit)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-text-secondary-light">Margin:</span>
					<span class="font-semibold text-purple-500"
						>{formatPercent(d.rawData.metrics.margin)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-text-secondary-light">Avg Price/oz:</span>
					<span class="font-semibold text-orange-500"
						>{formatCurrency(d.rawData.metrics.avgPricePerOz)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-text-secondary-light">Turnover:</span>
					<span class="font-semibold text-teal-500"
						>{formatPercent(d.rawData.metrics.inventoryTurnover)}</span
					>
				</div>
			</div>

			<div class="border-border-light mt-3 border-t pt-3">
				<div class="text-text-primary-light mb-1 text-xs font-medium">📊 Current Value</div>
				<div class="text-sm font-bold" style="color: {getMetricColor(selectedMetric)}">
					{currentMetric().format(d.value)}
				</div>
			</div>
		</div>
	</div>
{/if}
