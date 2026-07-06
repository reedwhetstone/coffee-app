<script lang="ts">
	import { AXIS_TICK_COLOR } from '$lib/styles/chartColors';
	import { max, sum, group } from 'd3-array';
	import { scaleBand, scaleLinear } from 'd3-scale';
	import { LayerCake, Svg } from 'layercake';
	import { formatDateForDisplay } from '$lib/utils/dates';
	import SalesChartSvg from './SalesChartSvg.svelte';

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
		wholesale?: boolean;
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
		wholesale?: boolean;
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

	const padding = { top: 40, right: 80, bottom: 80, left: 80 };

	// Filter states
	let selectedMetric = $state('revenue');
	let selectedDateRange = $state('all');
	let selectedPurchaseDates = $state<Set<string>>(new Set());
	let purchaseDatesPanelExpanded = $state(false);
	let selectedWholesaleFilter = $state('all');

	// Tooltip state
	let tooltipState = $state({
		visible: false,
		x: 0,
		y: 0,
		data: null as ChartDataPoint | null
	});

	// Metric options
	interface MetricOption {
		value: string;
		label: string;
		format: (v: number) => string;
		color: string;
	}

	const metricOptions: MetricOption[] = [
		{
			value: 'salesCount',
			label: 'Number of Sales',
			format: (v: number) => v.toString(),
			color: '#6D5BD0'
		},
		{
			value: 'ozSold',
			label: 'Oz Sold',
			format: (v: number) => `${v.toFixed(1)} oz`,
			color: '#4E8098'
		},
		{
			value: 'investment',
			label: 'Investment',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: '#9C4356'
		},
		{
			value: 'revenue',
			label: 'Revenue',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: '#7FB069'
		},
		{
			value: 'profit',
			label: 'Profit',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: '#4E8098'
		},
		{
			value: 'margin',
			label: 'Margin %',
			format: (v: number) => `${v.toFixed(1)}%`,
			color: '#6D5BD0'
		},
		{
			value: 'avgPricePerOz',
			label: 'Avg Price/oz',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: '#C05B2E'
		},
		{
			value: 'inventoryTurnover',
			label: 'Inventory Turnover',
			format: (v: number) => `${v.toFixed(1)}%`,
			color: '#586048'
		},
		{
			value: 'cogs',
			label: 'COGS per Bean',
			format: (v: number) => `$${v.toFixed(2)}`,
			color: '#695C4D'
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

		// Filter by wholesale/retail
		if (selectedWholesaleFilter === 'wholesale') {
			filtered = filtered.filter((d: ProfitData) => d.wholesale === true);
		} else if (selectedWholesaleFilter === 'retail') {
			filtered = filtered.filter((d: ProfitData) => d.wholesale !== true);
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
		// const filteredSales = filteredSalesData();

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

	// Compute domains for LayerCake
	let xDomain = $derived(() => chartData().map((d: ChartDataPoint) => d.beanName));
	let yDomain = $derived(
		() => [0, max(chartData(), (d: ChartDataPoint) => d.value) || 0] as [number, number]
	);

	// Metric colors for the bar chart
	function getMetricColor(metric: string, hover = false) {
		const metricConfig = metricOptions.find((m) => m.value === metric);
		const base = metricConfig?.color ?? AXIS_TICK_COLOR;
		if (!hover) return base;
		// Hover state: lighten the brand hex ~12% toward white.
		const [r, g, b] = [1, 3, 5].map((i) => parseInt(base.slice(i, i + 2), 16));
		const lift = (v: number) => Math.round(v + (255 - v) * 0.22);
		return `rgb(${lift(r)} ${lift(g)} ${lift(b)})`;
	}

	function handleTooltipChange(state: {
		visible: boolean;
		x: number;
		y: number;
		data: ChartDataPoint | null;
	}) {
		tooltipState = state;
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
</script>

<!-- Sales Chart Component -->
<section class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm sm:p-6">
	<div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<h2 class="text-2xl font-semibold tracking-tight text-ink">Sales by coffee</h2>
			<p class="mt-1 text-sm text-muted">
				Compare revenue, margin, sell-through, and cost concentration across coffees.
			</p>
		</div>
		<p class="text-sm text-muted">
			{chartData().length} coffee{chartData().length === 1 ? '' : 's'} in view
		</p>
	</div>
	<!-- KPI Summary Panel -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="text-sm font-medium text-muted">Total sales</h3>
			<p class="mt-1 text-3xl font-semibold tabular-nums text-ink">
				{formatNumber(kpiSummary().totalSales)}
			</p>
			<p class="mt-1 text-xs text-muted">Individual transactions</p>
		</div>

		<div class="rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="text-sm font-medium text-muted">Total revenue</h3>
			<p class="mt-1 text-3xl font-semibold tabular-nums text-ink">
				{formatCurrency(kpiSummary().totalRevenue)}
			</p>
			<p class="mt-1 text-xs text-muted">From all sales</p>
		</div>

		<div class="rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="text-sm font-medium text-muted">Total profit</h3>
			<p class="mt-1 text-3xl font-semibold tabular-nums text-ink">
				{formatCurrency(kpiSummary().totalProfit)}
			</p>
			<p class="mt-1 text-xs text-muted">Net after costs</p>
		</div>

		<div class="rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="text-sm font-medium text-muted">Average margin</h3>
			<p class="mt-1 text-3xl font-semibold tabular-nums text-ink">
				{formatPercent(kpiSummary().averageMargin)}
			</p>
			<p class="mt-1 text-xs text-muted">Weighted average</p>
		</div>
	</div>

	<!-- Secondary KPIs -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<div class="rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="text-sm font-medium text-muted">Oz sold</h3>
			<p class="mt-1 text-2xl font-semibold tabular-nums text-ink">
				{kpiSummary().totalOzSold.toFixed(1)}
			</p>
		</div>

		<div class="rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="text-sm font-medium text-muted">Investment</h3>
			<p class="mt-1 text-2xl font-semibold tabular-nums text-ink">
				{formatCurrency(kpiSummary().totalInvestment)}
			</p>
		</div>

		<div class="rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="text-sm font-medium text-muted">Coffee purchased</h3>
			<p class="mt-1 text-2xl font-semibold tabular-nums text-ink">
				{kpiSummary().totalPoundsRoasted.toFixed(1)} lbs
			</p>
		</div>

		<div class="rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="text-sm font-medium text-muted">Sell-through rate</h3>
			<p class="mt-1 text-2xl font-semibold tabular-nums text-ink">
				{formatPercent(kpiSummary().sellThroughRate)}
			</p>
		</div>

		<div class="rounded-lg border border-line bg-surface-canvas p-4">
			<h3 class="text-sm font-medium text-muted">Avg price/oz</h3>
			<p class="mt-1 text-2xl font-semibold tabular-nums text-ink">
				{formatCurrency(kpiSummary().avgSellingPricePerOz)}
			</p>
		</div>
	</div>

	<!-- Filter Controls -->
	<div
		class="mb-6 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex flex-wrap items-center gap-4">
			<!-- Date Range Selector -->
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium text-muted">Period:</span>
				<div class="flex overflow-hidden rounded-md border border-line bg-surface-canvas">
					{#each dateRangeOptions as option}
						<button
							type="button"
							class="px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedDateRange ===
							option.value
								? 'bg-accent text-ink'
								: 'text-muted hover:bg-accent hover:bg-opacity-10 hover:text-ink'}"
							onclick={() => (selectedDateRange = option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Purchase Date Multi-Select Toggle -->
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium text-muted">Purchase Dates:</span>
				<button
					type="button"
					class="flex items-center gap-2 rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-xs transition-all hover:bg-accent hover:bg-opacity-10"
					onclick={() => (purchaseDatesPanelExpanded = !purchaseDatesPanelExpanded)}
				>
					<span class="font-medium text-ink">
						{selectedPurchaseDates.size} selected
					</span>
					<span
						class="text-accent transition-transform duration-200 {purchaseDatesPanelExpanded
							? 'rotate-90'
							: ''}"
					>
						▶
					</span>
				</button>
			</div>

			<!-- Metric Selector -->
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium text-muted">Metric:</span>
				<select
					bind:value={selectedMetric}
					class="rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
				>
					{#each metricOptions as option}
						<option value={option.value}>{option.label}</option>
					{/each}
				</select>
			</div>

			<!-- Wholesale / Retail Filter -->
			<div class="flex items-center gap-2">
				<span class="text-xs font-medium text-muted">Source:</span>
				<div class="flex overflow-hidden rounded-md border border-line bg-surface-canvas">
					<button
						type="button"
						class="px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedWholesaleFilter ===
						'all'
							? 'bg-accent text-ink'
							: 'text-muted hover:bg-accent hover:bg-opacity-10 hover:text-ink'}"
						onclick={() => (selectedWholesaleFilter = 'all')}
					>
						All
					</button>
					<button
						type="button"
						class="px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedWholesaleFilter ===
						'wholesale'
							? 'bg-accent text-ink'
							: 'text-muted hover:bg-accent hover:bg-opacity-10 hover:text-ink'}"
						onclick={() => (selectedWholesaleFilter = 'wholesale')}
					>
						Wholesale
					</button>
					<button
						type="button"
						class="px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedWholesaleFilter ===
						'retail'
							? 'bg-accent text-ink'
							: 'text-muted hover:bg-accent hover:bg-opacity-10 hover:text-ink'}"
						onclick={() => (selectedWholesaleFilter = 'retail')}
					>
						Retail
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Purchase Date Multi-Select Panel -->
	{#if profitData.length > 0 && purchaseDatesPanelExpanded}
		{@const availableDates = [
			...new Set(profitData.map((d: ProfitData) => d.purchase_date))
		].sort() as string[]}
		<div class="mb-6 rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
			<div class="mb-4 flex items-center justify-between">
				<h4 class="text-sm font-medium text-ink">
					Select Purchase Dates ({selectedPurchaseDates.size} of {availableDates.length} selected)
				</h4>
				<div class="flex gap-2">
					<button
						type="button"
						class="rounded-md border border-accent px-2 py-1 text-xs text-accent transition-all hover:bg-accent hover:text-ink"
						onclick={selectAllPurchaseDates}
					>
						All
					</button>
					<button
						type="button"
						class="rounded-md border border-line px-2 py-1 text-xs text-muted transition-all hover:bg-surface-panel hover:text-ink"
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
							class="h-4 w-4 rounded border-line bg-surface-canvas text-accent focus:ring-2 focus:ring-accent"
						/>
						<span class="text-xs text-ink">{formatDateForDisplay(date)}</span>
					</label>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Chart Container -->
	<div class="relative">
		<div class="w-full" style="min-height: 400px; height: 520px;">
			{#if chartData().length > 0}
				<LayerCake
					data={chartData()}
					x={(d: ChartDataPoint) => d.beanName}
					y={(d: ChartDataPoint) => d.value}
					xScale={scaleBand().padding(0.2)}
					yScale={scaleLinear().nice()}
					xDomain={xDomain()}
					yDomain={yDomain()}
					yReverse
					{padding}
				>
					<Svg>
						<SalesChartSvg
							chartData={chartData()}
							metricColor={getMetricColor(selectedMetric)}
							metricHoverColor={getMetricColor(selectedMetric, true)}
							metricLabel={currentMetric().label}
							metricFormat={currentMetric().format}
							onTooltipChange={handleTooltipChange}
						/>
					</Svg>
				</LayerCake>
			{:else}
				<div class="flex h-full items-center justify-center rounded bg-surface-panel bg-opacity-90">
					<div class="text-center">
						<div class="text-sm text-muted">No data available for selected filters</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</section>

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
			class="max-w-xs rounded-lg bg-surface-panel bg-opacity-95 p-4 shadow-lg ring-1 ring-line backdrop-blur-sm"
		>
			<div class="mb-3 text-base font-semibold text-ink">
				{d.beanName}
				{#if d.rawData.profitData.some((p) => p.wholesale)}
					<span class="ml-1 rounded bg-info-subtle px-1 text-xs font-normal text-info-strong"
						>Wholesale</span
					>
				{/if}
			</div>

			<div class="space-y-2 text-xs">
				<div class="flex justify-between">
					<span class="text-muted">Sales Count:</span>
					<span class="font-semibold tabular-nums text-ink"
						>{formatNumber(d.rawData.metrics.salesCount)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-muted">Oz Sold:</span>
					<span class="font-semibold tabular-nums text-ink"
						>{d.rawData.metrics.ozSold.toFixed(1)} oz</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-muted">Investment:</span>
					<span class="font-semibold tabular-nums text-ink"
						>{formatCurrency(d.rawData.metrics.investment)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-muted">Revenue:</span>
					<span class="font-semibold tabular-nums text-ink"
						>{formatCurrency(d.rawData.metrics.revenue)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-muted">Profit:</span>
					<span class="font-semibold tabular-nums text-ink"
						>{formatCurrency(d.rawData.metrics.profit)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-muted">Margin:</span>
					<span class="font-semibold tabular-nums text-ink"
						>{formatPercent(d.rawData.metrics.margin)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-muted">Avg Price/oz:</span>
					<span class="font-semibold tabular-nums text-ink"
						>{formatCurrency(d.rawData.metrics.avgPricePerOz)}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="text-muted">Turnover:</span>
					<span class="font-semibold tabular-nums text-ink"
						>{formatPercent(d.rawData.metrics.inventoryTurnover)}</span
					>
				</div>
			</div>

			<div class="mt-3 border-t border-line pt-3">
				<div class="mb-1 text-xs font-medium text-ink">Current value</div>
				<div class="text-sm font-bold" style="color: {getMetricColor(selectedMetric)}">
					{currentMetric().format(d.value)}
				</div>
			</div>
		</div>
	</div>
{/if}
