<script lang="ts">
	import type { InventoryWithCatalog, RoastProfile } from '$lib/types/component.types';

	let {
		selectedBean
	} = $props<{
		selectedBean: InventoryWithCatalog;
	}>();
</script>

<div class="space-y-6">
	<h3 class="text-lg font-semibold text-text-primary-light">Coffee Analytics</h3>

	<!-- Cost Analysis -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h4 class="text-sm font-medium text-text-primary-light">Cost per Pound</h4>
			<p class="text-2xl font-bold text-green-500">
				${selectedBean.purchased_qty_lbs
					? (
							((selectedBean.bean_cost || 0) + (selectedBean.tax_ship_cost || 0)) /
							selectedBean.purchased_qty_lbs
						).toFixed(2)
					: '0.00'}
			</p>
		</div>
		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h4 class="text-sm font-medium text-text-primary-light">Total Investment</h4>
			<p class="text-2xl font-bold text-blue-500">
				${((selectedBean.bean_cost || 0) + (selectedBean.tax_ship_cost || 0)).toFixed(2)}
			</p>
		</div>
		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h4 class="text-sm font-medium text-text-primary-light">Remaining Value</h4>
			{#if selectedBean.purchased_qty_lbs}
				{@const remainingLbs =
					((selectedBean.purchased_qty_lbs || 0) * 16 -
						(selectedBean.roast_profiles?.reduce(
							(sum: number, p: RoastProfile) => sum + (p.oz_in || 0),
							0
						) || 0)) /
					16}
				{@const costPerLb = selectedBean.purchased_qty_lbs
					? ((selectedBean.bean_cost || 0) + (selectedBean.tax_ship_cost || 0)) /
						selectedBean.purchased_qty_lbs
					: 0}
				<p class="text-2xl font-bold text-purple-500">
					${(remainingLbs * costPerLb).toFixed(2)}
				</p>
			{:else}
				<p class="text-2xl font-bold text-purple-500">$0.00</p>
			{/if}
		</div>
		<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
			<h4 class="text-sm font-medium text-text-primary-light">Utilization</h4>
			{#if selectedBean.purchased_qty_lbs}
				{@const totalPurchased = (selectedBean.purchased_qty_lbs || 0) * 16}
				{@const totalRoasted =
					selectedBean.roast_profiles?.reduce(
						(sum: number, p: RoastProfile) => sum + (p.oz_in || 0),
						0
					) || 0}
				<p class="text-2xl font-bold text-orange-500">
					{totalPurchased > 0 ? ((totalRoasted / totalPurchased) * 100).toFixed(1) : 0}%
				</p>
			{:else}
				<p class="text-2xl font-bold text-orange-500">0%</p>
			{/if}
		</div>
	</div>

	<!-- Purchase vs Current Market -->
	{#if selectedBean.coffee_catalog?.price_per_lb ?? selectedBean.coffee_catalog?.cost_lb}
		{@const paidPerLb = selectedBean.purchased_qty_lbs
			? ((selectedBean.bean_cost || 0) + (selectedBean.tax_ship_cost || 0)) /
				selectedBean.purchased_qty_lbs
			: 0}
		{@const marketPrice = (selectedBean.coffee_catalog?.price_per_lb ??
			selectedBean.coffee_catalog?.cost_lb) as number}
		{@const savings = marketPrice - paidPerLb}
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<h4 class="mb-3 font-medium text-text-primary-light">Market Comparison</h4>
			<div class="flex items-center justify-between">
				<span class="text-text-secondary-light">You paid: ${paidPerLb.toFixed(2)}/lb</span>
				<span class="text-text-secondary-light"
					>Market price: ${marketPrice.toFixed(2)}/lb</span
				>
			</div>
			<div class="mt-2 text-center">
				<span class="text-lg font-medium {savings > 0 ? 'text-green-500' : 'text-red-500'}">
					{savings > 0 ? 'Saved' : 'Premium'}: ${Math.abs(savings).toFixed(2)}/lb
				</span>
			</div>
		</div>
	{/if}

	<!-- Future placeholder for more analytics -->
	<div
		class="rounded-lg border-dashed bg-background-primary-light p-8 text-center ring-1 ring-border-light"
	>
		<div class="mb-4 text-4xl opacity-50">📊</div>
		<h4 class="mb-2 text-lg font-semibold text-text-primary-light">
			More Analytics Coming Soon
		</h4>
		<p class="text-text-secondary-light">
			Advanced analytics like roast performance trends, flavor profile evolution, and
			profitability analysis.
		</p>
	</div>
</div>
