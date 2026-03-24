<script lang="ts">
	import { sum, group, max, extent } from 'd3-array';
	import { LayerCake, Svg } from 'layercake';
	import type { PerformanceDataPoint } from '$lib/types/d3.types';
	import PerformanceChartSvg from './PerformanceChartSvg.svelte';

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

	// Props
	let { salesData = [], profitData = [] } = $props<{
		salesData: SaleData[];
		profitData: ProfitData[];
	}>();

	const padding = { top: 40, right: 80, bottom: 60, left: 80 };

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
		data: null as PerformanceDataPoint | null
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

		const range = timeRangeOptions.find((r) => r.value === selectedTimeRange);
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
			} as PerformanceDataPoint;
		});
	}

	function aggregateMonthlyData(salesData: SaleData[]) {
		const monthlyGroups = group(salesData, (d) => {
			const date = new Date(d.sell_date);
			return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
		});

		const result: PerformanceDataPoint[] = [];
		monthlyGroups.forEach((sales, monthKey) => {
			const monthRevenue = sum(sales, (s) => s.price);
			const firstDay = new Date(monthKey + '-01');
			const monthCosts = sum(
				profitData.filter((p: ProfitData) => {
					const pDate = new Date(p.purchase_date);
					return (
						pDate.getFullYear() === firstDay.getFullYear() &&
						pDate.getMonth() === firstDay.getMonth()
					);
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
		return calculateCumulativeData(salesData).map((d) => ({
			...d,
			revenue: d.margin,
			cost: 0,
			target: 25
		}));
	}

	// Compute domains reactively for LayerCake
	let xDomain = $derived.by(() => {
		const data = processedChartData();
		if (data.length === 0) return [new Date(), new Date()] as [Date, Date];
		const ext = extent(data, (d) => new Date(d.date));
		return [ext[0] ?? new Date(), ext[1] ?? new Date()] as [Date, Date];
	});

	let yDomain = $derived.by(() => {
		const data = processedChartData();
		if (data.length === 0) return [0, 100] as [number, number];
		if (selectedViewType === 'margin') {
			return [0, Math.max(max(data, (d) => d.margin) || 0, 100)] as [number, number];
		}
		return [
			0,
			Math.max(
				max(data, (d) => d.revenue) || 0,
				max(data, (d) => d.cost) || 0,
				max(data, (d) => d.target) || 0
			)
		] as [number, number];
	});

	function handleTooltipChange(state: {
		visible: boolean;
		x: number;
		y: number;
		data: PerformanceDataPoint | null;
	}) {
		tooltipState = state;
	}

	// Format functions for tooltip
	const formatCurrency = (value: number) =>
		`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
	const formatPercent = (value: number) => `${value.toFixed(1)}%`;
	const formatDate = (dateStr: string) =>
		new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
</script>

<!-- Enhanced Performance Chart Component -->
<div class="rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
	<!-- Chart Header with Controls -->
	<div class="mb-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h3 class="text-lg font-semibold text-text-primary-light">Sales Performance Dashboard</h3>
				<p class="text-sm text-text-secondary-light">
					Interactive analysis with {selectedTimeRange} data in {viewTypeOptions
						.find((v) => v.value === selectedViewType)
						?.label.toLowerCase()} view
				</p>
			</div>

			<!-- Chart Controls -->
			<div class="flex flex-wrap items-center gap-3">
				<!-- Time Range Selector -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium text-text-secondary-light">Period:</span>
					<div
						class="flex overflow-hidden rounded-md border border-border-light bg-background-primary-light"
					>
						{#each timeRangeOptions as option}
							<button
								type="button"
								class="px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedTimeRange ===
								option.value
									? 'bg-background-tertiary-light text-white'
									: 'text-text-secondary-light hover:bg-background-tertiary-light hover:bg-opacity-10 hover:text-text-primary-light'}"
								onclick={() => (selectedTimeRange = option.value)}
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- View Type Selector -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium text-text-secondary-light">View:</span>
					<div
						class="flex overflow-hidden rounded-md border border-border-light bg-background-primary-light"
					>
						{#each viewTypeOptions as option}
							<button
								type="button"
								class="px-3 py-1.5 text-xs font-medium transition-all duration-200 {selectedViewType ===
								option.value
									? 'bg-background-tertiary-light text-white'
									: 'text-text-secondary-light hover:bg-background-tertiary-light hover:bg-opacity-10 hover:text-text-primary-light'}"
								onclick={() => (selectedViewType = option.value)}
								title={option.description}
							>
								{option.label}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Legend and Line Controls -->
		<div class="mt-4 flex flex-wrap items-center gap-4 border-t border-border-light pt-4">
			<span class="text-xs font-medium text-text-secondary-light">Display:</span>

			{#if selectedViewType !== 'margin'}
				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						bind:checked={showProfitLine}
						class="h-4 w-4 rounded border-border-light bg-background-primary-light text-green-500 focus:ring-2 focus:ring-green-500"
					/>
					<div class="flex items-center gap-2">
						<div class="h-0.5 w-4 rounded bg-green-500"></div>
						<span class="text-xs text-text-primary-light">Revenue</span>
					</div>
				</label>

				<label class="flex cursor-pointer items-center gap-2">
					<input
						type="checkbox"
						bind:checked={showCostLine}
						class="h-4 w-4 rounded border-border-light bg-background-primary-light text-red-500 focus:ring-2 focus:ring-red-500"
					/>
					<div class="flex items-center gap-2">
						<div class="h-0.5 w-4 rounded bg-red-500"></div>
						<span class="text-xs text-text-primary-light">Costs</span>
					</div>
				</label>
			{:else}
				<div class="flex items-center gap-2">
					<div class="h-0.5 w-4 rounded bg-blue-500"></div>
					<span class="text-xs text-text-primary-light">Profit Margin</span>
				</div>
			{/if}

			<label class="flex cursor-pointer items-center gap-2">
				<input
					type="checkbox"
					bind:checked={showTargetLine}
					class="h-4 w-4 rounded border-border-light bg-background-primary-light text-purple-500 focus:ring-2 focus:ring-purple-500"
				/>
				<div class="flex items-center gap-2">
					<div class="h-0.5 w-4 rounded border-t border-dashed bg-purple-500"></div>
					<span class="text-xs text-text-primary-light">Target</span>
				</div>
			</label>
		</div>
	</div>

	<!-- Chart Container -->
	<div class="relative">
		<div class="w-full" style="min-height: 400px; height: 500px;">
			{#if processedChartData().length > 0}
				<LayerCake
					data={processedChartData()}
					x={(d: PerformanceDataPoint) => new Date(d.date).getTime()}
					y={(d: PerformanceDataPoint) => d.revenue}
					xDomain={[xDomain[0].getTime(), xDomain[1].getTime()]}
					{yDomain}
					yReverse
					{padding}
				>
					<Svg>
						<PerformanceChartSvg
							chartData={processedChartData()}
							{selectedViewType}
							{showProfitLine}
							{showCostLine}
							{showTargetLine}
							onTooltipChange={handleTooltipChange}
						/>
					</Svg>
				</LayerCake>
			{:else}
				<div
					class="flex h-full items-center justify-center rounded bg-background-secondary-light bg-opacity-90"
				>
					<div class="text-center">
						<div class="mb-2 text-4xl opacity-50">📊</div>
						<div class="text-sm text-text-secondary-light">No sales data for selected period</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Smart Insights Panel -->
	{#if processedChartData().length > 1}
		<div
			class="mt-6 rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-purple-50 p-4"
		>
			<div class="flex items-start gap-3">
				<div class="flex-shrink-0 rounded-lg bg-blue-100 p-2">
					<svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
						></path>
					</svg>
				</div>
				<div class="flex-1">
					<h4 class="mb-2 font-semibold text-gray-800">📊 Performance Insights</h4>
					{#if processedChartData().length > 0}
						{@const data = processedChartData()}
						{@const latestRevenue = data[data.length - 1]?.revenue || 0}
						{@const earliestRevenue = data[0]?.revenue || 0}
						{@const growthRate =
							earliestRevenue > 0 ? ((latestRevenue - earliestRevenue) / earliestRevenue) * 100 : 0}
						{@const avgMargin = data.reduce((sum, d) => sum + (d.margin || 0), 0) / data.length}
						{@const isGrowthPositive = growthRate > 0}
						{@const isMarginHealthy = avgMargin >= 20}
						<div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
							<div class="flex items-center gap-2 rounded-lg bg-white bg-opacity-50 p-3">
								<span class="text-lg">{isGrowthPositive ? '📈' : '📉'}</span>
								<div>
									<div class="font-medium text-gray-700">
										{selectedViewType === 'margin' ? 'Margin Trend' : 'Revenue Growth'}
									</div>
									<div class="text-xs text-gray-600">
										{#if selectedViewType === 'margin'}
											Average {avgMargin.toFixed(1)}% • {isMarginHealthy
												? 'Healthy'
												: 'Needs attention'}
										{:else}
											{Math.abs(growthRate).toFixed(1)}% {isGrowthPositive
												? 'increase'
												: 'decrease'}
										{/if}
									</div>
								</div>
							</div>

							<div class="flex items-center gap-2 rounded-lg bg-white bg-opacity-50 p-3">
								<span class="text-lg">🎯</span>
								<div>
									<div class="font-medium text-gray-700">Target Performance</div>
									<div class="text-xs text-gray-600">
										{data.filter((d) =>
											selectedViewType === 'margin' ? d.revenue >= d.target : d.revenue >= d.target
										).length} of {data.length} periods meet target ({Math.round(
											(data.filter((d) =>
												selectedViewType === 'margin'
													? d.revenue >= d.target
													: d.revenue >= d.target
											).length /
												data.length) *
												100
										)}%)
									</div>
								</div>
							</div>
						</div>

						{#if selectedViewType === 'cumulative'}
							<div class="mt-3 rounded-lg border-l-4 border-blue-400 bg-blue-50 bg-opacity-70 p-3">
								<div class="text-xs text-gray-700">
									<strong>💡 Recommendation:</strong>
									{#if avgMargin < 15}
										Consider increasing prices or reducing costs - your {avgMargin.toFixed(1)}%
										margin is below industry standards.
									{:else if avgMargin > 30}
										Excellent margins! Consider reinvesting profits into inventory expansion or
										premium equipment.
									{:else}
										Healthy margins! Focus on consistent quality and customer retention to maintain
										growth.
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
	{@const isTargetMet =
		selectedViewType === 'margin' ? d.revenue >= d.target : d.revenue >= d.target}
	{@const targetDiff = selectedViewType === 'margin' ? d.revenue - d.target : d.revenue - d.target}

	{@const tooltipWidth = 300}
	{@const tooltipHeight = 200}
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
			class="max-w-xs rounded-lg bg-background-secondary-light bg-opacity-95 p-4 shadow-lg ring-1 ring-border-light backdrop-blur-sm"
		>
			<div class="mb-3 text-sm font-semibold text-text-primary-light">
				📅 {formatDate(d.date)}
				{#if d.saleData?.wholesale}
					<span class="ml-1 rounded bg-blue-100 px-1 text-xs font-normal text-blue-800"
						>Wholesale</span
					>
				{/if}
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
							<span class="font-semibold {d.profit >= 0 ? 'text-green-500' : 'text-red-500'}"
								>{formatCurrency(d.profit)}</span
							>
						</div>
					{/if}
					<div class="flex justify-between">
						<span class="text-text-secondary-light">Target:</span>
						<span class="font-medium text-purple-500">{formatCurrency(d.target)}</span>
					</div>
				{/if}
			</div>

			<div class="mt-3 border-t border-border-light pt-3">
				<div class="mb-1 text-xs font-medium text-text-primary-light">📊 Performance</div>
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
