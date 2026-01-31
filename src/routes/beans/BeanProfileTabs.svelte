<script lang="ts">
	import { untrack } from 'svelte';
	import { prepareDateForAPI } from '$lib/utils/dates';
	import TastingNotesRadar from '$lib/components/TastingNotesRadar.svelte';
	import CuppingNotesForm from './CuppingNotesForm.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { InventoryWithCatalog, RoastProfile } from '$lib/types/component.types';

	let { selectedBean, role, onUpdate, onDelete } = $props<{
		selectedBean: InventoryWithCatalog;
		role?: 'viewer' | 'member' | 'admin';
		onUpdate: (bean: InventoryWithCatalog) => void;
		onDelete: (id: number) => void;
	}>();

	let currentTab = $state('overview');
	let isEditing = $state(false);
	let editedBean = $state<InventoryWithCatalog>({} as InventoryWithCatalog);
	let processingUpdate = $state(false);
	let lastSelectedBeanId = $state<number | null>(null);
	let showCuppingForm = $state(false);

	// Parse AI tasting notes
	let aiTastingNotes = $derived((): TastingNotes | null => {
		if (selectedBean.coffee_catalog?.ai_tasting_notes) {
			try {
				const parsed =
					typeof selectedBean.coffee_catalog.ai_tasting_notes === 'string'
						? JSON.parse(selectedBean.coffee_catalog.ai_tasting_notes)
						: selectedBean.coffee_catalog.ai_tasting_notes;

				// Validate structure
				if (
					parsed.body &&
					parsed.flavor &&
					parsed.acidity &&
					parsed.sweetness &&
					parsed.fragrance_aroma
				) {
					return parsed as TastingNotes;
				}
			} catch (error) {
				console.warn('Failed to parse AI tasting notes:', error);
			}
		}
		return null;
	});

	// Parse user cupping notes
	let userTastingNotes = $derived((): TastingNotes | null => {
		// Ensure this derives from selectedBean to trigger updates
		const bean = selectedBean;
		if (bean?.cupping_notes) {
			try {
				const parsed =
					typeof bean.cupping_notes === 'string'
						? JSON.parse(bean.cupping_notes)
						: bean.cupping_notes;

				// Validate structure
				if (
					parsed.body &&
					parsed.flavor &&
					parsed.acidity &&
					parsed.sweetness &&
					parsed.fragrance_aroma
				) {
					return parsed as TastingNotes;
				}
			} catch (error) {
				console.warn('Failed to parse user cupping notes:', error);
			}
		}
		return null;
	});

	// List of fields that are allowed to be edited
	const editableFields = [
		'notes',
		'purchase_date',
		'purchased_qty_lbs',
		'bean_cost',
		'tax_ship_cost',
		'rank',
		'stocked'
	];

	const tabs = [
		{ id: 'overview', label: 'Overview', icon: '📊' },
		{ id: 'cupping', label: 'Cupping', icon: '☕' },
		{ id: 'roasting', label: 'Roasting', icon: '🔥' },
		{ id: 'analytics', label: 'Analytics', icon: '📈' }
	];

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

	// Update editedBean when selectedBean changes
	$effect(() => {
		// Read selectedBean to track it as a dependency
		const bean = selectedBean;
		if (!bean) return;

		// Use untrack for reads/writes to state that shouldn't re-trigger this effect
		untrack(() => {
			// Skip if we're processing an update from this component to avoid cycles
			if (processingUpdate && lastSelectedBeanId === bean.id) {
				return;
			}

			// Update the last processed ID
			lastSelectedBeanId = bean.id;

			// Deep clone to avoid reference issues
			const cloned = JSON.parse(JSON.stringify(bean));

			// Ensure stocked has a boolean value (default to false if null/undefined)
			if (cloned.stocked === null || cloned.stocked === undefined) {
				cloned.stocked = false;
			}

			editedBean = cloned;
		});
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
				purchase_date: prepareDateForAPI(editedBean.purchase_date ?? ''),
				last_updated: new Date().toISOString()
			};

			const response = await fetch(`/api/beans?id=${selectedBean.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataForAPI)
			});

			if (response.ok) {
				const updatedBean = await response.json();
				isEditing = false;
				onUpdate(updatedBean);
				processingUpdate = false;
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
				processingUpdate = false;
			} catch (error) {
				console.error('Error during bean deletion:', error);
				processingUpdate = false;
			}
		}
	}

	// Handle cupping notes save
	async function handleCuppingSave(notes: TastingNotes, rating: number | null) {
		try {
			const dataForAPI = {
				...selectedBean,
				cupping_notes: JSON.stringify(notes),
				rank: rating,
				last_updated: new Date().toISOString()
			};

			const response = await fetch(`/api/beans?id=${selectedBean.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(dataForAPI)
			});

			if (response.ok) {
				const updatedBean = await response.json();
				showCuppingForm = false;
				onUpdate(updatedBean);
			} else {
				const data = await response.json();
				alert(`Failed to save cupping notes: ${data.error}`);
			}
		} catch (error) {
			console.error('Error saving cupping notes:', error);
			alert('Error saving cupping notes');
		}
	}

	// Helper function to calculate the percentage for the crescent meter
	function getScorePercentage(score: number, min: number, max: number) {
		if (!score) return 0;
		const normalizedScore = Math.max(min, Math.min(max, score));
		return ((normalizedScore - min) / (max - min)) * 100;
	}

	// Helper function to get the stroke color for the rating crescent meter
	function getRatingStrokeColor(value: number) {
		if (value >= 8) return '#10b981'; // emerald-500
		if (value >= 6) return '#22c55e'; // green-500
		if (value >= 4) return '#eab308'; // yellow-500
		if (value >= 2) return '#f97316'; // orange-500
		return '#ef4444'; // red-500
	}
