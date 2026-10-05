<script lang="ts">
	import { untrack } from 'svelte';
	import {
		batchCoffees,
		batchOptionLabels,
		groupRoastsByBatch,
		type BatchedRoast,
		type SalePrefill
	} from '$lib/roast/roast-batches';
	import type { AvailableCoffee } from '$lib/types/component.types';

	let {
		sale: saleProp,
		onClose,
		onSubmit,
		availableCoffees = [],
		availableRoasts = [],
		roastsLoaded = true,
		prefill: prefillProp = null
	} = $props<{
		sale?: Record<string, unknown>; // Using unknown instead of any
		onClose: () => void;
		onSubmit: (sale: unknown) => void;
		availableCoffees?: AvailableCoffee[];
		/** The member's roasts. The batch choices are worked out from them, by batch ID. */
		availableRoasts?: BatchedRoast[];
		/** False while `availableRoasts` is still being fetched, or could not be. */
		roastsLoaded?: boolean;
		/** What a "Log sale" link filled in: the coffee, the batch, and the roast. */
		prefill?: SalePrefill | null;
	}>();

	// Capture the initial sale value using untrack - this is intentional as we only need initial value for form
	const sale = untrack(() => saleProp ?? null);
	const prefill = untrack(() => prefillProp ?? null);

	// Extract defaultBean from sale if it exists
	const defaultBean = sale?.defaultBean || null;
	let isSubmitting = $state(false);
	let createAttempt: { payload: string; idempotencyKey: string } | null = null;

	// What an existing sale is recorded against. An older sale may carry a batch name and no
	// batch; it stays that way unless the member chooses a batch here.
	const isUpdate = sale?.id !== undefined && sale?.id !== null;
	const savedBatchId: string | null = isUpdate ? ((sale.batch_id as string | null) ?? null) : null;
	const savedRoastId: number | null = isUpdate ? ((sale.roast_id as number | null) ?? null) : null;
	const savedBatchName: string = isUpdate ? String(sale.batch_name ?? '').trim() : '';
	// The one roast this sale can name: the roast "Log sale" was chosen on, or the roast an
	// existing sale already names.
	const offeredRoastId: number | null = isUpdate ? savedRoastId : (prefill?.roastId ?? null);

	function isAmbiguousCreateFailure(status: number): boolean {
		return status === 408 || status === 425 || status === 429 || status >= 500;
	}

	let formData = $state(
		isUpdate
			? { ...sale, batch_id: savedBatchId ?? '', roast_id: savedRoastId }
			: {
					green_coffee_inv_id: prefill?.coffeeId ?? defaultBean?.id ?? '',
					oz_sold: 0,
					price: 0,
					buyer: '',
					batch_id: prefill?.batchId ?? '',
					roast_id: offeredRoastId,
					sell_date: new Date().toISOString().split('T')[0]
				}
	);

	const sameId = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);

	// Batches are told apart by ID. Their labels lead with the date, and add the coffee when
	// two batches share a name and a day.
	let batches = $derived(groupRoastsByBatch(availableRoasts).filter((batch) => batch.id !== null));
	let batchLabels = $derived(batchOptionLabels(batches));
	let selectedBatch = $derived(batches.find((batch) => batch.id === formData.batch_id) ?? null);
	let offeredRoast = $derived(
		offeredRoastId === null
			? null
			: (availableRoasts.find((roast: BatchedRoast) => roast.roast_id === offeredRoastId) ?? null)
	);

	// Only the batches the chosen coffee was roasted in.
	let filteredBatches = $derived(
		formData.green_coffee_inv_id
			? batches.filter((batch) =>
					batch.roasts.some((roast) => sameId(roast.coffee_id, formData.green_coffee_inv_id))
				)
			: batches
	);

	// The coffees to choose from: those in stock, narrowed to the chosen batch. A coffee that
	// was roasted in that batch, or was filled in by a link, is offered even when none of it is
	// left in stock, since what was roasted can still be sold.
	let coffeeOptions = $derived.by(() => {
		const options = new Map<string, string>();
		const roasted = selectedBatch ? batchCoffees(selectedBatch) : null;
		for (const coffee of availableCoffees as AvailableCoffee[]) {
			if (roasted && !roasted.some((entry) => sameId(entry.id, coffee.id))) continue;
			options.set(
				String(coffee.id),
				coffee.name || coffee.coffee_catalog?.name || 'Unknown Coffee'
			);
		}
		for (const coffee of roasted ?? []) {
			if (!options.has(String(coffee.id))) options.set(String(coffee.id), coffee.name);
		}
		const chosen = formData.green_coffee_inv_id;
		if (chosen && !options.has(String(chosen))) {
			const roast = availableRoasts.find((entry: BatchedRoast) => sameId(entry.coffee_id, chosen));
			const name = roast?.coffee_name?.trim() || (sale?.coffee_name as string | undefined);
			if (name) options.set(String(chosen), name);
		}
		return [...options].map(([id, name]) => ({ id, name }));
	});

	// A batch of one coffee names the coffee, so a link from that batch needs no coffee chosen.
	$effect(() => {
		if (formData.green_coffee_inv_id || !selectedBatch) return;
		const coffees = batchCoffees(selectedBatch);
		if (coffees.length === 1) formData.green_coffee_inv_id = coffees[0].id;
	});

	// The roast a link named decides the coffee and the batch when the link left them out. A
	// roast that is not of the chosen coffee in the chosen batch is not named on the sale.
	$effect(() => {
		// A link can outlive the batch or the roast it names. Once the member's roasts have
		// arrived, what the link named and they do not hold is dropped: the form has no way to
		// show it, so it must not be saved with the sale. An existing sale keeps what it names.
		if (!isUpdate && roastsLoaded) {
			if (formData.batch_id && !selectedBatch) formData.batch_id = '';
			if (formData.roast_id != null && !offeredRoast) formData.roast_id = null;
		}
		if (formData.roast_id == null || !offeredRoast) return;
		if (!formData.green_coffee_inv_id && offeredRoast.coffee_id != null) {
			formData.green_coffee_inv_id = offeredRoast.coffee_id;
		}
		if (!formData.batch_id && offeredRoast.batch_id) formData.batch_id = offeredRoast.batch_id;
		if (!roastFits()) formData.roast_id = null;
	});

	function roastFits(): boolean {
		return (
			offeredRoast !== null &&
			sameId(offeredRoast.coffee_id, formData.green_coffee_inv_id) &&
			offeredRoast.batch_id === formData.batch_id
		);
	}
	let canNameRoast = $derived(offeredRoast !== null && roastFits());

	/** The fields the sale is saved with. An update names a batch or roast only when it changed. */
	function salePayload(): Record<string, unknown> {
		const batchId = formData.batch_id || null;
		const roastId = formData.roast_id ?? null;
		const fields: Record<string, unknown> = {
			oz_sold: formData.oz_sold,
			price: formData.price,
			buyer: formData.buyer,
			sell_date: formData.sell_date
		};
		if (isUpdate) {
			if (batchId !== savedBatchId) fields.batch_id = batchId;
			if (roastId !== savedRoastId) fields.roast_id = roastId;
		} else {
			fields.green_coffee_inv_id = formData.green_coffee_inv_id;
			if (batchId) fields.batch_id = batchId;
			if (roastId !== null) fields.roast_id = roastId;
		}
		return Object.fromEntries(
			Object.entries(fields).map(([key, value]) => [
				key,
				value === '' || value === undefined ? null : value
			])
		);
	}

	async function handleSubmit() {
		if (isSubmitting) return;
		isSubmitting = true;

		try {
			const payload = JSON.stringify(salePayload());
			if (!isUpdate && createAttempt?.payload !== payload) {
				createAttempt = { payload, idempotencyKey: crypto.randomUUID() };
			}

			const response = await fetch(isUpdate ? `/api/profit?id=${sale.id}` : '/api/profit', {
				method: isUpdate ? 'PUT' : 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(!isUpdate && createAttempt ? { 'Idempotency-Key': createAttempt.idempotencyKey } : {})
				},
				body: payload
			});
			if (response.ok) {
				const newSale = await response.json();
				if (!isUpdate) createAttempt = null;
				try {
					await onSubmit(newSale);
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Unknown error occurred';
					alert(`Sale was saved, but refreshing profit data failed: ${message}`);
					onClose();
				}
			} else {
				if (!isUpdate && !isAmbiguousCreateFailure(response.status)) {
					createAttempt = null;
				}
				const data = await response.json();
				alert(`Failed to ${isUpdate ? 'update' : 'create'} sale: ${data.error}`);
			}
		} catch (error) {
			console.error(`Error ${isUpdate ? 'updating' : 'creating'} sale:`, error);
		} finally {
			isSubmitting = false;
		}
	}

	// Handle coffee selection
	function handleCoffeeChange(event: Event) {
		const selectedCoffeeId = (event.target as HTMLSelectElement).value;
		formData.green_coffee_inv_id = selectedCoffeeId === '' ? '' : Number(selectedCoffeeId);

		// A batch the coffee was not roasted in no longer applies.
		const stillInBatch = selectedBatch?.roasts.some((roast) =>
			sameId(roast.coffee_id, selectedCoffeeId)
		);
		if (!stillInBatch) formData.batch_id = '';
		if (!roastFits()) formData.roast_id = null;
	}

	// Handle batch selection
	function handleBatchChange(event: Event) {
		formData.batch_id = (event.target as HTMLSelectElement).value;
		const batch = batches.find((candidate) => candidate.id === formData.batch_id);

		// A batch of one coffee decides the coffee.
		const coffees = batch ? batchCoffees(batch) : [];
		if (coffees.length === 1) formData.green_coffee_inv_id = coffees[0].id;
		if (!roastFits()) formData.roast_id = null;
	}

	function handleRoastToggle(event: Event) {
		formData.roast_id = (event.target as HTMLInputElement).checked ? offeredRoastId : null;
	}
