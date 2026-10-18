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
	import { getDecafPresentation } from '$lib/catalog/decafPresentation';
	import DecafBadge from '$lib/components/catalog/DecafBadge.svelte';

	let {
		selectedBean,
		isEditing,
		editedBean = $bindable(),
		canManagePortfolio,
		saving = false,
		onToggleEdit,
		onCancelEdit = () => undefined,
		onDelete
	} = $props<{
		selectedBean: InventoryWithCatalog;
		isEditing: boolean;
		editedBean: InventoryWithCatalog;
		canManagePortfolio: boolean;
		saving?: boolean;
		/** Starts editing, or saves when already editing. */
		onToggleEdit: () => void;
		onCancelEdit?: () => void;
		onDelete: () => void;
	}>();

	const inputClass =
		'block w-full rounded-md border-0 bg-surface-canvas px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent';

	function finiteNumber(value: unknown): number | null {
		const number = typeof value === 'number' ? value : Number(value);
		return value !== null && value !== '' && Number.isFinite(number) ? number : null;
	}

	function formatMoney(amount: number | null): string {
		return amount != null ? `$${amount.toFixed(2)}` : 'Not set';
	}

	let purchasedLbs = $derived(finiteNumber(selectedBean.purchased_qty_lbs));
	let beanCost = $derived(finiteNumber(selectedBean.bean_cost));
	let taxShipCost = $derived(finiteNumber(selectedBean.tax_ship_cost));
	let totalPaid = $derived(
		beanCost != null || taxShipCost != null ? (beanCost ?? 0) + (taxShipCost ?? 0) : null
	);
	let deliveredCostPerLb = $derived(
		totalPaid != null && purchasedLbs ? totalPaid / purchasedLbs : null
	);
	let purchasedOz = $derived((purchasedLbs ?? 0) * 16);
	let roastedOz = $derived(
		selectedBean.roast_profiles?.reduce(
			(ozSum: number, profile: RoastProfile) => ozSum + (profile.oz_in || 0),
			0
		) || 0
	);
	let remainingLbs = $derived((purchasedOz - roastedOz) / 16);
</script>

