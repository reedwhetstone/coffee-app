<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';

	interface ProfitData {
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

	let profitData: ProfitData[] = [];
	let selectedDateRange: 'all' | '30' | '90' | '180' | '365' = 'all';
	let chartContainer: HTMLDivElement;
	let expandedDates = new Set<string>();

	// Updated aggregate metrics
	$: totalRevenue = d3.sum(profitData, (d) => +d.total_sales || 0);
	$: totalCost = d3.sum(profitData, (d) => (+d.bean_cost || 0) + (+d.tax_ship_cost || 0));
	$: totalProfit = d3.sum(profitData, (d) => +d.profit || 0);
	$: averageMargin =
		(d3.sum(profitData, (d) => +d.profit || 0) / d3.sum(profitData, (d) => +d.total_sales || 0)) *
			100 || 0;
	$: totalPoundsRoasted = d3.sum(profitData, (d) => +d.purchased_qty_lbs || 0);

	// Add these reactive declarations after your existing ones
	$: sellThroughRate = (() => {
		const totalOzSold = d3.sum(profitData, (d) => +d.oz_sold || 0);
		const totalOzPurchased = d3.sum(profitData, (d) => (+d.purchased_qty_lbs || 0) * 16);
		return totalOzPurchased > 0 ? (totalOzSold / totalOzPurchased) * 100 : 0;
	})();
	$: avgCostPerPound = totalPoundsRoasted ? totalCost / totalPoundsRoasted : 0;
	$: avgRevenuePerPound = totalPoundsRoasted ? totalRevenue / totalPoundsRoasted : 0;
	$: avgProfitPerPound = totalPoundsRoasted ? totalProfit / totalPoundsRoasted : 0;

	$: roastLossRate = (() => {
		const totalOzIn = d3.sum(profitData, (d) => +d.oz_in || 0);
		const totalOzOut = d3.sum(profitData, (d) => +d.oz_out || 0);
		return totalOzIn > 0 ? 1 - totalOzOut / totalOzIn : 0;
	})();

	// Add this reactive declaration after your existing ones
	$: groupedProfitData = d3.group(profitData, (d) => d.purchase_date);

	function toggleDate(date: string) {
		if (expandedDates.has(date)) {
			expandedDates.delete(date);
		} else {
			expandedDates.add(date);
		}
		expandedDates = expandedDates; // trigger reactivity
	}

	onMount(async () => {
		await fetchProfitData();
	});

	async function fetchProfitData() {
		try {
			const response = await fetch('/api/profit');
			if (response.ok) {
				profitData = await response.json();
			}
		} catch (error) {
			console.error('Error fetching profit data:', error);
		}
	}
</script>

<div class="m-8">
	<h1 class="mb-4 text-2xl font-bold text-zinc-400">Profit Dashboard</h1>

	<!-- KPI Cards -->
	<div class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Total Revenue</h3>
			<p class="text-xl font-bold text-green-500">${totalRevenue.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Total Cost</h3>
			<p class="text-xl font-bold text-red-500">${totalCost.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Total Profit</h3>
			<p class="text-xl font-bold text-blue-500">${totalProfit.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Average Margin</h3>
			<p class="text-xl font-bold text-purple-500">{averageMargin.toFixed(1)}%</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Total Pounds Roasted</h3>
			<p class="text-xl font-bold text-orange-500">{totalPoundsRoasted.toFixed(1)} lbs</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Sell-Through Rate</h3>
			<p class="text-xl font-bold text-yellow-500">{sellThroughRate.toFixed(1)}%</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Profit/lb</h3>
			<p class="text-xl font-bold text-emerald-500">${avgProfitPerPound.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Cost/lb</h3>
			<p class="text-xl font-bold text-pink-500">${avgCostPerPound.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Revenue/lb</h3>
			<p class="text-xl font-bold text-indigo-500">${avgRevenuePerPound.toFixed(2)}</p>
		</div>
		<div class="rounded-lg bg-zinc-800 p-4">
			<h3 class="text-sm text-zinc-400">Avg. Roast Loss</h3>
			<p class="text-xl font-bold text-cyan-500">{roastLossRate.toFixed(2)}%</p>
		</div>
	</div>

	<!-- Detailed Table -->
	<div class="mt-8 overflow-x-auto">
		<table class="w-full table-auto bg-zinc-800">
			<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
				<tr>
					<th class="px-6 py-3">Purchase Date</th>
					<th class="px-6 py-3">Details</th>
				</tr>
			</thead>
			<tbody>
				{#each [...groupedProfitData] as [date, items]}
					<!-- Purchase Date Group Header -->
					<tr
						class="cursor-pointer bg-zinc-700 hover:bg-zinc-600"
						on:click={() => toggleDate(date)}
					>
						<td class="px-6 py-2 text-left text-xs font-semibold text-zinc-300">
							{expandedDates.has(date) ? '▼' : '▶'}
							{new Date(date).toLocaleDateString()}
						</td>
						<td class="px-6 py-2 text-left text-xs font-semibold text-zinc-300">
							<div class="flex gap-4">
								<span>{items.length} items</span>
								<span
									>Total Cost: ${items
										.reduce(
											(sum, item) => sum + Number(item.bean_cost) + Number(item.tax_ship_cost),
											0
										)
										.toFixed(2)}</span
								>
								<span
									>Total Sales: ${items
										.reduce((sum, item) => sum + Number(item.total_sales), 0)
										.toFixed(2)}</span
								>
								<span
									>Total Profit: ${items
										.reduce((sum, item) => sum + Number(item.profit), 0)
										.toFixed(2)}</span
								>
								<span
									>Avg Margin: {(
										items.reduce((sum, item) => sum + Number(item.profit_margin), 0) / items.length
									).toFixed(1)}%</span
								>
							</div>
						</td>
					</tr>
					<!-- Items for this purchase date -->
					{#if expandedDates.has(date)}
						{#each items as item}
							<tr class="border-b border-zinc-700 bg-zinc-800 transition-colors hover:bg-zinc-700">
								<td class="px-6 py-4 pl-12 text-xs text-zinc-300">
									{item.coffee_name}
								</td>
								<td class="px-6 py-4 text-xs text-zinc-300">
									<div class="flex gap-4">
										<span>Qty: {item.purchased_qty_lbs.toFixed(2)} lbs</span>
										<span
											>Cost: ${(Number(item.bean_cost) + Number(item.tax_ship_cost)).toFixed(
												2
											)}</span
										>
										<span>Sales: ${Number(item.total_sales).toFixed(2)}</span>
										<span>Profit: ${Number(item.profit).toFixed(2)}</span>
										<span>Margin: {Number(item.profit_margin).toFixed(1)}%</span>
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>
