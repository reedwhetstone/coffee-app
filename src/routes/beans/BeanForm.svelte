<script lang="ts">
	import { browser } from '$app/environment';
	import LoadingButton from '$lib/components/LoadingButton.svelte';
	import {
		calculatePurchaseTotal,
		formatPricePerLb,
		getApplicableTier,
		getMinOrderLbs,
		parsePriceTiers
	} from '$lib/utils/pricing';
	import type {
		InventoryWithCatalog,
		CoffeeCatalog,
		CoffeeFormData
	} from '$lib/types/component.types';
	import type { components } from '@purveyors/sdk';

	type ManualCoffeeCreate = components['schemas']['ManualCoffeeCreate'];
	type ManualInventoryBatchCreateRequest =
		components['schemas']['ManualInventoryBatchCreateRequest'];

	const MANUAL_COFFEE_FIELD_MAP = {
		region: 'region',
		processing: 'processing',
		drying_method: 'dryingMethod',
		roast_recs: 'roastRecommendations',
		lot_size: 'lotSize',
		bag_size: 'bagSize',
		packaging: 'packaging',
		cultivar_detail: 'cultivarDetail',
		grade: 'grade',
		appearance: 'appearance',
		description_short: 'shortDescription',
		farm_notes: 'farmNotes',
		type: 'type',
		description_long: 'longDescription',
		cost_lb: 'costPerLb',
		source: 'source',
		cupping_notes: 'supplierCuppingNotes',
		arrival_date: 'arrivalDate',
		score_value: 'scoreValue'
	} as const;
	const PENDING_MANUAL_BATCH_STORAGE_KEY = 'purveyors:pending-manual-inventory-batch';

	const {
		bean = null,
		onClose,
		onSubmit,
		catalogBeans = []
	} = $props<{
		bean: InventoryWithCatalog | null;
		onClose: () => void;
		onSubmit: (beans: CoffeeFormData[]) => void;
		catalogBeans?: CoffeeCatalog[];
	}>();

	let isManualEntry = $state(true);
	let sourceFilter = $state('');
	let isUpdating = $state(false);
	let isSubmitting = $state(false);
	let catalogLoading = $state(false); // Keep for form submission loading state

	// Optional catalog fields for manual entry
	let optionalFields = $state<{ [key: string]: string | number | null }>({
		region: '',
		processing: '',
		drying_method: '',
		roast_recs: '',
		lot_size: '',
		bag_size: '',
		packaging: '',
		cultivar_detail: '',
		grade: '',
		appearance: '',
		description_short: '',
		farm_notes: '',
		type: '',
		description_long: '',
		cost_lb: null as number | null,
		source: '',
		cupping_notes: '',
		arrival_date: '',
		score_value: null as number | null
	});

	let selectedOptionalFields = $state<string[]>([]);
	let pendingManualBatchId = $state<string | null>(
		browser ? sessionStorage.getItem(PENDING_MANUAL_BATCH_STORAGE_KEY) : null
	);

	function setPendingManualBatchId(batchId: string | null) {
		pendingManualBatchId = batchId;
		if (!browser) return;
		if (batchId) {
			sessionStorage.setItem(PENDING_MANUAL_BATCH_STORAGE_KEY, batchId);
		} else {
			sessionStorage.removeItem(PENDING_MANUAL_BATCH_STORAGE_KEY);
		}
	}

	function isDefinitiveManualBatchFailure(response: Response, data: { code?: unknown }): boolean {
		if ([401, 403, 408, 425, 429].includes(response.status) || response.status >= 500) {
			return false;
		}
		if (response.status === 409) {
			return data.code === 'idempotency_conflict';
		}
		return true;
	}

	// Shared form data for batch-level fields
	let sharedFormData = $state({
		purchase_date: new Date().toISOString().split('T')[0], // Auto-populate with current date
		tax_ship_cost: 0.0,
		notes: ''
	});

	// Array to store multiple beans in the batch
	let batchBeans = $state(initBatchBeans());

	let taxShipPerBean = $derived(
		batchBeans.length > 0 ? sharedFormData.tax_ship_cost / batchBeans.length : 0
	);

	function initBatchBeans() {
		if (bean) {
			return [
				{
					...bean,
					manual_name: bean.manual_name || '',
					rank: bean.rank || null,
					purchased_qty_lbs: bean.purchased_qty_lbs || 0,
					bean_cost: bean.bean_cost || 0.0,
					catalog_id: bean.catalog_id || null
				}
			];
		}
		return [
			{
				manual_name: '',
				rank: null,
				purchased_qty_lbs: 0,
				bean_cost: 0.0,
				catalog_id: null
			}
		];
	}

	// Initialize shared data from existing bean if editing
	$effect(() => {
		if (bean) {
			sharedFormData.purchase_date = bean.purchase_date || '';
			sharedFormData.tax_ship_cost = bean.tax_ship_cost || 0.0;
			sharedFormData.notes = bean.notes || '';
		}
	});

	function addBeanToBatch() {
		batchBeans = [
			...batchBeans,
			{
				manual_name: '',
				rank: null,
				purchased_qty_lbs: 0,
				bean_cost: 0.0,
				catalog_id: null
			}
		];
	}

	function removeBeanFromBatch(index: number) {
		batchBeans = batchBeans.filter((_, i) => i !== index);
	}

	function resetFormData() {
		sharedFormData = {
			purchase_date: '',
			tax_ship_cost: 0.0,
			notes: ''
		};
		batchBeans = [
			{
				manual_name: '',
				rank: null,
				purchased_qty_lbs: 0,
				bean_cost: 0.0,
				catalog_id: null
			}
		];
	}

	// Filter catalog beans based on stocked status
	let filteredCatalogBeans = $derived(catalogBeans.filter((bean: CoffeeCatalog) => bean.stocked));

	// When selecting from catalog, auto-calculate bean_cost from price_tiers when available.
	// This keeps the form aligned with the tiered pricing model (bean_cost is total $ for this line item).
	$effect(() => {
		if (isManualEntry) return;

		let changed = false;
		const next = batchBeans.map((b) => {
			if (!b.catalog_id) return b;

			const catalogBean = filteredCatalogBeans.find((c: CoffeeCatalog) => c.id === b.catalog_id);
			if (!catalogBean) return b;

			const tiers = parsePriceTiers(catalogBean.price_tiers);
			if (!tiers) return b;

			const qty =
				typeof b.purchased_qty_lbs === 'number'
					? b.purchased_qty_lbs
					: parseFloat(String(b.purchased_qty_lbs || 0));
			const subtotal = calculatePurchaseTotal(tiers, qty);
			if (subtotal == null) {
				// Quantity below minimum tier; keep UI honest by clearing subtotal.
				if (b.bean_cost !== 0) {
					changed = true;
					return { ...b, bean_cost: 0 };
				}
				return b;
			}

			if (b.bean_cost !== subtotal) {
				changed = true;
				return { ...b, bean_cost: subtotal };
			}
			return b;
		});

		if (changed) {
			batchBeans = next;
		}
	});

	function populateFromCatalog(catalogBean: CoffeeCatalog, beanIndex: number = 0) {
		if (!catalogBean) return;

		const tiers = parsePriceTiers(catalogBean.price_tiers);
		const minOrder = tiers ? getMinOrderLbs(catalogBean) : 0;

		const existingQty =
			typeof batchBeans[beanIndex].purchased_qty_lbs === 'number'
				? batchBeans[beanIndex].purchased_qty_lbs
				: parseFloat(String(batchBeans[beanIndex].purchased_qty_lbs || 0));

		// If this coffee has tiers, default quantity to the minimum order so the form is valid immediately.
		const qty = existingQty > 0 ? existingQty : tiers ? minOrder : existingQty;

		const subtotalFromTiers = tiers ? calculatePurchaseTotal(tiers, qty) : null;
		const priceTiersArr = Array.isArray(catalogBean.price_tiers)
			? (catalogBean.price_tiers as Array<{ min_lbs: number; price: number }>)
			: null;
		const perLbFallback =
			typeof catalogBean.price_per_lb === 'number'
				? catalogBean.price_per_lb
				: typeof priceTiersArr?.[0]?.price === 'number'
					? priceTiersArr[0].price
					: typeof catalogBean.cost_lb === 'number'
						? catalogBean.cost_lb
						: null;
		const subtotalFallback =
			perLbFallback != null && qty > 0 ? Math.round(perLbFallback * qty * 100) / 100 : null;

		// Only set catalog_id and default cost from catalog for the specific bean
		batchBeans[beanIndex] = {
			...batchBeans[beanIndex], // Keep existing user fields
			catalog_id: catalogBean.id,
			purchased_qty_lbs: qty,
			bean_cost: subtotalFromTiers ?? subtotalFallback ?? batchBeans[beanIndex].bean_cost
		};
		batchBeans = [...batchBeans]; // Trigger reactivity

		console.log('Set catalog reference:', {
			catalogId: catalogBean.id,
			catalogBean,
			beanData: batchBeans[beanIndex]
		});
	}

	function manualCoffee(
		beanData: (typeof batchBeans)[number],
		beanIndex: number
	): ManualCoffeeCreate {
		const coffee: Record<string, string | number> = {
			name: String(beanData.manual_name).trim()
		};

		if (beanIndex === 0) {
			for (const fieldName of selectedOptionalFields) {
				const parchmentField =
					MANUAL_COFFEE_FIELD_MAP[fieldName as keyof typeof MANUAL_COFFEE_FIELD_MAP];
				const value = optionalFields[fieldName];
				if (
					parchmentField &&
					((typeof value === 'string' && value.trim() !== '') ||
						(typeof value === 'number' && Number.isFinite(value)))
				) {
					coffee[parchmentField] = value;
				}
			}
		}

		return coffee as ManualCoffeeCreate;
	}

	function manualBatchRequest(): ManualInventoryBatchCreateRequest {
		return {
			purchaseDate: sharedFormData.purchase_date,
			taxShipTotal: sharedFormData.tax_ship_cost,
			...(sharedFormData.notes ? { notes: sharedFormData.notes } : {}),
			items: batchBeans.map((beanData, beanIndex) => ({
				rowId: crypto.randomUUID(),
				manualCoffee: manualCoffee(beanData, beanIndex),
				qty: Number(beanData.purchased_qty_lbs),
				...(typeof beanData.bean_cost === 'number' ? { cost: beanData.bean_cost } : {})
			}))
		};
	}

	async function finishManualBatch(response: Response): Promise<boolean> {
		if (response.ok) {
			const createdBeans = (await response.json()) as CoffeeFormData[];
			setPendingManualBatchId(null);
			onSubmit(createdBeans);
			onClose();
			return true;
		}

		const data = (await response.json()) as { error?: unknown; code?: unknown };
		if (isDefinitiveManualBatchFailure(response, data)) {
			setPendingManualBatchId(null);
		}
		alert(`Failed to create beans: ${String(data.error ?? 'Unknown error')}`);
		return false;
	}

	async function submitManualBatch(): Promise<void> {
		if (pendingManualBatchId) {
			const response = await fetch(
				`/api/beans?manualBatchId=${encodeURIComponent(pendingManualBatchId)}`
			);
			await finishManualBatch(response);
			return;
		}

		const batchId = crypto.randomUUID();
		setPendingManualBatchId(batchId);
		const response = await fetch('/api/beans', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Idempotency-Key': batchId
			},
			body: JSON.stringify(manualBatchRequest())
		});
		await finishManualBatch(response);
	}

	async function handleSubmit() {
		if (isManualEntry && pendingManualBatchId) {
			try {
				isSubmitting = true;
				await submitManualBatch();
			} catch (error) {
				console.error('Error reconciling manual inventory batch:', error);
				alert('Failed to reconcile this batch. Please try again.');
			} finally {
				isSubmitting = false;
			}
			return;
		}

		if (!batchBeans || !batchBeans.length) {
			alert('Please add at least one bean to the batch');
			return;
		}

		if (!sharedFormData.purchase_date) {
			alert('Please select a purchase date');
			return;
		}

		try {
			isSubmitting = true;

			// Validate the whole batch before any mutation.
			for (let i = 0; i < batchBeans.length; i++) {
				const beanData = batchBeans[i];

				// Validate required fields based on mode
				if (!isManualEntry && !beanData.catalog_id) {
					alert(`Please select a coffee bean for item ${i + 1}`);
					return;
				}

				if (isManualEntry && !beanData.manual_name?.trim()) {
					alert(`Please enter a coffee name for bean ${i + 1}`);
					return;
				}

				// Purchased quantity must be > 0
				if (!beanData.purchased_qty_lbs || beanData.purchased_qty_lbs <= 0) {
					alert(`Please enter a purchased quantity > 0 for bean ${i + 1}`);
					return;
				}

				// If this is a tiered/wholesale coffee, ensure quantity meets minimum tier
				if (!isManualEntry && beanData.catalog_id) {
					const catalogBean = filteredCatalogBeans.find(
						(b: CoffeeCatalog) => b.id === beanData.catalog_id
					);
					const tiers = catalogBean ? parsePriceTiers(catalogBean.price_tiers) : null;
					if (tiers && tiers.length > 0) {
						const minOrder = tiers[0].min_lbs;
						if (beanData.purchased_qty_lbs < minOrder) {
							alert(
								`Minimum order for this coffee is ${minOrder} lb. Please increase quantity for bean ${i + 1}.`
							);
							return;
						}
					}
				}
			}

			if (isManualEntry) {
				await submitManualBatch();
				return;
			}

			const taxShipPerBean = sharedFormData.tax_ship_cost / batchBeans.length;
			const createdBeans = [];

			for (let i = 0; i < batchBeans.length; i++) {
				const beanData = batchBeans[i];
				// Prepare bean data for submission
				const cleanedBean: CoffeeFormData = {
					...Object.fromEntries(
						Object.entries(beanData).map(([key, value]) => [
							key,
							value === '' || value === undefined ? null : value
						])
					),
					// Add shared form data
					purchase_date: sharedFormData.purchase_date,
					tax_ship_cost: taxShipPerBean, // Divided cost
					notes: sharedFormData.notes,
					last_updated: new Date().toISOString()
				};

				const response = await fetch('/api/beans', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify(cleanedBean)
				});

				if (response.ok) {
					const newBean = await response.json();
					createdBeans.push(newBean);
				} else {
					const data = await response.json();
					alert(`Failed to create bean ${i + 1}: ${data.error}`);
					return;
				}
			}

			// Call onSubmit with all created beans
			onSubmit(createdBeans);
			onClose();
		} catch (error) {
			console.error('Error creating beans:', error);
			alert('Failed to create beans. Please try again.');
		} finally {
			isSubmitting = false;
		}
	}

	// Remove onMount - data is now passed via props

	// Handle source filter change manually
	function handleSourceChange() {
		if (!isUpdating) {
			try {
				isUpdating = true;
				// Only reset bean selections, keep purchase details
				batchBeans = [
					{
						manual_name: '',
						rank: null,
						purchased_qty_lbs: 0,
						bean_cost: 0.0,
						catalog_id: null
					}
				];
			} finally {
				isUpdating = false;
			}
		}
	}

	function handleBeanSelect(event: Event, beanIndex: number = 0) {
		const selectElement = event.target as HTMLSelectElement;
		const selectedValue = selectElement.value;

		if (!selectedValue) {
			// No bean selected
			return;
		}

		// Find the selected bean by ID
		const selectedBean = filteredCatalogBeans.find(
			(b: CoffeeCatalog) => b.id.toString() === selectedValue
		);

		if (selectedBean) {
			populateFromCatalog(selectedBean, beanIndex);
		}
	}
