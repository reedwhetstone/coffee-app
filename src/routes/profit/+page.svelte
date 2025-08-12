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
		line
	} from 'd3';
	import { onMount } from 'svelte';
import { area } from 'd3';
	import SaleForm from './SaleForm.svelte';
	import { page } from '$app/state';
	import type { PageData } from './$types';

	// Lazy load the profit cards component
	let ProfitCards = $state<any>(null);
	let profitCardsLoading = $state(true);

	interface ProfitData {
		id: number;
		purchase_date: string;
		coffee_name: string;
		purchased_qty_lbs: number;
		purchased_qty_oz: number;
		bean_cost: number; // Raw cost of beans
		tax_ship_cost: number; // Additional costs
		total_sales: number; // Total revenue from sales
		oz_sold: number; // Amount sold in ounces
		oz_in: number; // Amount roasted in ounces
		oz_out: number; // output after roast (accounts for water loss during roast)
		profit: number; // Calculated profit
		profit_margin: number; // Profit margin as percentage
	}

	interface RoastProfileData {
		roast_id: number;
		coffee_id: number;
		oz_in: number;
		oz_out: number;
	}

	// Add new interfaces and variables for sales functionality
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

	// Convert state variables to use $state
	let profitData = $state<ProfitData[]>([]);
	let roastProfileData = $state<RoastProfileData[]>([]);
	let chartContainer: HTMLDivElement;
	let expandedDates = $state(new Set<string>());
	let salesData = $state<SaleData[]>([]);
	let isFormVisible = $state(false);
	let selectedSale = $state<SaleData | null>(null);
	let selectedCoffee = $state<string | null>(null);
	let width: number;
	let height = 400;
	let margin = { top: 40, right: 80, bottom: 60, left: 80 };

	// Chart control states
	let selectedTimeRange = $state('All');
	let selectedViewType = $state('cumulative');
	let showProfitLine = $state(true);
	let showCostLine = $state(true);
	let showTargetLine = $state(true);

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

	let { data } = $props<{ data: PageData }>();

	// Convert reactive statements to use $derived
	let totalRevenue = $derived(sum(profitData, (d) => +d.total_sales || 0));
	let totalCost = $derived(sum(profitData, (d) => (+d.bean_cost || 0) + (+d.tax_ship_cost || 0)));
	let totalProfit = $derived(sum(profitData, (d) => +d.profit || 0));

	let averageMargin = $derived(() => {
		// Calculate cost per oz for each item
		const margins = profitData.map((d) => {
			const totalOz = (+d.purchased_qty_lbs || 0) * 16 + (+d.purchased_qty_oz || 0);
			const costPerOz = totalOz ? ((+d.bean_cost || 0) + (+d.tax_ship_cost || 0)) / totalOz : 0;
			const soldCost = costPerOz * (+d.oz_sold || 0);
			const sales = +d.total_sales || 0;
			return sales > 0 ? ((sales - soldCost) / sales) * 100 : 0;
		});

		// Calculate weighted average margin based on sales
		const totalSales = sum(profitData, (d) => +d.total_sales || 0);
		return totalSales > 0
			? sum(margins.map((margin, i) => margin * (+profitData[i].total_sales || 0))) / totalSales
			: 0;
	});

	let totalPoundsRoasted = $derived(sum(profitData, (d) => +d.purchased_qty_lbs || 0));
	let sellThroughRate = $derived(() => {
		const totalOzSold = sum(profitData, (d) => +d.oz_sold || 0);
		const totalOzPurchased = sum(profitData, (d) => (+d.purchased_qty_lbs || 0) * 16);
		return totalOzPurchased > 0 ? (totalOzSold / totalOzPurchased) * 100 : 0;
	});

	let avgCostPerPound = $derived(() => (totalPoundsRoasted ? totalCost / totalPoundsRoasted : 0));
	let avgRevenuePerPound = $derived(() =>
		totalPoundsRoasted ? totalRevenue / totalPoundsRoasted : 0
	);
	let avgProfitPerPound = $derived(() =>
		totalPoundsRoasted ? totalProfit / totalPoundsRoasted : 0
	);

	let roastLossRate = $derived(() => {
		// Group roast data by coffee_id
		const roastsByBean = group(roastProfileData, (d) => d.coffee_id);

		// Sum up oz_in and oz_out for each coffee
		let totalOzIn = 0;
		let totalOzOut = 0;

		roastsByBean.forEach((roasts) => {
			totalOzIn += sum(roasts, (d) => Number(d.oz_in) || 0);
			totalOzOut += sum(roasts, (d) => Number(d.oz_out) || 0);
		});

		// Calculate loss rate if we have valid data
		return totalOzIn > 0 ? ((totalOzIn - totalOzOut) / totalOzIn) * 100 : 0;
	});

	// Filter data based on selected time range
	let filteredSalesData = $derived(() => {
		if (selectedTimeRange === 'All') return salesData;
		
		const range = timeRangeOptions.find(r => r.value === selectedTimeRange);
		if (!range || !range.months) return salesData;
		
		const cutoffDate = new Date();
		cutoffDate.setMonth(cutoffDate.getMonth() - range.months);
		
		return salesData.filter(sale => new Date(sale.sell_date) >= cutoffDate);
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
				profitData.filter((p) => {
					const pDate = new Date(p.purchase_date);
					return pDate.getFullYear() === firstDay.getFullYear() && 
						   pDate.getMonth() === firstDay.getMonth();
				}),
				(p) => (+p.bean_cost || 0) + (+p.tax_ship_cost || 0)
			);

			result.push({
				date: firstDay.toISOString(),
				revenue: monthRevenue,
				cost: monthCosts,
				profit: monthRevenue - monthCosts,
				target: monthRevenue * 1.3, // 30% target markup
				margin: monthRevenue > 0 ? ((monthRevenue - monthCosts) / monthRevenue) * 100 : 0,
				salesCount: sales.length
			});
		});

		return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	}

	function calculateMarginData(salesData: SaleData[]) {
		return calculateCumulativeData(salesData).map(d => ({
			...d,
			revenue: d.margin, // Use margin as primary metric
			cost: 0, // Don't show cost line in margin view
			target: 25 // 25% target margin
		}));
	}

	// Reactive chart updates
	$effect(() => {
		if (chartContainer && (salesData.length > 0 || profitData.length > 0)) {
			createChart();
		}
	});

	// Add sales chart related functions
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

		// Add grid lines
		svg.append('g')
			.attr('class', 'grid')
			.attr('transform', `translate(0,${height})`)
			.call(axisBottom(xScale)
				.tickSize(-height)
				.tickFormat(() => '')
			)
			.style('stroke-dasharray', '2,2')
			.style('opacity', 0.1)
			.style('stroke', 'currentColor');

		svg.append('g')
			.attr('class', 'grid')
			.call(axisLeft(yScale)
				.tickSize(-width)
				.tickFormat(() => '')
			)
			.style('stroke-dasharray', '2,2')
			.style('opacity', 0.1)
			.style('stroke', 'currentColor');

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

		// Add gradient definitions
		const defs = svg.append('defs');

		// Revenue gradient (green)
		const revenueGradient = defs.append('linearGradient')
			.attr('id', 'revenueGradient')
			.attr('x1', '0%').attr('y1', '0%')
			.attr('x2', '0%').attr('y2', '100%');
		revenueGradient.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', '#10b981')
			.attr('stop-opacity', 0.8);
		revenueGradient.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', '#10b981')
			.attr('stop-opacity', 0.1);

		// Cost gradient (red)
		const costGradient = defs.append('linearGradient')
			.attr('id', 'costGradient')
			.attr('x1', '0%').attr('y1', '0%')
			.attr('x2', '0%').attr('y2', '100%');
		costGradient.append('stop')
			.attr('offset', '0%')
			.attr('stop-color', '#ef4444')
			.attr('stop-opacity', 0.6);
		costGradient.append('stop')
			.attr('offset', '100%')
			.attr('stop-color', '#ef4444')
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

		// Add enhanced lines with conditional visibility
		if (showProfitLine) {
			svg
				.append('path')
				.datum(chartData)
				.attr('fill', 'none')
				.attr('stroke', selectedViewType === 'margin' ? '#3b82f6' : '#10b981')
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
				.attr('stroke', '#ef4444')
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
				.attr('stroke', '#8b5cf6')
				.attr('stroke-width', 2)
				.attr('stroke-dasharray', '8,4')
				.attr('stroke-linecap', 'round')
				.attr('d', targetLine)
				.style('opacity', 0.7);
		}

		// Enhanced interactive legend
		const legend = svg
			.append('g')
			.attr('class', 'legend')
			.attr('transform', `translate(${width - 140}, 20)`);

		const legendItems = [
			{ 
				label: selectedViewType === 'margin' ? 'Profit Margin' : 'Revenue', 
				color: selectedViewType === 'margin' ? '#3b82f6' : '#10b981',
				visible: showProfitLine,
				dashed: false
			},
			{ 
				label: 'Costs', 
				color: '#ef4444',
				visible: showCostLine && selectedViewType !== 'margin',
				dashed: false
			},
			{ 
				label: selectedViewType === 'margin' ? 'Target (25%)' : 'Target', 
				color: '#8b5cf6',
				visible: showTargetLine,
				dashed: true
			}
		].filter(item => item.visible);

		legendItems.forEach((item, i) => {
			const legendGroup = legend.append('g')
				.attr('transform', `translate(0, ${i * 22})`)
				.style('cursor', 'pointer')
				.style('opacity', 0.9)
				.on('mouseover', function() {
					select(this).style('opacity', 1);
				})
				.on('mouseout', function() {
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

		// Add interactive data points with enhanced styling
		const pointsGroup = svg.append('g').attr('class', 'data-points');

		// Add hover area for better interactivity
		const hoverArea = pointsGroup
			.selectAll('.hover-area')
			.data(chartData)
			.enter()
			.append('rect')
			.attr('class', 'hover-area')
			.attr('x', (d, i) => {
				const currentX = xScale(new Date(d.date));
				const prevX = i > 0 ? xScale(new Date(chartData[i - 1].date)) : 0;
				const nextX = i < chartData.length - 1 ? xScale(new Date(chartData[i + 1].date)) : width;
				return (prevX + currentX) / 2;
			})
			.attr('y', 0)
			.attr('width', (d, i) => {
				const currentX = xScale(new Date(d.date));
				const prevX = i > 0 ? xScale(new Date(chartData[i - 1].date)) : 0;
				const nextX = i < chartData.length - 1 ? xScale(new Date(chartData[i + 1].date)) : width;
				return (nextX - prevX) / 2;
			})
			.attr('height', height)
			.attr('fill', 'transparent')
			.on('mouseover', function (event, d) {
				// Remove existing hover elements first
				svg.selectAll('.hover-line').remove();
				
				// Highlight the vertical line
				const xPos = xScale(new Date(d.date));
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

				// Show enhanced tooltip
				showEnhancedTooltip(event, d);
			})
			.on('mousemove', function (event, d) {
				// Update tooltip position on mouse move without recreating it
				const existingTooltip = select('.enhanced-tooltip');
				if (!existingTooltip.empty()) {
					// Position tooltip smartly to avoid going off-screen
					const tooltipWidth = 300;
					const tooltipHeight = 200;
					const viewportWidth = window.innerWidth;
					const viewportHeight = window.innerHeight;
					
					let leftPos = event.pageX + 15;
					let topPos = event.pageY - 10;
					
					if (leftPos + tooltipWidth > viewportWidth) {
						leftPos = event.pageX - tooltipWidth - 15;
					}
					
					if (topPos + tooltipHeight > viewportHeight) {
						topPos = event.pageY - tooltipHeight - 10;
					}
					
					existingTooltip
						.style('left', leftPos + 'px')
						.style('top', topPos + 'px');
				}
			})
			.on('mouseout', function () {
				svg.selectAll('.hover-line').remove();
				hideTooltip();
			});

		// Add visible data points for key metrics
		if (showProfitLine) {
			pointsGroup
				.selectAll('.revenue-point')
				.data(chartData.filter((_, i) => i % Math.max(1, Math.floor(chartData.length / 10)) === 0))
				.enter()
				.append('circle')
				.attr('class', 'revenue-point')
				.attr('cx', (d) => xScale(new Date(d.date)))
				.attr('cy', (d) => yScale(d.revenue))
				.attr('r', 4)
				.attr('fill', selectedViewType === 'margin' ? '#3b82f6' : '#10b981')
				.attr('stroke', 'white')
				.attr('stroke-width', 2)
				.style('filter', 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15))')
				.style('opacity', 0);
		}

		// Show points on hover
		hoverArea.on('mouseover.points', function() {
			pointsGroup.selectAll('circle').style('opacity', 1);
		}).on('mouseout.points', function() {
			pointsGroup.selectAll('circle').style('opacity', 0);
		});
	}


	// Enhanced tooltip system with proper management
	function showEnhancedTooltip(event: MouseEvent, d: any) {
		// Remove any existing tooltips first
		hideTooltip();
		
		const tooltip = select('body')
			.append('div')
			.attr('class', 'enhanced-tooltip')
			.style('position', 'absolute')
			.style('background', 'rgba(17, 24, 39, 0.95)')
			.style('backdrop-filter', 'blur(8px)')
			.style('border', '1px solid rgba(75, 85, 99, 0.3)')
			.style('border-radius', '12px')
			.style('padding', '16px')
			.style('color', 'white')
			.style('font-size', '13px')
			.style('font-family', 'system-ui, -apple-system, sans-serif')
			.style('box-shadow', '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)')
			.style('max-width', '300px')
			.style('z-index', '1000')
			.style('pointer-events', 'none'); // Prevent tooltip from interfering with mouse events

		const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
		const formatPercent = (value: number) => `${value.toFixed(1)}%`;
		const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short', 
			day: 'numeric',
			year: 'numeric'
		});

		// Calculate insights
		const profitMargin = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
		const isTargetMet = selectedViewType === 'margin' ? d.revenue >= d.target : d.revenue >= d.target;
		const targetDiff = selectedViewType === 'margin' 
			? d.revenue - d.target
			: d.revenue - d.target;

		let insightHtml = '';
		if (selectedViewType === 'margin') {
			insightHtml = `
				<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(75, 85, 99, 0.3);">
					<div style="font-weight: 600; color: #f3f4f6; margin-bottom: 8px;">📊 Performance Insights</div>
					<div style="color: ${isTargetMet ? '#10b981' : '#f59e0b'}; font-weight: 500;">
						${isTargetMet ? '✅' : '⚠️'} ${isTargetMet ? 'Above' : 'Below'} target by ${Math.abs(targetDiff).toFixed(1)}%
					</div>
				</div>
			`;
		} else {
			insightHtml = `
				<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(75, 85, 99, 0.3);">
					<div style="font-weight: 600; color: #f3f4f6; margin-bottom: 8px;">📊 Performance Insights</div>
					<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
						<span style="color: #9ca3af;">Profit Margin:</span>
						<span style="color: ${profitMargin >= 25 ? '#10b981' : profitMargin >= 15 ? '#f59e0b' : '#ef4444'}; font-weight: 600;">
							${formatPercent(profitMargin)}
						</span>
					</div>
					<div style="color: ${isTargetMet ? '#10b981' : '#f59e0b'}; font-weight: 500;">
						${isTargetMet ? '✅ On track' : '⚠️ Below target'} (${formatCurrency(Math.abs(targetDiff))})
					</div>
				</div>
			`;
		}

		let contentHtml = '';
		if (selectedViewType === 'margin') {
			contentHtml = `
				<div style="font-weight: 600; color: #f3f4f6; margin-bottom: 12px; font-size: 14px;">
					📈 ${formatDate(d.date)}
				</div>
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span style="color: #9ca3af;">Profit Margin:</span>
					<span style="color: #3b82f6; font-weight: 600; font-size: 16px;">${formatPercent(d.revenue)}</span>
				</div>
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span style="color: #9ca3af;">Target:</span>
					<span style="color: #8b5cf6; font-weight: 500;">${formatPercent(d.target)}</span>
				</div>
			`;
		} else {
			contentHtml = `
				<div style="font-weight: 600; color: #f3f4f6; margin-bottom: 12px; font-size: 14px;">
					📅 ${formatDate(d.date)}
				</div>
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span style="color: #9ca3af;">Revenue:</span>
					<span style="color: #10b981; font-weight: 600; font-size: 16px;">${formatCurrency(d.revenue)}</span>
				</div>
				${selectedViewType !== 'margin' ? `
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span style="color: #9ca3af;">Costs:</span>
					<span style="color: #ef4444; font-weight: 500;">${formatCurrency(d.cost)}</span>
				</div>
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span style="color: #9ca3af;">Profit:</span>
					<span style="color: ${d.profit >= 0 ? '#10b981' : '#ef4444'}; font-weight: 600;">${formatCurrency(d.profit)}</span>
				</div>
				` : ''}
				<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
					<span style="color: #9ca3af;">Target:</span>
					<span style="color: #8b5cf6; font-weight: 500;">${formatCurrency(d.target)}</span>
				</div>
			`;
		}

		// Position tooltip smartly to avoid going off-screen
		const tooltipWidth = 300;
		const tooltipHeight = 200; // Approximate height
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		
		let leftPos = event.pageX + 15;
		let topPos = event.pageY - 10;
		
		// Adjust if tooltip would go off right edge
		if (leftPos + tooltipWidth > viewportWidth) {
			leftPos = event.pageX - tooltipWidth - 15;
		}
		
		// Adjust if tooltip would go off bottom edge
		if (topPos + tooltipHeight > viewportHeight) {
			topPos = event.pageY - tooltipHeight - 10;
		}

		tooltip
			.html(contentHtml + insightHtml)
			.style('left', leftPos + 'px')
			.style('top', topPos + 'px')
			.style('opacity', 0)
			.transition()
			.duration(150)
			.style('opacity', 1);
	}


	function hideTooltip() {
		// Remove all tooltip instances immediately to prevent cascading
		select('.enhanced-tooltip').remove();
		select('.tooltip').remove(); // Legacy fallback
	}

	// Add sales form handlers
	async function handleFormSubmit(saleData: any) {
		try {
			const response = await fetch(`/api/profit${selectedSale ? `?id=${selectedSale.id}` : ''}`, {
				method: selectedSale ? 'PUT' : 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(saleData)
			});

			if (!response.ok) {
				throw new Error(`Failed to ${selectedSale ? 'update' : 'create'} sale`);
			}

			// Refresh the sales data for the selected coffee
			await fetchSalesForCoffee(salesData[0].coffee_name || '');
		} catch (error) {
			console.error('Error updating sales data:', error);
		}
		isFormVisible = false;
		selectedSale = null;
	}

	async function fetchSalesForCoffee(coffeeName: string) {
		try {
			const response = await fetch(`/api/profit?coffee=${encodeURIComponent(coffeeName)}`);
			if (response.ok) {
				const data = await response.json();
				salesData = data.sales || [];
				setTimeout(() => {
					createChart();
				}, 0);
			}
		} catch (error) {
			console.error('Error fetching sales data:', error);
		}
	}

	// Modify toggleDate to set the selected coffee
	function toggleDate(dateParam: string) {
		const date = dateParam;
		if (expandedDates.has(date)) {
			expandedDates.delete(date);
			salesData = [];
			selectedCoffee = null; // Clear selected coffee when closing
		} else {
			expandedDates.add(date);
			// Get the first coffee for this date
			const items = group(profitData, (d) => d.purchase_date).get(date) || [];
			if (items.length > 0) {
				selectedCoffee = items[0].coffee_name; // Set selected coffee
				fetchSalesForCoffee(items[0].coffee_name);
			}
		}
		// Create a new Set to trigger reactivity in Svelte 5
		expandedDates = new Set(expandedDates);
	}

	function handleSelectCoffee({ coffeeName, date }: { coffeeName: string; date: string }) {
		// If coffeeName is empty, hide sales
		if (coffeeName === '') {
			selectedCoffee = null;
			salesData = [];
		} else {
			selectedCoffee = coffeeName;
			fetchSalesForCoffee(coffeeName);
		}
	}

	function handleSaleEdit(sale: SaleData) {
		selectedSale = sale;
		isFormVisible = true;
	}

	async function handleSaleDelete(id: number) {
		try {
			const response = await fetch(`/api/profit?id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				if (selectedCoffee) {
					await fetchSalesForCoffee(selectedCoffee);
				}
			} else {
				alert('Failed to delete sale');
			}
		} catch (error) {
			console.error('Error deleting sale:', error);
		}
	}

	// Convert onMount to use $effect
	$effect(() => {
		const fetchData = async () => {
			await Promise.all([fetchProfitData(), fetchRoastProfileData(), fetchInitialSalesData()]);
			createChart();

			// Check if we should show the sale form based on the page state
			const state = page.state as any;
			console.log('Profit page state:', state);

			if (state?.showSaleForm) {
				console.log('Should show sale form based on state flag');
				setTimeout(() => {
					showSaleForm();
				}, 100);
			}
		};

		fetchData();

		// Add event listener for the custom show-sale-form event
		window.addEventListener('show-sale-form', showSaleForm);

		const handleResize = () => {
			createChart();
		};

		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('show-sale-form', showSaleForm);
		};
	});

	async function fetchProfitData() {
		try {
			const response = await fetch('/api/profit');
			if (response.ok) {
				const data = await response.json();
				profitData = data.profit || [];
			}
		} catch (error) {
			console.error('Error fetching profit data:', error);
		}
	}

	async function fetchRoastProfileData() {
		try {
			const response = await fetch('/api/roast-profiles');
			if (response.ok) {
				const data = await response.json();
				roastProfileData = data.data.filter(
					(profile: RoastProfileData) => profile.oz_in != null && profile.oz_out != null
				);
			}
		} catch (error) {
			console.error('Error fetching roast profile data:', error);
		}
	}

	async function fetchInitialSalesData() {
		try {
			const response = await fetch('/api/profit');
			if (response.ok) {
				const data = await response.json();
				salesData = data.sales || [];
				profitData = data.profit || [];
			}
		} catch (error) {
			console.error('Error fetching sales data:', error);
		}
	}

	// Add function to show sale form
	function showSaleForm(selectedBean?: any) {
		console.log('showSaleForm called with bean:', selectedBean);
		isFormVisible = true;
		selectedSale = null;
		// Store the selected bean data for the form
		if (selectedBean) {
			selectedSale = {
				...(selectedSale || {}),
				defaultBean: selectedBean
			} as any;
		}
	}


	// Lazy load ProfitCards component
	onMount(async () => {
		const module = await import('./ProfitCards.svelte');
		ProfitCards = module.default;
		profitCardsLoading = false;
	});

	// Ensure the data object always has the callback
	$effect(() => {
		if (data) {
			// Always ensure the callback is attached
			data.onAddNewSale = showSaleForm;
		}
	});
</script>

<!-- Add form modal -->
{#if isFormVisible}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-75 backdrop-blur-sm"
	>
		<div class="w-full max-w-2xl rounded-lg bg-background-secondary-light p-6 shadow-2xl">
			<SaleForm
				sale={selectedSale}
				onClose={() => {
					isFormVisible = false;
					selectedSale = null;
				}}
				onSubmit={handleFormSubmit}
			/>
		</div>
	</div>
{/if}

<div class="space-y-6">
	<!-- Header Section -->
	<div class="mb-6">
		<h1 class="text-primary-light mb-2 text-2xl font-bold">Coffee Sales & Profit</h1>
		<p class="text-text-secondary-light">Track your coffee sales performance and profitability</p>
	</div>

	<!-- KPI Cards Grid -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Primary Metrics -->
		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Total Revenue</h3>
			<p class="mt-1 text-2xl font-bold text-green-500">${totalRevenue.toFixed(2)}</p>
			<p class="mt-1 text-xs text-text-secondary-light">From all coffee sales</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Total Profit</h3>
			<p class="mt-1 text-2xl font-bold text-blue-500">${totalProfit.toFixed(2)}</p>
			<p class="mt-1 text-xs text-text-secondary-light">Net profit after costs</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Average Margin</h3>
			<p class="mt-1 text-2xl font-bold text-purple-500">{averageMargin().toFixed(1)}%</p>
			<p class="mt-1 text-xs text-text-secondary-light">Weighted by sales volume</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Sell-Through Rate</h3>
			<p class="mt-1 text-2xl font-bold text-orange-500">{sellThroughRate().toFixed(1)}%</p>
			<p class="mt-1 text-xs text-text-secondary-light">Inventory sold vs purchased</p>
		</div>
	</div>

	<!-- Secondary Metrics -->
	<div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Total Investment</h3>
			<p class="mt-1 text-2xl font-bold text-red-500">${totalCost.toFixed(2)}</p>
			<p class="mt-1 text-xs text-text-secondary-light">Bean cost + shipping & tax</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Coffee Purchased</h3>
			<p class="mt-1 text-2xl font-bold text-indigo-500">{totalPoundsRoasted.toFixed(1)} lbs</p>
			<p class="mt-1 text-xs text-text-secondary-light">Total green coffee inventory</p>
		</div>

		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h3 class="text-sm font-medium text-text-primary-light">Roast Loss Rate</h3>
			<p class="mt-1 text-2xl font-bold text-cyan-500">{roastLossRate().toFixed(1)}%</p>
			<p class="mt-1 text-xs text-text-secondary-light">Weight loss during roasting</p>
		</div>
	</div>

	<!-- Enhanced Performance Chart -->
	<div class="mb-8 rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
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

	<!-- Coffee Sales Analysis -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold text-text-primary-light">Coffee Sales Analysis</h2>
				<p class="text-sm text-text-secondary-light">
					Detailed breakdown by purchase date and coffee
				</p>
			</div>
			<button
				type="button"
				class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
				onclick={showSaleForm}
			>
				Add New Sale
			</button>
		</div>

		{#if profitCardsLoading}
			<div
				class="flex items-center justify-center rounded-lg bg-background-secondary-light p-8 ring-1 ring-border-light"
			>
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-background-tertiary-light border-t-transparent"
				></div>
				<span class="ml-3 text-sm text-text-secondary-light">Loading profit analysis...</span>
			</div>
		{:else if ProfitCards}
			<ProfitCards
				{profitData}
				{salesData}
				{expandedDates}
				{selectedCoffee}
				onToggleDate={toggleDate}
				onSelectCoffee={handleSelectCoffee}
				onEditSale={handleSaleEdit}
				onDeleteSale={handleSaleDelete}
				onAddSale={showSaleForm}
			/>
		{:else}
			<div
				class="rounded-lg bg-background-secondary-light p-8 text-center ring-1 ring-border-light"
			>
				<div class="mb-4 text-6xl opacity-50">📊</div>
				<h3 class="mb-2 text-lg font-semibold text-text-primary-light">No Sales Data Yet</h3>
				<p class="mb-4 text-text-secondary-light">
					Start tracking your coffee sales to see detailed profit analysis.
				</p>
				<button
					type="button"
					class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
					onclick={showSaleForm}
				>
					Record Your First Sale
				</button>
			</div>
		{/if}
	</div>
</div>