<div class="space-y-6">
	<!-- The owner's purchase record: the only part of this tab they edit. -->
	<section
		class="rounded-lg border border-line bg-surface-panel p-4"
		aria-labelledby="purchase-heading-{selectedBean.id}"
	>
		<div class="flex flex-wrap items-center justify-between gap-3">
			<h3 id="purchase-heading-{selectedBean.id}" class="font-semibold text-ink">Your purchase</h3>
			{#if canManagePortfolio && !isEditing}
				<button
					type="button"
					class="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-accent px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					onclick={onToggleEdit}
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15.232 5.232l3.536 3.536M9 13l6.464-6.464a2.5 2.5 0 113.536 3.536L12.536 16.536 8 18l1.464-4.536z"
						/>
					</svg>
					Edit purchase
				</button>
			{/if}
		</div>

		{#if isEditing}
			<form
				class="mt-4 space-y-4"
				onsubmit={(event) => {
					event.preventDefault();
					onToggleEdit();
				}}
			>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-1">
						<label for="purchase-date-{selectedBean.id}" class="block text-sm font-medium text-ink">
							Purchase date
						</label>
						<input
							id="purchase-date-{selectedBean.id}"
							type="date"
							class={inputClass}
							bind:value={editedBean.purchase_date}
						/>
					</div>
					<div class="space-y-1">
						<label for="purchased-qty-{selectedBean.id}" class="block text-sm font-medium text-ink">
							Quantity purchased (lb)
						</label>
						<input
							id="purchased-qty-{selectedBean.id}"
							type="number"
							step="0.1"
							min="0"
							class={inputClass}
							bind:value={editedBean.purchased_qty_lbs}
						/>
					</div>
					<div class="space-y-1">
						<label for="bean-cost-{selectedBean.id}" class="block text-sm font-medium text-ink">
							Coffee cost ($)
						</label>
						<input
							id="bean-cost-{selectedBean.id}"
							type="number"
							step="0.01"
							min="0"
							class={inputClass}
							bind:value={editedBean.bean_cost}
						/>
					</div>
					<div class="space-y-1">
						<label for="tax-ship-{selectedBean.id}" class="block text-sm font-medium text-ink">
							Tax & shipping ($)
						</label>
						<input
							id="tax-ship-{selectedBean.id}"
							type="number"
							step="0.01"
							min="0"
							class={inputClass}
							bind:value={editedBean.tax_ship_cost}
						/>
					</div>
				</div>
				<div class="space-y-1">
					<label for="notes-{selectedBean.id}" class="block text-sm font-medium text-ink">
						Notes
					</label>
					<textarea
						id="notes-{selectedBean.id}"
						class={inputClass}
						rows="4"
						placeholder="Anything worth remembering about this coffee"
						bind:value={editedBean.notes}
					></textarea>
				</div>
				<div class="rounded-md bg-surface-canvas p-3 ring-1 ring-line">
					<label class="flex items-center gap-2 text-sm font-medium text-ink">
						<input
							type="checkbox"
							bind:checked={editedBean.stocked}
							class="h-4 w-4 rounded border-line text-success focus:ring-success focus:ring-offset-0"
						/>
						In stock
					</label>
					<p class="mt-1 text-xs text-muted">
						Turns off on its own when less than 4 oz is left. Change it here to override.
					</p>
				</div>
				<div class="flex flex-wrap justify-end gap-2">
					<button
						type="button"
						class="min-h-9 rounded-md border border-line px-4 py-1.5 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
						onclick={onCancelEdit}
						disabled={saving}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="min-h-9 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
						disabled={saving}
					>
						{saving ? 'Saving…' : 'Save changes'}
					</button>
				</div>
			</form>
		{:else}
			<dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
				<div>
					<dt class="text-xs font-semibold text-muted">Purchased</dt>
					<dd class="mt-0.5 text-ink">
						{selectedBean.purchase_date ? formatDisplayDate(selectedBean.purchase_date) : 'Not set'}
					</dd>
				</div>
				<div>
					<dt class="text-xs font-semibold text-muted">Quantity</dt>
					<dd class="mt-0.5 text-ink">
						{purchasedLbs != null ? `${purchasedLbs} lb` : 'Not set'}
					</dd>
				</div>
				<div>
					<dt class="text-xs font-semibold text-muted">Coffee cost</dt>
					<dd class="mt-0.5 text-ink">{formatMoney(beanCost)}</dd>
				</div>
				<div>
					<dt class="text-xs font-semibold text-muted">Tax & shipping</dt>
					<dd class="mt-0.5 text-ink">{formatMoney(taxShipCost)}</dd>
				</div>
				<div>
					<dt class="text-xs font-semibold text-muted">Total paid</dt>
					<dd class="mt-0.5 font-semibold text-ink">{formatMoney(totalPaid)}</dd>
				</div>
				<div>
					<dt class="text-xs font-semibold text-muted">Cost per lb, delivered</dt>
					<dd class="mt-0.5 text-ink">
						{deliveredCostPerLb != null ? formatCostPerLb(deliveredCostPerLb) : '—'}
					</dd>
				</div>
			</dl>
			{#if selectedBean.notes}
				<div class="mt-4 border-t border-line pt-3">
					<p class="text-xs font-semibold text-muted">Notes</p>
					<p class="mt-1 whitespace-pre-wrap text-sm text-ink">{selectedBean.notes}</p>
				</div>
			{/if}
		{/if}

		{#if selectedBean.purchased_qty_lbs !== undefined && !isEditing}
			<div class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3">
				<span
					class="text-2xl font-bold {selectedBean.stocked === false
						? 'text-danger'
						: remainingLbs > 0
							? 'text-success-strong'
							: 'text-danger'}"
				>
					{remainingLbs.toFixed(1)} lb left
				</span>
				<span class="text-sm text-muted">
					{purchasedOz.toFixed(0)} oz purchased, {roastedOz.toFixed(0)} oz roasted
				</span>
				<span class="ml-auto flex items-center gap-2 text-xs font-medium text-muted">
					<span
						class="h-2.5 w-2.5 rounded-full {selectedBean.stocked ? 'bg-success' : 'bg-danger'}"
						aria-hidden="true"
					></span>
					{selectedBean.stocked ? 'In stock' : 'Out of stock'}
				</span>
			</div>
		{/if}
	</section>

	<!-- Catalog Bean Information -->
	{#if selectedBean.coffee_catalog}
		{@const cat = selectedBean.coffee_catalog}
		{@const decafPresentation = getDecafPresentation(cat)}
		{@const locationStr = formatLocation(cat.continent, cat.country, cat.region)}
		{@const hasOriginData = !!(
			locationStr ||
			cat.cultivar_detail ||
			cat.processing ||
			decafPresentation.isDecaffeinated ||
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
		<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
			<div class="mb-4 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 class="font-semibold text-ink">
						{cat.source ? `${formatSourceName(cat.source)} listing` : 'Supplier listing'}
					</h3>
					<p class="mt-0.5 text-xs text-muted">Details from the supplier, updated automatically.</p>
				</div>
				<div class="flex items-center gap-2">
					{#if cat.wholesale}
						<span
							class="rounded-full bg-info-subtle px-2 py-0.5 text-[10px] font-semibold text-info-strong"
							>Wholesale</span
						>
					{/if}
					{#if cat.score_value != null}
						<span
							class="rounded bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning-strong"
							>Score: {formatScore(cat.score_value)}</span
						>
					{/if}
					{#if cat.link}
						<a
							href={cat.link}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
						>
							Supplier page
							<svg class="ml-1.5 h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
					<div class="whitespace-pre-wrap text-ink">
						{cat.ai_description}
					</div>
				</div>
			{/if}

			<!-- Origin & Source -->
			{#if hasOriginData}
				<div class="mb-4">
					<h4 class="mb-3 text-sm font-semibold text-ink">Origin & source</h4>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#if locationStr}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Location</h5>
								<div class="mt-1 text-sm text-ink">{locationStr}</div>
							</div>
						{/if}
						{#if cat.cultivar_detail}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Cultivar</h5>
								<div class="mt-1 text-sm text-ink">{cat.cultivar_detail}</div>
							</div>
						{/if}
						{#if cat.processing}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Processing</h5>
								<div class="mt-1 text-sm text-ink">{cat.processing}</div>
							</div>
						{/if}
						{#if decafPresentation.isDecaffeinated}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Decaffeination</h5>
								<div class="mt-1 text-sm text-ink">
									<DecafBadge presentation={decafPresentation} />
								</div>
							</div>
						{/if}
						{#if cat.drying_method}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Drying method</h5>
								<div class="mt-1 text-sm text-ink">{cat.drying_method}</div>
							</div>
						{/if}
						{#if cat.grade}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Grade / elevation</h5>
								<div class="mt-1 text-sm text-ink">{cat.grade}</div>
							</div>
						{/if}
						{#if cat.appearance}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Appearance</h5>
								<div class="mt-1 text-sm text-ink">{cat.appearance}</div>
							</div>
						{/if}
						{#if cat.arrival_date}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Arrival date</h5>
								<div class="mt-1 text-sm text-ink">
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
					<h4 class="mb-3 text-sm font-semibold text-ink">Pricing & availability</h4>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#if (cat.price_per_lb ?? cat.cost_lb) != null}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Cost per lb</h5>
								<div class="mt-1 text-sm font-medium text-ink">
									{formatCostPerLb((cat.price_per_lb ?? cat.cost_lb) as number)}
								</div>
							</div>
						{/if}
						{#if cat.price_tiers && Array.isArray(cat.price_tiers) && cat.price_tiers.length > 0}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line sm:col-span-2">
								<h5 class="text-xs font-semibold text-muted">Price tiers</h5>
								<div class="mt-1 text-sm text-ink">
									{formatPriceTiers(cat.price_tiers)}
								</div>
							</div>
						{/if}
						{#if cat.lot_size}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Lot size</h5>
								<div class="mt-1 text-sm text-ink">{cat.lot_size}</div>
							</div>
						{/if}
						{#if cat.bag_size}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Bag size</h5>
								<div class="mt-1 text-sm text-ink">{cat.bag_size}</div>
							</div>
						{/if}
						{#if cat.packaging}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Packaging</h5>
								<div class="mt-1 text-sm text-ink">{cat.packaging}</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Descriptions & Notes -->
			{#if hasDescriptionData}
				<div class="mb-4">
					<h4 class="mb-3 text-sm font-semibold text-ink">Descriptions & notes</h4>
					<div class="space-y-3">
						{#if cat.description_short}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Short description</h5>
								<div class="mt-1 whitespace-pre-wrap text-sm text-ink">
									{cat.description_short}
								</div>
							</div>
						{/if}
						{#if cat.description_long}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Full description</h5>
								<div class="mt-1 whitespace-pre-wrap text-sm text-ink">
									{cat.description_long}
								</div>
							</div>
						{/if}
						{#if cat.farm_notes}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Farm notes</h5>
								<div class="mt-1 whitespace-pre-wrap text-sm text-ink">
									{cat.farm_notes}
								</div>
							</div>
						{/if}
						{#if cat.roast_recs}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Roast recommendations</h5>
								<div class="mt-1 whitespace-pre-wrap text-sm text-ink">
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
					<h4 class="mb-3 text-sm font-semibold text-ink">Supplier</h4>
					<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#if cat.source}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Source</h5>
								<div class="mt-1 text-sm text-ink">
									{formatSourceName(cat.source)}
								</div>
							</div>
						{/if}
						{#if cat.type}
							<div class="rounded-lg bg-surface-panel p-3 ring-1 ring-line">
								<h5 class="text-xs font-semibold text-muted">Importer / type</h5>
								<div class="mt-1 text-sm text-ink">{cat.type}</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Deleting stays apart from the purchase edits above. -->
	{#if canManagePortfolio && !isEditing}
		<div class="mt-6 flex justify-end border-t border-line pt-4">
			<button
				type="button"
				class="min-w-[80px] rounded-md border border-danger px-3 py-1 font-medium text-danger transition-all duration-200 hover:bg-danger hover:text-white focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
				onclick={onDelete}
			>
				Delete coffee
			</button>
		</div>
	{/if}
</div>
