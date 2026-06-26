<script lang="ts">
	import {
		formatPriceTiers,
		formatDisplayDate,
		formatSourceName,
		formatLocation,
		formatCostPerLb,
		formatScore
	} from '$lib/utils/formatters';
	import type { InventoryWithCatalog, RoastProfile } from '$lib/types/component.types';

	let {
		selectedBean,
		isEditing,
		editedBean = $bindable(),
		canManagePortfolio,
		onToggleEdit,
		onDelete
	} = $props<{
		selectedBean: InventoryWithCatalog;
		isEditing: boolean;
		editedBean: InventoryWithCatalog;
		canManagePortfolio: boolean;
		onToggleEdit: () => void;
		onDelete: () => void;
	}>();
</script>

<div class="space-y-6">
	<!-- User Inventory Data Section -->
	<div>
		<h3 class="mb-4 font-semibold text-text-primary-light">Your Inventory</h3>

		<!-- Notes field without border -->
		{#if selectedBean.notes !== undefined && selectedBean.notes !== null && selectedBean.notes !== ''}
			<div class="mb-4">
				{#if isEditing}
					<textarea
						class="w-full rounded border border-border-light bg-background-primary-light px-2 py-1 text-text-primary-light"
						rows="4"
						bind:value={editedBean.notes}
					></textarea>
				{:else}
					<div class="whitespace-pre-wrap text-text-primary-light">
						{selectedBean.notes}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Inventory details in single row -->
		<div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each ['purchase_date', 'purchased_qty_lbs', 'bean_cost', 'tax_ship_cost'] as key}
				{#if selectedBean[key] !== undefined && selectedBean[key] !== null && selectedBean[key] !== ''}
					<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
						<h4 class="text-sm font-medium text-text-primary-light">
							{key.replace(/_/g, ' ').toUpperCase()}
						</h4>
						{#if isEditing}
							{#if key === 'bean_cost' || key === 'tax_ship_cost'}
								<input
									type="number"
									step="0.01"
									min="0"
									class="mt-2 w-full rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
									bind:value={editedBean[key]}
								/>
							{:else if key === 'purchased_qty_lbs'}
								<input
									type="number"
									step="0.1"
									min="0"
									class="mt-2 w-full rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
									bind:value={editedBean[key]}
								/>
							{:else if key === 'purchase_date'}
								<input
									type="date"
									class="mt-2 w-full rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
									bind:value={editedBean[key]}
								/>
							{/if}
						{:else}
							<div class="mt-2 text-text-primary-light">
								{#if key === 'bean_cost' || key === 'tax_ship_cost'}
									${typeof selectedBean[key] === 'number'
										? selectedBean[key].toFixed(2)
										: selectedBean[key]}
								{:else}
									{selectedBean[key]}
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>

		<!-- Stocked Inventory Calculation -->
		{#if selectedBean.purchased_qty_lbs !== undefined}
			{@const purchasedOz = (selectedBean.purchased_qty_lbs || 0) * 16}
			{@const roastedOz =
				selectedBean.roast_profiles?.reduce(
					(ozSum: number, profile: RoastProfile) => ozSum + (profile.oz_in || 0),
					0
				) || 0}
			{@const remainingLbs = (purchasedOz - roastedOz) / 16}
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<div class="flex items-center justify-between">
					<h4 class="text-sm font-medium text-text-primary-light">
						{selectedBean.stocked ? 'STOCKED' : 'UNSTOCKED'} INVENTORY
					</h4>
					{#if isEditing}
						<!-- Checkbox -->
						<label class="flex items-center gap-2">
							<input
								type="checkbox"
								bind:checked={editedBean.stocked}
								class="h-4 w-4 rounded border-border-light text-green-500 focus:ring-green-500 focus:ring-offset-0"
							/>
							<span class="text-sm font-medium text-text-secondary-light">In Stock</span>
						</label>
					{:else}
						<!-- Status Indicator -->
						<div class="flex items-center gap-2">
							<div
								class="h-3 w-3 rounded-full {selectedBean.stocked
									? 'bg-green-500'
									: 'bg-red-500'}"
							></div>
							<span class="text-xs font-medium text-text-secondary-light">
								{selectedBean.stocked ? 'In Stock' : 'Out of Stock'}
							</span>
						</div>
					{/if}
				</div>
				<div class="mt-2 flex items-center gap-3">
					<span
						class="text-2xl font-bold {selectedBean.stocked === false
							? 'text-red-500'
							: remainingLbs > 0
								? 'text-green-500'
								: 'text-red-500'}"
					>
						{remainingLbs.toFixed(1)} lbs
					</span>
					<span class="text-sm text-text-secondary-light">
						({purchasedOz.toFixed(0)} oz purchased - {roastedOz.toFixed(0)} oz roasted)
					</span>
				</div>
				{#if isEditing}
					<div class="mt-2 text-xs text-text-secondary-light">
						Toggle to manually override stock status (auto-updates when inventory &lt; 4 oz)
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Catalog Bean Information -->
	{#if selectedBean.coffee_catalog}
		{@const cat = selectedBean.coffee_catalog}
		{@const locationStr = formatLocation(cat.continent, cat.country, cat.region)}
		{@const hasOriginData = !!(
			locationStr ||
			cat.cultivar_detail ||
			cat.processing ||
			cat.drying_method ||
			cat.grade ||
			cat.appearance ||
			cat.arrival_date
		)}
		{@const hasPricingData = !!(
			(cat.price_per_lb ?? cat.cost_lb) != null ||
			(cat.price_tiers && Array.isArray(cat.price_tiers) && cat.price_tiers.length > 0) ||
			cat.wholesale ||
			cat.lot_size ||
			cat.bag_size ||
			cat.packaging
		)}
		{@const hasDescriptionData = !!(
			cat.description_short ||
			cat.description_long ||
			cat.farm_notes ||
			cat.roast_recs
		)}
		{@const hasSupplierData = !!(cat.source || cat.type || cat.link)}

		<!-- Header with source name and product link -->
		<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="font-semibold text-text-primary-light">
					{cat.source
						? formatSourceName(cat.source) + ' Bean Information'
						: 'Bean Information'}
				</h3>
				<div class="flex items-center gap-2">
					{#if cat.wholesale}
						<span
							class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700"
							>Wholesale</span
						>
					{/if}
					{#if cat.score_value != null}
						<span class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
							>Score: {formatScore(cat.score_value)}</span
						>
					{/if}
					{#if cat.link}
						<a
							href={cat.link}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center rounded-md bg-background-tertiary-light px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							View Product Page
							<svg
								class="ml-1.5 h-3.5 w-3.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
								/>
							</svg>
						</a>
					{/if}
				</div>
			</div>

			<!-- AI Description -->
			{#if cat.ai_description}
				<div class="mb-4">
					<div class="whitespace-pre-wrap text-text-primary-light">
						{cat.ai_description}
					</div>
				</div>
			{/if}

			<!-- Origin & Source -->
			{#if hasOriginData}
				<div class="mb-4">
					<h4
						class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary-light"
					>
						Origin & Source
					</h4>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#if locationStr}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">LOCATION</h5>
								<div class="mt-1 text-sm text-text-primary-light">{locationStr}</div>
							</div>
						{/if}
						{#if cat.cultivar_detail}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">CULTIVAR</h5>
								<div class="mt-1 text-sm text-text-primary-light">{cat.cultivar_detail}</div>
							</div>
						{/if}
						{#if cat.processing}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">PROCESSING</h5>
								<div class="mt-1 text-sm text-text-primary-light">{cat.processing}</div>
							</div>
						{/if}
						{#if cat.drying_method}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">DRYING METHOD</h5>
								<div class="mt-1 text-sm text-text-primary-light">{cat.drying_method}</div>
							</div>
						{/if}
						{#if cat.grade}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">
									GRADE / ELEVATION
								</h5>
								<div class="mt-1 text-sm text-text-primary-light">{cat.grade}</div>
							</div>
						{/if}
						{#if cat.appearance}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">APPEARANCE</h5>
								<div class="mt-1 text-sm text-text-primary-light">{cat.appearance}</div>
							</div>
						{/if}
						{#if cat.arrival_date}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">ARRIVAL DATE</h5>
								<div class="mt-1 text-sm text-text-primary-light">
									{formatDisplayDate(cat.arrival_date)}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Pricing & Availability -->
			{#if hasPricingData}
				<div class="mb-4">
					<h4
						class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary-light"
					>
						Pricing & Availability
					</h4>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#if (cat.price_per_lb ?? cat.cost_lb) != null}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">COST PER LB</h5>
								<div class="mt-1 text-sm font-medium text-text-primary-light">
									{formatCostPerLb((cat.price_per_lb ?? cat.cost_lb) as number)}
								</div>
							</div>
						{/if}
						{#if cat.price_tiers && Array.isArray(cat.price_tiers) && cat.price_tiers.length > 0}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light sm:col-span-2"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">PRICE TIERS</h5>
								<div class="mt-1 text-sm text-text-primary-light">
									{formatPriceTiers(cat.price_tiers)}
								</div>
							</div>
						{/if}
						{#if cat.lot_size}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">LOT SIZE</h5>
								<div class="mt-1 text-sm text-text-primary-light">{cat.lot_size}</div>
							</div>
						{/if}
						{#if cat.bag_size}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">BAG SIZE</h5>
								<div class="mt-1 text-sm text-text-primary-light">{cat.bag_size}</div>
							</div>
						{/if}
						{#if cat.packaging}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">PACKAGING</h5>
								<div class="mt-1 text-sm text-text-primary-light">{cat.packaging}</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Descriptions & Notes -->
			{#if hasDescriptionData}
				<div class="mb-4">
					<h4
						class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary-light"
					>
						Descriptions & Notes
					</h4>
					<div class="space-y-3">
						{#if cat.description_short}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">
									SHORT DESCRIPTION
								</h5>
								<div class="mt-1 whitespace-pre-wrap text-sm text-text-primary-light">
									{cat.description_short}
								</div>
							</div>
						{/if}
						{#if cat.description_long}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">
									FULL DESCRIPTION
								</h5>
								<div class="mt-1 whitespace-pre-wrap text-sm text-text-primary-light">
									{cat.description_long}
								</div>
							</div>
						{/if}
						{#if cat.farm_notes}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">FARM NOTES</h5>
								<div class="mt-1 whitespace-pre-wrap text-sm text-text-primary-light">
									{cat.farm_notes}
								</div>
							</div>
						{/if}
						{#if cat.roast_recs}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">
									ROAST RECOMMENDATIONS
								</h5>
								<div class="mt-1 whitespace-pre-wrap text-sm text-text-primary-light">
									{cat.roast_recs}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Supplier Info -->
			{#if hasSupplierData}
				<div>
					<h4
						class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-secondary-light"
					>
						Supplier
					</h4>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#if cat.source}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">SOURCE</h5>
								<div class="mt-1 text-sm text-text-primary-light">
									{formatSourceName(cat.source)}
								</div>
							</div>
						{/if}
						{#if cat.type}
							<div
								class="rounded-lg bg-background-secondary-light p-3 ring-1 ring-border-light"
							>
								<h5 class="text-xs font-medium text-text-secondary-light">IMPORTER / TYPE</h5>
								<div class="mt-1 text-sm text-text-primary-light">{cat.type}</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Action Buttons for Overview Tab -->
	{#if canManagePortfolio}
		<div class="mt-6 flex flex-wrap justify-end gap-2 border-t border-border-light pt-4">
			<button
				class="rounded-md {isEditing
					? 'bg-green-600 text-white hover:bg-green-700'
					: 'border border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light hover:text-white'} min-w-[80px] px-3 py-1 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
				onclick={onToggleEdit}
			>
				{isEditing ? 'Save' : 'Edit'}
			</button>
			<button
				class="min-w-[80px] rounded-md border border-red-600 px-3 py-1 font-medium text-red-600 transition-all duration-200 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
				onclick={onDelete}
			>
				Delete
			</button>
		</div>
	{/if}
</div>