</script>

<!-- Clean card-based form design matching home page patterns -->
<div class="rounded-lg bg-surface-panel p-6 shadow-sm">
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-ink">
			{bean ? 'Edit Coffee Bean' : 'Add New Coffee Bean'}
		</h2>
		<p class="mt-2 text-muted">
			{bean ? 'Edit your coffee bean details' : 'Add coffee beans to your inventory'}
		</p>
	</div>

	{#if pendingManualBatchId}
		<div
			class="mb-6 rounded-md border border-warning bg-warning-subtle p-3 text-sm text-warning-strong"
			role="status"
		>
			A previous manual batch has an uncertain result. Editing is locked until it is reconciled.
			Select the button below to check its status before starting a new purchase.
		</div>
	{/if}

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
		class="space-y-6"
	>
		<!-- Entry Type Selection -->
		<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
			<h3 class="mb-4 text-lg font-semibold text-ink">Entry Type</h3>
			<div class="flex flex-wrap gap-4">
				<label class="inline-flex cursor-pointer items-center">
					<input
						type="radio"
						bind:group={isManualEntry}
						value={true}
						onchange={resetFormData}
						disabled={!!pendingManualBatchId}
						class="sr-only"
					/>
					<div
						class="flex items-center gap-2 rounded-md border px-4 py-2 transition-all duration-200"
						class:bg-accent={isManualEntry}
						class:text-white={isManualEntry}
						class:border-accent={isManualEntry}
						class:border-line={!isManualEntry}
						class:text-ink={!isManualEntry}
					>
						<span>Manual Entry</span>
					</div>
				</label>
				<label class="inline-flex cursor-pointer items-center">
					<input
						type="radio"
						bind:group={isManualEntry}
						value={false}
						disabled={!!pendingManualBatchId}
						class="sr-only"
					/>
					<div
						class="flex items-center gap-2 rounded-md border px-4 py-2 transition-all duration-200"
						class:bg-accent={!isManualEntry}
						class:text-white={!isManualEntry}
						class:border-accent={!isManualEntry}
						class:border-line={isManualEntry}
						class:text-ink={isManualEntry}
					>
						<span>Select from Catalog</span>
					</div>
				</label>
			</div>
		</div>

		<!-- Purchase Details -->
		<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
			<h3 class="mb-4 text-lg font-semibold text-ink">Purchase Details</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<label for="purchase_date" class="block text-sm font-medium text-ink">
						Purchase Date
					</label>
					<input
						id="purchase_date"
						type="date"
						bind:value={sharedFormData.purchase_date}
						disabled={!!pendingManualBatchId}
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="tax_ship_cost" class="block text-sm font-medium text-ink">
						Total Tax & Shipping ($)
					</label>
					<input
						id="tax_ship_cost"
						type="number"
						step="0.01"
						min="0"
						placeholder="0.00"
						bind:value={sharedFormData.tax_ship_cost}
						disabled={!!pendingManualBatchId}
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-accent"
						required
					/>
					<p class="text-xs text-muted">
						{#if isManualEntry}
							Parchment will allocate this total across the manual batch in exact cents
						{:else}
							This total will be divided evenly across catalog items
						{/if}
					</p>
				</div>
			</div>
		</div>

		{#if !isManualEntry}
			<!-- Catalog Selection Filter -->
			<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
				<h3 class="mb-4 text-lg font-semibold text-ink">Filter Options</h3>
				<div class="space-y-2">
					<label for="source" class="block text-sm font-medium text-ink"> Filter by Source </label>
					<select
						id="source"
						bind:value={sourceFilter}
						onchange={handleSourceChange}
						disabled={!!pendingManualBatchId}
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
					>
						<option value="">All Sources</option>
						{#each [...new Set(filteredCatalogBeans.map((b: CoffeeCatalog) => b.source))] as source}
							<option value={source}>{source}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}

		<!-- Beans in Purchase -->
		<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-lg font-semibold text-ink">Beans in Purchase</h3>
				<button
					type="button"
					class="flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
					onclick={addBeanToBatch}
					disabled={!!pendingManualBatchId}
				>
					<span class="text-lg">+</span>
					<span>Add Bean</span>
				</button>
			</div>

			<div class="space-y-4">
				{#each batchBeans as beanData, index}
					{@const selectedCatalogBean =
						!isManualEntry && beanData.catalog_id
							? filteredCatalogBeans.find((b: CoffeeCatalog) => b.id === beanData.catalog_id)
							: null}
					{@const tiers = selectedCatalogBean
						? parsePriceTiers(selectedCatalogBean.price_tiers)
						: null}
					{@const qty =
						typeof beanData.purchased_qty_lbs === 'number'
							? beanData.purchased_qty_lbs
							: parseFloat(String(beanData.purchased_qty_lbs || 0))}
					{@const applicableTier = tiers ? getApplicableTier(tiers, qty) : null}
					{@const subtotal = tiers ? calculatePurchaseTotal(tiers, qty) : null}
					{@const minOrder = tiers && tiers.length > 0 ? tiers[0].min_lbs : null}

					<div class="relative rounded-lg bg-surface-panel p-4 ring-1 ring-line">
						<!-- Remove bean button (except for first bean) -->
						{#if index > 0}
							<button
								type="button"
								class="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-xs text-white hover:bg-danger-strong"
								onclick={() => removeBeanFromBatch(index)}
								disabled={!!pendingManualBatchId}
							>
								✕
							</button>
						{/if}

						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<!-- Bean selection or manual entry -->
							{#if isManualEntry}
								<div class="space-y-2 sm:col-span-2">
									<label for="manual-name-{index}" class="block text-sm font-medium text-ink">
										Coffee Name
									</label>
									<input
										id="manual-name-{index}"
										type="text"
										bind:value={beanData.manual_name}
										placeholder="Enter coffee name"
										disabled={!!pendingManualBatchId}
										class="block w-full rounded-md border-0 bg-surface-canvas px-3 py-2 text-ink shadow-sm ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-accent"
										required
									/>
								</div>
							{:else}
								<div class="space-y-2 sm:col-span-2">
									<label for="catalog-bean-{index}" class="block text-sm font-medium text-ink">
										Select Coffee Bean
									</label>
									<select
										id="catalog-bean-{index}"
										class="block w-full rounded-md border-0 bg-surface-canvas px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
										required
										disabled={!!pendingManualBatchId}
										value={beanData.catalog_id || ''}
										onchange={(e) => handleBeanSelect(e, index)}
									>
										<option value="">Select a coffee bean...</option>
										{#each filteredCatalogBeans.filter((b: CoffeeCatalog) => !sourceFilter || b.source === sourceFilter) as catalogBean}
											<option value={catalogBean.id}>{catalogBean.name}</option>
										{/each}
									</select>
								</div>
							{/if}

							{#if !isManualEntry && tiers}
								<div class="space-y-2 sm:col-span-2">
									<div class="rounded-md border border-line bg-surface-canvas p-3">
										<div class="mb-2 flex items-center justify-between">
											<div class="text-xs font-semibold text-ink">Volume pricing</div>
											{#if selectedCatalogBean?.wholesale}
												<span
													class="rounded-full bg-info-subtle px-2 py-0.5 text-[10px] font-semibold text-info-strong"
													>Wholesale</span
												>
											{/if}
										</div>

										{#each tiers as tier (tier.min_lbs)}
											<div class="flex justify-between py-0.5 text-xs text-muted">
												<span>{tier.min_lbs}+ lb</span>
												<span class="font-medium text-ink">{formatPricePerLb(tier.price)}</span>
											</div>
										{/each}

										{#if qty > 0}
											{#if applicableTier && subtotal != null}
												<div class="mt-2 text-xs text-muted">
													Applied tier: {applicableTier.min_lbs}+ lb ({formatPricePerLb(
														applicableTier.price
													)})
												</div>
												<div class="text-xs text-muted">
													Subtotal: ${subtotal.toFixed(2)}
												</div>
												<div class="text-xs text-muted">
													Tax/ship allocation: ${taxShipPerBean.toFixed(2)}
												</div>
												<div class="text-xs font-semibold text-ink">
													Estimated total: ${(subtotal + taxShipPerBean).toFixed(2)}
												</div>
											{:else if minOrder}
												<div class="mt-2 text-xs text-danger">
													Minimum order is {minOrder} lb
												</div>
											{/if}
										{/if}
									</div>
								</div>
							{/if}

							<div class="space-y-2">
								<label for="purchased_qty-{index}" class="block text-sm font-medium text-ink">
									Purchased Quantity (lbs)
								</label>
								<input
									id="purchased_qty-{index}"
									type="number"
									step="0.1"
									min="0"
									bind:value={beanData.purchased_qty_lbs}
									placeholder="0"
									disabled={!!pendingManualBatchId}
									class="block w-full rounded-md border-0 bg-surface-canvas px-3 py-2 text-ink shadow-sm ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-accent"
									required
								/>
							</div>

							<div class="space-y-2">
								<label for="bean_cost-{index}" class="block text-sm font-medium text-ink">
									{#if !isManualEntry && tiers}
										Bean Subtotal ($)
									{:else}
										Bean Cost ($)
									{/if}
								</label>
								<input
									id="bean_cost-{index}"
									type="number"
									step="0.01"
									min="0"
									placeholder="0.00"
									bind:value={beanData.bean_cost}
									disabled={!!pendingManualBatchId || (!isManualEntry && !!tiers)}
									class="block w-full rounded-md border-0 bg-surface-canvas px-3 py-2 text-ink shadow-sm ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-accent"
									required
								/>
								{#if !isManualEntry && tiers}
									<p class="text-xs text-muted">
										Auto-calculated from volume pricing tiers. Adjust quantity to update.
									</p>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Additional Information -->
		<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
			<h3 class="mb-4 text-lg font-semibold text-ink">Additional Information</h3>
			<div class="space-y-4">
				{#if isManualEntry}
					<!-- Optional Field Selection for Manual Entry -->
					<div class="space-y-2">
						<label for="field-selector" class="block text-sm font-medium text-ink">
							Add Optional Fields
						</label>
						<select
							id="field-selector"
							class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
							disabled={!!pendingManualBatchId}
							onchange={(e) => {
								const target = e.target as HTMLSelectElement;
								const field = target.value;
								if (field && !selectedOptionalFields.includes(field)) {
									selectedOptionalFields = [...selectedOptionalFields, field];
									target.value = '';
								}
							}}
						>
							<option value="">Select field to add...</option>
							<option value="region">Region</option>
							<option value="processing">Processing Method</option>
							<option value="drying_method">Drying Method</option>
							<option value="roast_recs">Roast Recommendations</option>
							<option value="lot_size">Lot Size</option>
							<option value="bag_size">Bag Size</option>
							<option value="packaging">Packaging</option>
							<option value="cultivar_detail">Cultivar Detail</option>
							<option value="grade">Grade</option>
							<option value="appearance">Appearance</option>
							<option value="description_short">Short Description</option>
							<option value="farm_notes">Farm Notes</option>
							<option value="type">Type</option>
							<option value="description_long">Long Description</option>
							<option value="cost_lb">Cost per Lb</option>
							<option value="source">Source</option>
							<option value="cupping_notes">Cupping Notes</option>
							<option value="arrival_date">Arrival Date</option>
							<option value="score_value">Score Value</option>
						</select>
					</div>

					<!-- Dynamic Optional Fields -->
					{#each selectedOptionalFields as fieldName}
						<div class="flex gap-2">
							<div class="flex-1 space-y-2">
								<label for={`field-${fieldName}`} class="block text-sm font-medium text-ink">
									{fieldName.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
								</label>
								{#if fieldName === 'description_long' || fieldName === 'farm_notes' || fieldName === 'cupping_notes'}
									<textarea
										id={`field-${fieldName}`}
										bind:value={optionalFields[fieldName]}
										rows="3"
										disabled={!!pendingManualBatchId}
										class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
									></textarea>
								{:else if fieldName === 'cost_lb' || fieldName === 'score_value'}
									<input
										id={`field-${fieldName}`}
										type="number"
										step="0.01"
										bind:value={optionalFields[fieldName]}
										disabled={!!pendingManualBatchId}
										class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
									/>
								{:else if fieldName === 'arrival_date'}
									<input
										id={`field-${fieldName}`}
										type="date"
										bind:value={optionalFields[fieldName]}
										disabled={!!pendingManualBatchId}
										class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
									/>
								{:else}
									<input
										id={`field-${fieldName}`}
										type="text"
										bind:value={optionalFields[fieldName]}
										disabled={!!pendingManualBatchId}
										class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
									/>
								{/if}
							</div>
							<button
								type="button"
								class="mt-6 rounded-md bg-danger px-2 py-1 text-xs text-white hover:bg-danger-strong"
								disabled={!!pendingManualBatchId}
								onclick={() => {
									selectedOptionalFields = selectedOptionalFields.filter(
										(f: string) => f !== fieldName
									);
									optionalFields[fieldName] = '';
								}}
							>
								Remove
							</button>
						</div>
					{/each}
				{/if}

				<div class="space-y-2">
					<label for="notes" class="block text-sm font-medium text-ink">
						Purchase Notes (Optional)
					</label>
					<textarea
						id="notes"
						bind:value={sharedFormData.notes}
						disabled={!!pendingManualBatchId}
						rows="3"
						placeholder="Add any notes about this purchase..."
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line placeholder:text-muted focus:ring-2 focus:ring-accent"
					></textarea>
				</div>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
			<button
				type="button"
				class="rounded-md border border-accent px-4 py-2 text-accent transition-all duration-200 hover:bg-accent hover:text-ink"
				onclick={onClose}
			>
				Cancel
			</button>
			<LoadingButton
				variant="primary"
				loading={isSubmitting}
				loadingText={pendingManualBatchId
					? 'Reconciling Batch...'
					: batchBeans.length === 1
						? 'Saving Bean...'
						: `Saving ${batchBeans.length} Beans...`}
				onclick={handleSubmit}
				disabled={catalogLoading}
			>
				{pendingManualBatchId
					? 'Reconcile Pending Batch'
					: bean
						? 'Update Bean'
						: batchBeans.length === 1
							? 'Add Bean'
							: `Add ${batchBeans.length} Beans`}
			</LoadingButton>
		</div>
	</form>
</div>