</script>

<!-- Clean card-based form design matching home page patterns -->
<div class="rounded-lg bg-surface-panel p-6 shadow-sm">
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-ink">
			{isUpdate ? 'Edit Sale' : 'Add New Sale'}
		</h2>
		<p class="mt-2 text-muted">Record a coffee sale and track your profit</p>
	</div>

	<form
		onsubmit={(e) => {
			e.preventDefault();
			handleSubmit();
		}}
		class="space-y-6"
	>
		<!-- Coffee Selection Section -->
		<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
			<h3 class="mb-4 text-lg font-semibold text-ink">Coffee Details</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<label for="coffee_name" class="block text-sm font-medium text-ink"> Coffee Name </label>
					<select
						id="coffee_name"
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
						value={String(formData.green_coffee_inv_id ?? '')}
						onchange={handleCoffeeChange}
						disabled={isUpdate}
						required
					>
						<option value="">Select a coffee...</option>
						{#each coffeeOptions as coffee (coffee.id)}
							<option
								value={coffee.id}
								selected={coffee.id === String(formData.green_coffee_inv_id ?? '')}
							>
								{coffee.name}
							</option>
						{/each}
					</select>
				</div>

				<div class="space-y-2">
					<label for="batch_id" class="block text-sm font-medium text-ink">
						Batch <span class="text-muted">(optional)</span>
					</label>
					<select
						id="batch_id"
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
						value={formData.batch_id}
						onchange={handleBatchChange}
						aria-describedby={savedBatchName && !savedBatchId ? 'batch_unlinked' : undefined}
					>
						<option value="" selected={!formData.batch_id}>
							{savedBatchName && !savedBatchId
								? `Not linked · recorded as “${savedBatchName}”`
								: savedBatchId
									? 'No batch'
									: 'Select a batch (optional)...'}
						</option>
						{#if savedBatchId && !batches.some((batch) => batch.id === savedBatchId)}
							<option value={savedBatchId} selected={formData.batch_id === savedBatchId}>
								{savedBatchName || 'The batch this sale is recorded against'}
							</option>
						{/if}
						{#each filteredBatches as batch (batch.key)}
							<option value={batch.id} selected={formData.batch_id === batch.id}>
								{batchLabels.get(batch.key)}
							</option>
						{/each}
					</select>
					{#if savedBatchName && !savedBatchId}
						<p id="batch_unlinked" class="text-xs text-muted">
							This sale was recorded with a batch name and is not linked to a batch. Choose the
							batch to link it.
						</p>
					{/if}
				</div>
			</div>
			{#if canNameRoast}
				<div class="mt-4">
					<label class="flex items-start gap-2 text-sm text-ink">
						<input
							type="checkbox"
							class="mt-0.5 h-4 w-4 rounded border-line text-accent focus:ring-accent"
							checked={formData.roast_id === offeredRoastId}
							onchange={handleRoastToggle}
						/>
						<span>
							From roast #{offeredRoastId} only
							<span class="block text-xs text-muted">
								Clear this if the sale drew from more than one roast of the batch.
							</span>
						</span>
					</label>
				</div>
			{/if}
		</div>

		<!-- Sale Details Section -->
		<div class="rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
			<h3 class="mb-4 text-lg font-semibold text-ink">Sale Information</h3>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="space-y-2">
					<label for="sell_date" class="block text-sm font-medium text-ink"> Sale Date </label>
					<input
						id="sell_date"
						type="date"
						bind:value={formData.sell_date}
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="buyer" class="block text-sm font-medium text-ink"> Buyer </label>
					<input
						id="buyer"
						type="text"
						bind:value={formData.buyer}
						placeholder="Customer name or company"
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink placeholder-muted shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="oz_sold" class="block text-sm font-medium text-ink"> Amount Sold (oz) </label>
					<input
						id="oz_sold"
						type="number"
						step="0.1"
						min="0"
						bind:value={formData.oz_sold}
						placeholder="0.0"
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink placeholder-muted shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="price" class="block text-sm font-medium text-ink"> Sale Price ($) </label>
					<input
						id="price"
						type="number"
						step="0.01"
						min="0"
						bind:value={formData.price}
						placeholder="0.00"
						class="block w-full rounded-md border-0 bg-surface-panel px-3 py-2 text-ink placeholder-muted shadow-sm ring-1 ring-line focus:ring-2 focus:ring-accent"
						required
					/>
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
			<button
				type="submit"
				disabled={isSubmitting}
				class="rounded-md bg-accent px-4 py-2 font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
			>
				{isSubmitting ? 'Saving…' : isUpdate ? 'Update Sale' : 'Create Sale'}
			</button>
		</div>
	</form>
</div>