</script>

<div
	class="rounded-lg border border-border-light bg-background-secondary-light p-4 shadow-md md:p-6"
>
	<!-- Header with Title and Scores -->
	<div class="mb-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<h2 class="text-xl font-bold text-text-primary-light">
				{selectedBean.coffee_catalog?.name || selectedBean.name}
			</h2>
			<div>
				{#if selectedBean.rank !== undefined}
					<div class="flex items-center justify-center gap-4 sm:justify-end md:gap-6">
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
									<!-- Foreground arc (dynamic based on rank) -->
									<path
										d="M10,50 A40,40 0 1,1 90,50"
										fill="none"
										stroke={getRatingStrokeColor(selectedBean.rank)}
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
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Tab Navigation -->
		<div class="mt-6 border-b border-border-light">
			<div class="flex space-x-8">
				{#each tabs as tab}
					<button
						class="flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium transition-colors duration-200 {currentTab ===
						tab.id
							? 'border-background-tertiary-light text-background-tertiary-light'
							: 'border-transparent text-text-secondary-light hover:border-border-light hover:text-text-primary-light'}"
						onclick={() => (currentTab = tab.id)}
					>
						<span>{tab.icon}</span>
						{tab.label}
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Tab Content -->
	<div class="min-h-[400px]">
		{#if currentTab === 'overview'}
			<div class="space-y-6">
				<!-- User Inventory Data Section -->
				<div>
					<h3 class="mb-4 font-semibold text-text-primary-light">Your Inventory</h3>

					<!-- Notes field without border -->
					{#if selectedBean.notes !== undefined && selectedBean.notes !== null && selectedBean.notes !== ''}
						<div class="mb-4">
							{#if isEditing && editableFields.includes('notes')}
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
									{#if isEditing && editableFields.includes(key)}
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

				<!-- Supplier Information Section -->
				{#if selectedBean.coffee_catalog}
					{@const catalogData = selectedBean.coffee_catalog}
					{@const isPrivateCoffee = catalogData.public_coffee === false}
					{@const baseFields = [
						'arrival_date',
						'region',
						'processing',
						'drying_method',
						'cultivar_detail',
						'grade',
						'appearance',
						'type',
						'lot_size',
						'bag_size',
						'packaging',
						'cost_lb'
					]}
					{@const privateFields = [
						'description_short',
						'description_long',
						'farm_notes',
						'roast_recs'
					]}
					{@const availableFields = isPrivateCoffee
						? [...baseFields, ...privateFields]
						: baseFields}
					{@const displayFields = availableFields.filter(
						(field) =>
							catalogData[field] !== undefined &&
							catalogData[field] !== null &&
							catalogData[field] !== ''
					)}
					{@const formatSupplierName = (source: string) => {
						if (!source) return '';
						return source
							.split('_')
							.map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
							.join(' ');
					}}

					{#if displayFields.length > 0 || catalogData.source || catalogData.ai_description}
						<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
							<div class="mb-4 flex items-center justify-between">
								<h3 class="font-semibold text-text-primary-light">
									{catalogData.source
										? formatSupplierName(catalogData.source) + ' Bean Information'
										: 'Supplier Information'}
								</h3>
								{#if catalogData.link}
									<a
										href={catalogData.link}
										target="_blank"
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

							<!-- AI Description without border -->
							{#if catalogData.ai_description}
								<div class="mb-4">
									<div class="whitespace-pre-wrap text-text-primary-light">
										{catalogData.ai_description}
									</div>
								</div>
							{/if}

							<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
								{#each displayFields as key}
									<div
										class={key === 'description_short' ||
										key === 'description_long' ||
										key === 'farm_notes' ||
										key === 'roast_recs'
											? 'lg:col-span-2'
											: ''}
									>
										<div
											class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light"
										>
											<h4 class="text-sm font-medium text-text-primary-light">
												{key.replace(/_/g, ' ').toUpperCase()}
											</h4>
											<div
												class="mt-2 text-text-primary-light {key === 'description_short' ||
												key === 'description_long' ||
												key === 'farm_notes' ||
												key === 'roast_recs'
													? 'whitespace-pre-wrap'
													: ''}"
											>
												{#if key === 'cost_lb'}
													${typeof catalogData[key] === 'number'
														? catalogData[key].toFixed(2)
														: catalogData[key]}/lb
												{:else}
													{catalogData[key]}
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</div>
		{:else if currentTab === 'cupping'}
			<div class="space-y-6">
				{#if showCuppingForm}
					<CuppingNotesForm
						initialNotes={userTastingNotes()}
						initialRating={selectedBean.rank}
						aiTastingNotes={aiTastingNotes()}
						onSave={handleCuppingSave}
						onCancel={() => (showCuppingForm = false)}
					/>
				{:else}
					<!-- Cupping Overview -->
					<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<!-- Radar Chart Section -->
						<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
							<div class="mb-4 flex items-center justify-between">
								<h3 class="font-semibold text-text-primary-light">Tasting Profile</h3>
								{#if role === 'admin' || role === 'member'}
									<button
										onclick={() => (showCuppingForm = true)}
										class="rounded-md bg-background-tertiary-light px-3 py-1 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
									>
										{userTastingNotes() ? 'Edit' : 'Add'} Cupping Notes
									</button>
								{/if}
							</div>

							<div class="flex justify-center">
								{#if aiTastingNotes() || userTastingNotes()}
									<TastingNotesRadar
										tastingNotes={aiTastingNotes()}
										userTastingNotes={userTastingNotes()}
										showOverlay={!!(aiTastingNotes() && userTastingNotes())}
										size={300}
										responsive={false}
									/>
								{:else}
									<div
										class="flex h-[300px] w-[300px] items-center justify-center rounded-lg border border-gray-200 bg-gray-50"
									>
										<span class="text-sm text-gray-400">No tasting data available</span>
									</div>
								{/if}
							</div>

							{#if aiTastingNotes() && userTastingNotes()}
								<p class="mt-2 text-center text-xs text-text-secondary-light">
									Solid circles: AI assessment • Dashed circles: Your assessment
								</p>
							{/if}
						</div>

						<!-- Rating & Notes Section -->
						<div class="space-y-4">
							<!-- User Rating -->
							<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
								<h4 class="mb-2 font-medium text-text-primary-light">Your Rating</h4>
								{#if selectedBean.rank !== undefined}
									<div class="flex items-center gap-3">
										<span class="text-2xl font-bold text-background-tertiary-light">
											{selectedBean.rank}
										</span>
										<span class="text-text-secondary-light">/10</span>
									</div>
								{:else}
									<p class="text-sm text-text-secondary-light">No rating yet</p>
								{/if}
							</div>

							<!-- Cupping Notes Summary -->
							{#if userTastingNotes()}
								{@const notes = userTastingNotes()}
								{#if notes}
									<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
										<h4 class="mb-3 font-medium text-text-primary-light">Your Cupping Notes</h4>
										<div class="space-y-2">
											{#each Object.entries(notes) as [key, note]}
												<div class="flex items-center justify-between">
													<span class="text-sm capitalize text-text-secondary-light">
														{key.replace('_', ' ')}:
													</span>
													<div class="flex items-center gap-2">
														<div
															class="h-3 w-3 rounded-full"
															style="background-color: {note.color}"
														></div>
														<span class="text-sm font-medium text-text-primary-light">
															{note.tag}
														</span>
														<span class="text-xs text-text-secondary-light">
															({note.score}/5)
														</span>
													</div>
												</div>
											{/each}
										</div>
									</div>
								{/if}
							{:else}
								<div class="rounded-lg bg-background-primary-light p-4 ring-1 ring-border-light">
									<h4 class="mb-2 font-medium text-text-primary-light">Your Cupping Notes</h4>
									<p class="text-sm text-text-secondary-light">No cupping notes yet</p>
									{#if role === 'admin' || role === 'member'}
										<button
											onclick={() => (showCuppingForm = true)}
											class="mt-2 rounded-md bg-background-tertiary-light px-3 py-1 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
										>
											Add Cupping Assessment
										</button>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{:else if currentTab === 'roasting'}
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<h3 class="text-lg font-semibold text-text-primary-light">Roasting History</h3>
					{#if role === 'admin' || role === 'member'}
						<button
							onclick={() => {
								window.location.href = `/roast?beanId=${selectedBean.id}&beanName=${encodeURIComponent(selectedBean.coffee_catalog?.name || selectedBean.name)}`;
							}}
							class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Start New Roast
						</button>
					{/if}
				</div>

				{#if selectedBean.roast_profiles && selectedBean.roast_profiles.length > 0}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each selectedBean.roast_profiles as profile, index}
							<button
								class="w-full cursor-pointer rounded-lg bg-background-primary-light p-4 text-left ring-1 ring-border-light transition-all duration-200 hover:bg-background-secondary-light hover:ring-2 hover:ring-background-tertiary-light"
								onclick={() => {
									if (profile.roast_id) {
										window.location.href = `/roast?profileId=${profile.roast_id}`;
									}
								}}
								disabled={!profile.roast_id}
							>
								<div class="mb-2 flex items-center justify-between">
									<h4 class="font-medium text-text-primary-light">
										{profile.batch_name || `Roast #${index + 1}`}
									</h4>
									<div class="text-right">
										<div class="text-xs text-text-secondary-light">
											{profile.oz_in || 0} oz → {profile.oz_out || 0} oz
										</div>
										{#if profile.roast_id}
											<div class="text-xs text-text-secondary-light">
												ID: {profile.roast_id}
											</div>
										{/if}
									</div>
								</div>
								<div class="mb-2 text-sm text-text-secondary-light">
									Loss: {profile.weight_loss_percent !== null &&
									profile.weight_loss_percent !== undefined
										? profile.weight_loss_percent.toFixed(1)
										: 'N/A'}%
								</div>
								{#if profile.roast_date}
									<div class="mt-1 text-xs text-text-secondary-light">
										{new Date(profile.roast_date).toLocaleDateString()}
									</div>
								{/if}
							</button>
						{/each}
					</div>

					<!-- Summary Stats -->
					{@const totalOzIn = selectedBean.roast_profiles.reduce(
						(sum: number, p: RoastProfile) => sum + (p.oz_in || 0),
						0
					)}
					{@const totalOzOut = selectedBean.roast_profiles.reduce(
						(sum: number, p: RoastProfile) => sum + (p.oz_out || 0),
						0
					)}
					{@const validRoastsForLoss = selectedBean.roast_profiles.filter(
						(p: RoastProfile) =>
							p.weight_loss_percent !== null && p.weight_loss_percent !== undefined
					)}
					{@const avgLoss =
						validRoastsForLoss.length > 0
							? validRoastsForLoss.reduce(
									(sum: number, p: RoastProfile) => sum + (p.weight_loss_percent || 0),
									0
								) / validRoastsForLoss.length
							: 0}

					<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
						<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
							<h4 class="text-sm font-medium text-text-primary-light">Total Roasted</h4>
							<p class="text-2xl font-bold text-blue-500">{totalOzIn.toFixed(1)} oz</p>
						</div>
						<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
							<h4 class="text-sm font-medium text-text-primary-light">Total Output</h4>
							<p class="text-2xl font-bold text-green-500">{totalOzOut.toFixed(1)} oz</p>
						</div>
						<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
							<h4 class="text-sm font-medium text-text-primary-light">Avg Loss Rate</h4>
							<p class="text-2xl font-bold text-orange-500">
								{validRoastsForLoss.length > 0 ? avgLoss.toFixed(1) : 'N/A'}%
							</p>
							<p class="text-xs text-text-secondary-light">
								{validRoastsForLoss.length > 0
									? `Average from ${validRoastsForLoss.length} roast${validRoastsForLoss.length === 1 ? '' : 's'} with calculated loss data`
									: 'No roasts with weight loss data available'}
							</p>
						</div>
					</div>
				{:else}
					<div
						class="rounded-lg bg-background-primary-light p-8 text-center ring-1 ring-border-light"
					>
						<div class="mb-4 text-4xl opacity-50">🔥</div>
						<h4 class="mb-2 text-lg font-semibold text-text-primary-light">No Roasts Yet</h4>
						<p class="mb-4 text-text-secondary-light">
							Start your first roast with this coffee to see roasting history and analytics.
						</p>
						{#if role === 'admin' || role === 'member'}
							<button
								onclick={() => {
									window.location.href = `/roast?beanId=${selectedBean.id}&beanName=${encodeURIComponent(selectedBean.coffee_catalog?.name || selectedBean.name)}`;
								}}
								class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
							>
								Start First Roast
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{:else if currentTab === 'analytics'}
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
				{#if selectedBean.coffee_catalog?.cost_lb}
					{@const paidPerLb = selectedBean.purchased_qty_lbs
						? ((selectedBean.bean_cost || 0) + (selectedBean.tax_ship_cost || 0)) /
							selectedBean.purchased_qty_lbs
						: 0}
					{@const marketPrice = selectedBean.coffee_catalog.cost_lb}
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
		{/if}
	</div>

	<!-- Action Buttons -->
	{#if role === 'admin' || role === 'member'}
		<div class="mt-6 flex flex-wrap justify-end gap-2 border-t border-border-light pt-4">
			{#if currentTab === 'overview'}
				<button
					class="rounded-md {isEditing
						? 'bg-green-600 text-white hover:bg-green-700'
						: 'border border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light hover:text-white'} min-w-[80px] px-3 py-1 font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
					onclick={toggleEdit}
				>
					{isEditing ? 'Save' : 'Edit'}
				</button>
			{/if}
			<button
				class="min-w-[80px] rounded-md border border-red-600 px-3 py-1 font-medium text-red-600 transition-all duration-200 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
				onclick={deleteBean}
			>
				Delete
			</button>
		</div>
	{/if}
</div>
