<script lang="ts">
	import { prepareDateForAPI } from '$lib/utils/dates';

	let { selectedBean, role, onUpdate, onDelete } = $props<{
		selectedBean: any;
		role?: 'viewer' | 'member' | 'admin';
		onUpdate: (bean: any) => void;
		onDelete: (id: number) => void;
	}>();

	let isEditing = $state(false);
	let editedBean = $state({ ...selectedBean });
	let currentPage = $state(0);
	const totalPages = 2;
	let processingUpdate = $state(false);
	let lastSelectedBeanId = $state<number | null>(null);

	let previousPage = $state(0);

	// List of fields that are allowed to be edited
	const editableFields = [
		'notes',
		'purchase_date',
		'purchased_qty_lbs',
		'bean_cost',
		'tax_ship_cost',
		'rank'
	];

	function slideTransition(_: Element, { duration = 300, direction = 1, delay = 0 }) {
		return {
			duration,
			delay,
			css: (t: number) => `
				transform: translateX(${direction * (1 - t) * 100}%);
				position: relative;
				z-index: 0;
			`
		};
	}

	function goToPage(pageIndex: number) {
		const current = currentPage;
		previousPage = current;
		currentPage = pageIndex;
	}

	let slideDirection = $derived(currentPage > previousPage ? 1 : -1);

	// Function to handle editing
	function toggleEdit() {
		if (isEditing) {
			// Save changes
			saveChanges();
		} else {
			// Enter edit mode
			editedBean = { ...selectedBean };
			isEditing = true;
		}
	}

	// Add safe update function with guard and memoization
	$effect(() => {
		// Skip if we're already processing or if the bean hasn't changed
		if (
			processingUpdate ||
			(lastSelectedBeanId === selectedBean?.id && lastSelectedBeanId !== null)
		) {
			return;
		}

		// Only update editedBean when selectedBean changes
		if (selectedBean) {
			processingUpdate = true;
			//	console.log('BeanProfile: Updating from selectedBean change:', selectedBean.id);

			// Track the bean ID we're processing
			lastSelectedBeanId = selectedBean.id;

			// Use setTimeout to break potential update cycles
			setTimeout(() => {
				try {
					// Deep clone to avoid reference issues
					editedBean = JSON.parse(JSON.stringify(selectedBean));
				} finally {
					processingUpdate = false;
				}
			}, 50);
		}
	});

	async function saveChanges() {
		if (processingUpdate) return;

		try {
			processingUpdate = true;
			const dataForAPI = {
				...selectedBean, // Start with the original bean to preserve non-editable fields
				...Object.fromEntries(
					Object.entries(editedBean).filter(([key]) => editableFields.includes(key))
				), // Only include editable fields from editedBean
				purchase_date: prepareDateForAPI(editedBean.purchase_date),
				last_updated: new Date().toISOString()
			};

			const response = await fetch(`/api/data?id=${selectedBean.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataForAPI)
			});

			if (response.ok) {
				const updatedBean = await response.json();
				isEditing = false;
				setTimeout(() => {
					onUpdate(updatedBean);
					processingUpdate = false;
				}, 50);
			} else {
				const data = await response.json();
				alert(`Failed to update bean: ${data.error}`);
				processingUpdate = false;
			}
		} catch (error) {
			console.error('Error updating bean:', error);
			processingUpdate = false;
		}
	}

	// Function to handle deletion
	async function deleteBean() {
		if (processingUpdate) return;

		if (
			confirm(
				'Are you sure you want to delete this bean? This will also delete all associated roast profiles and logs.'
			)
		) {
			try {
				processingUpdate = true;
				onDelete(selectedBean.id);
				setTimeout(() => {
					processingUpdate = false;
				}, 50);
			} catch (error) {
				console.error('Error during bean deletion:', error);
				processingUpdate = false;
			}
		}
	}

	// Helper function to get color class based on score
	function getScoreColorClass(score: number) {
		if (!score) return 'text-gray-400';
		if (score >= 91) return 'text-emerald-500';
		if (score >= 90) return 'text-green-500';
		if (score >= 87) return 'text-yellow-500';
		if (score >= 85) return 'text-orange-500';
		return 'text-red-500';
	}

	// Helper function to calculate the percentage for the crescent meter
	function getScorePercentage(score: number, min: number, max: number) {
		if (!score) return 0;
		const normalizedScore = Math.max(min, Math.min(max, score));
		return ((normalizedScore - min) / (max - min)) * 100;
	}

	// Helper function to get the stroke color for the crescent meter
	function getStrokeColor(value: number, isScore: boolean) {
		if (isScore) {
			if (value >= 91) return '#10b981'; // emerald-500
			if (value >= 90) return '#22c55e'; // green-500
			if (value >= 87) return '#eab308'; // yellow-500
			if (value >= 85) return '#f97316'; // orange-500
			return '#ef4444'; // red-500
		} else {
			// For rank
			if (value >= 8) return '#10b981'; // emerald-500
			if (value >= 6) return '#22c55e'; // green-500
			if (value >= 4) return '#eab308'; // yellow-500
			if (value >= 2) return '#f97316'; // orange-500
			return '#ef4444'; // red-500
		}
	}
</script>

<div
	class="rounded-lg border border-border-light bg-background-secondary-light p-4 shadow-md md:p-6"
>
	<div class="mb-4">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-bold text-text-primary-light">
				{selectedBean.coffee_catalog?.name || selectedBean.name}
			</h2>
			<div>
				{#if selectedBean.coffee_catalog?.score_value !== undefined || selectedBean.rank !== undefined}
					{@const catalogScore = selectedBean.coffee_catalog?.score_value}
					<div class="flex items-center justify-center gap-4 sm:justify-end md:gap-6">
						{#if catalogScore !== undefined}
							<div class="flex flex-col items-center">
								<div class="relative h-14 w-14 md:h-16 md:w-16">
									<!-- Background arc -->
									<svg class="absolute inset-0" viewBox="0 0 100 100">
										<path
											d="M10,50 A40,40 0 1,1 90,50"
											fill="none"
											stroke="#e5e7eb"
											stroke-width="8"
											stroke-linecap="round"
										/>
										<!-- Foreground arc (dynamic based on score) -->
										<path
											d="M10,50 A40,40 0 1,1 90,50"
											fill="none"
											stroke={getStrokeColor(catalogScore, true)}
											stroke-width="8"
											stroke-linecap="round"
											stroke-dasharray="126"
											stroke-dashoffset={126 -
												(126 * getScorePercentage(catalogScore, 0, 100)) / 100}
										/>
									</svg>
									<!-- Score value in the center -->
									<div class="absolute inset-0 flex items-center justify-center">
										<span class="text-xl font-bold md:text-2xl {getScoreColorClass(catalogScore)}">
											{catalogScore}
										</span>
									</div>
									<span
										class="text-primary-light absolute bottom-0 left-0 right-0 text-center text-xs"
										>SCORE</span
									>
								</div>
							</div>
						{/if}

						{#if selectedBean.rank !== undefined}
							<div class="flex flex-col items-center">
								{#if isEditing}
									<div class="flex flex-col items-center">
										<input
											type="number"
											min="1"
											max="10"
											step="1"
											class="w-16 rounded bg-background-primary-light px-2 py-1 text-center text-lg font-bold text-text-primary-light"
											bind:value={editedBean.rank}
										/>
									</div>
								{:else}
									<div class="relative h-14 w-14 md:h-16 md:w-16">
										<!-- Background arc -->
										<svg class="absolute inset-0" viewBox="0 0 100 100">
											<path
												d="M10,50 A40,40 0 1,1 90,50"
												fill="none"
												stroke="#e5e7eb"
												stroke-width="8"
												stroke-linecap="round"
											/>
											<!-- Foreground arc (dynamic based on rank) -->
											<path
												d="M10,50 A40,40 0 1,1 90,50"
												fill="none"
												stroke={getStrokeColor(selectedBean.rank, false)}
												stroke-width="8"
												stroke-linecap="round"
												stroke-dasharray="126"
												stroke-dashoffset={126 -
													(126 * getScorePercentage(selectedBean.rank, 0, 10)) / 100}
											/>
										</svg>
										<!-- Rank value in the center -->
										<div class="absolute inset-0 flex items-center justify-center">
											<span class="text-xl font-bold text-amber-500 md:text-2xl">
												{typeof selectedBean.rank === 'number'
													? Math.round(selectedBean.rank)
													: selectedBean.rank}
											</span>
										</div>
										<span
											class="text-primary-light absolute bottom-0 left-0 right-0 text-center text-xs"
											>RATING</span
										>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Moved page selection dots here -->
		<div class="mt-4 flex items-center justify-center gap-2">
			{#each Array(totalPages) as _, i}
				<button
					class="h-3 w-3 rounded-full transition-all duration-300 {i === currentPage
						? 'scale-110 bg-background-tertiary-light'
						: 'border border-border-light bg-background-primary-light hover:bg-border-light'}"
					onclick={() => goToPage(i)}
					aria-label="Go to page {i + 1}"
				></button>
			{/each}
		</div>
	</div>

	<div class="relative min-h-[300px] md:min-h-[400px]">
		{#key currentPage}
			<div
				class="grid grid-cols-1 gap-4 sm:grid-cols-2"
				in:slideTransition={{ direction: slideDirection, delay: 50 }}
			>
				{#if currentPage === 0}
					<!-- User-specific inventory data (always from selectedBean) -->
					{#each ['notes', 'purchase_date', 'purchased_qty_lbs', 'bean_cost', 'tax_ship_cost', 'last_updated'] as key}
						{#if selectedBean[key] !== undefined}
							<div
								class="rounded border border-border-light bg-background-secondary-light p-2 {key ===
								'notes'
									? 'col-span-1 sm:col-span-2'
									: ''}"
							>
								<span class="text-primary-light font-medium"
									>{key.replace(/_/g, ' ').toUpperCase()}:</span
								>
								{#if isEditing && editableFields.includes(key) && key !== 'last_updated'}
									{#if key === 'notes'}
										<textarea
											class="ml-2 w-full rounded bg-background-primary-light px-2 py-1 text-text-primary-light"
											rows="4"
											bind:value={editedBean[key]}
										></textarea>
									{:else if key === 'bean_cost' || key === 'tax_ship_cost'}
										<input
											type="number"
											step="0.01"
											min="0"
											class="ml-2 w-full rounded bg-background-primary-light px-2 py-1 text-text-primary-light sm:w-auto"
											bind:value={editedBean[key]}
										/>
									{:else if key === 'purchased_qty_lbs'}
										<input
											type="number"
											step="0.1"
											min="0"
											class="ml-2 w-full rounded bg-background-primary-light px-2 py-1 text-text-primary-light sm:w-auto"
											bind:value={editedBean[key]}
										/>
									{:else if key === 'purchase_date'}
										<input
											type="date"
											class="ml-2 w-full rounded bg-background-primary-light px-2 py-1 text-text-primary-light sm:w-auto"
											bind:value={editedBean[key]}
										/>
									{/if}
								{:else}
									<span
										class="ml-2 text-text-primary-light {key === 'notes'
											? 'zinc-300 space-pre-wrap block'
											: ''}"
									>
										{#if key === 'bean_cost' || key === 'tax_ship_cost'}
											${typeof selectedBean[key] === 'number'
												? selectedBean[key].toFixed(2)
												: selectedBean[key]}
										{:else}
											{selectedBean[key]}
										{/if}
									</span>
								{/if}
							</div>
						{/if}
					{/each}

					<!-- Catalog data fields (from coffee_catalog) -->
					{@const catalogData = selectedBean.coffee_catalog}
					{#if catalogData}
						{#each ['ai_description', 'arrival_date', 'region', 'processing', 'cultivar_detail'] as key}
							{#if catalogData[key] !== undefined}
								<div
									class="rounded border border-border-light bg-background-secondary-light p-2 {key ===
									'ai_description'
										? 'col-span-1 sm:col-span-2'
										: ''}"
								>
									<span class="text-primary-light font-medium"
										>{key.replace(/_/g, ' ').toUpperCase()}:</span
									>
									<span
										class="ml-2 text-text-primary-light {key === 'ai_description'
											? 'zinc-300 space-pre-wrap block'
											: ''}"
									>
										{catalogData[key]}
									</span>
								</div>
							{/if}
						{/each}

						{#if catalogData.link}
							<div class="rounded border border-border-light bg-background-secondary-light p-2">
								<span class="text-primary-light font-medium">LINK:</span>
								<a
									href={catalogData.link}
									target="_blank"
									class="ml-2 text-blue-400 hover:underline"
								>
									{catalogData.link}
								</a>
							</div>
						{/if}
					{/if}
				{:else}
					<!-- Page 2: Additional catalog details -->
					{@const catalogData = selectedBean.coffee_catalog}
					{#if catalogData}
						{#each ['grade', 'appearance', 'roast_recs', 'type', 'lot_size', 'bag_size', 'packaging', 'drying_method', 'farm_notes', 'cupping_notes', 'stocked_date', 'unstocked_date'] as key}
							{#if catalogData[key] !== undefined && catalogData[key] !== null && catalogData[key] !== ''}
								<div
									class="rounded border border-border-light bg-background-secondary-light p-2 {[
										'farm_notes',
										'cupping_notes',
										'roast_recs'
									].includes(key)
										? 'col-span-1 sm:col-span-2'
										: ''}"
								>
									<span class="text-primary-light font-medium"
										>{key.replace(/_/g, ' ').toUpperCase()}:</span
									>
									<span
										class="ml-2 text-text-primary-light {[
											'farm_notes',
											'cupping_notes',
											'roast_recs'
										].includes(key)
											? 'zinc-300 space-pre-wrap block'
											: ''}"
									>
										{catalogData[key]}
									</span>
								</div>
							{/if}
						{/each}

						{#if catalogData.cost_lb}
							<div class="rounded border border-border-light bg-background-secondary-light p-2">
								<span class="text-primary-light font-medium">CATALOG COST:</span>
								<span class="ml-2 text-text-primary-light">
									${typeof catalogData.cost_lb === 'number'
										? catalogData.cost_lb.toFixed(2)
										: catalogData.cost_lb}/lb
								</span>
							</div>
						{/if}
					{/if}

					<!-- Show other inventory fields that aren't shown on page 1 -->
					{#each Object.entries(selectedBean) as [key, value]}
						{#if !['notes', 'purchase_date', 'purchased_qty_lbs', 'bean_cost', 'tax_ship_cost', 'last_updated', 'rank', 'id', 'user', 'catalog_id', 'coffee_catalog'].includes(key) && value !== undefined && value !== null && value !== ''}
							<div class="rounded border border-border-light bg-background-secondary-light p-2">
								<span class="text-primary-light font-medium"
									>{key.replace(/_/g, ' ').toUpperCase()}:</span
								>
								<span class="ml-2 text-text-primary-light">
									{#if key === 'rank'}
										{typeof value === 'number' ? Math.round(value) : value}
									{:else}
										{value}
									{/if}
								</span>
							</div>
						{/if}
					{/each}
				{/if}
			</div>
		{/key}
	</div>
	{#if role === 'admin' || role === 'member'}
		<div class="my-4 flex flex-wrap justify-end gap-2">
			<button
				class="rounded {isEditing
					? 'border-2 border-green-800 hover:bg-green-900'
					: 'border-2 border-blue-800 hover:bg-blue-900'} min-w-[80px] px-3 py-1 text-text-primary-light"
				onclick={toggleEdit}
			>
				{isEditing ? 'Save' : 'Edit'}
			</button>
			<button
				class="min-w-[80px] rounded border-2 border-red-800 px-3 py-1 text-text-primary-light hover:bg-red-900"
				onclick={deleteBean}
			>
				Delete
			</button>
		</div>
	{/if}
</div>
