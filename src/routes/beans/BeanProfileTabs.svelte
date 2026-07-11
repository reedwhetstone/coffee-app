<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { prepareDateForAPI } from '$lib/utils/dates';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { InventoryWithCatalog } from '$lib/types/component.types';
	import OverviewTab from './tabs/OverviewTab.svelte';
	import CuppingTab from './tabs/CuppingTab.svelte';
	import RoastingTab from './tabs/RoastingTab.svelte';
	import AnalyticsTab from './tabs/AnalyticsTab.svelte';

	let {
		selectedBean,
		role,
		canManagePortfolio = false,
		embedded = false,
		onUpdate,
		onDelete
	} = $props<{
		selectedBean: InventoryWithCatalog;
		role?: 'viewer' | 'member' | 'admin';
		canManagePortfolio?: boolean;
		embedded?: boolean;
		onUpdate: (bean: InventoryWithCatalog) => void;
		onDelete: (id: number) => void;
	}>();

	let currentTab = $state('overview');
	let isEditing = $state(false);
	let editedBean = $state<InventoryWithCatalog>({} as InventoryWithCatalog);
	let processingUpdate = $state(false);
	let lastSelectedBeanId = $state<number | null>(null);

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

	/**
	 * Navigate to the roast page pre-seeded with this bean.
	 * Uses goto() for client-side navigation (no full page reload).
	 * Falls back to 'Unknown Coffee' with a warning if catalog name is missing.
	 */
	function startNewRoast() {
		const beanName = selectedBean.coffee_catalog?.name;
		if (!beanName) {
			console.warn(
				`[BeanProfileTabs] coffee_catalog.name is missing for bean id=${selectedBean.id}. ` +
					'Using fallback name. The catalog join may have failed.'
			);
		}
		const safeName = beanName || 'Unknown Coffee';
		goto(`/roast?modal=new&beanId=${selectedBean.id}&beanName=${encodeURIComponent(safeName)}`);
	}

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
				'Are you sure you want to delete this bean? This will also delete all associated sales records, roast profiles, and logs.'
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
	async function handleCuppingSave(notes: TastingNotes, rating: number | null): Promise<boolean> {
		try {
			processingUpdate = true;
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
				// Fetch full bean with catalog join to avoid losing AI notes in the UI
				const refreshResponse = await fetch(`/api/beans?id=${selectedBean.id}`);
				if (refreshResponse.ok) {
					const result = await refreshResponse.json();
					const fullUpdatedBean = result.data?.[0];
					if (fullUpdatedBean) {
						onUpdate(fullUpdatedBean);
					} else {
						// Fallback to the PUT response if GET-by-ID fails
						const updatedBean = await response.json();
						onUpdate(updatedBean);
					}
				} else {
					const updatedBean = await response.json();
					onUpdate(updatedBean);
				}
				processingUpdate = false;
				return true;
			} else {
				const data = await response.json();
				alert(`Failed to save cupping notes: ${data.error}`);
				processingUpdate = false;
				return false;
			}
		} catch (error) {
			console.error('Error saving cupping notes:', error);
			alert('Error saving cupping notes');
			processingUpdate = false;
			return false;
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
	class={embedded
		? 'space-y-5'
		: 'rounded-lg border border-line bg-surface-panel p-4 shadow-md md:p-6'}
>
	<!-- Header with Title and Scores -->
	<div class="mb-6">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			{#if !embedded}
				<h2 class="text-xl font-bold text-ink">
					{selectedBean.coffee_catalog?.name || selectedBean.name}
				</h2>
			{/if}
			<div>
				{#if selectedBean.rank != null && typeof selectedBean.rank === 'number'}
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
									<span class="text-xl font-bold text-chart-gold md:text-2xl">
										{selectedBean.rank % 1 === 0 ? selectedBean.rank : selectedBean.rank.toFixed(1)}
									</span>
								</div>
								<span class="absolute bottom-0 left-0 right-0 text-center text-xs text-ink"
									>RATING</span
								>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Tab Navigation -->
		<div class="mt-6 border-b border-line">
			<div class="flex space-x-8">
				{#each tabs as tab}
					<button
						class="flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium transition-colors duration-200 {currentTab ===
						tab.id
							? 'border-accent text-accent'
							: 'border-transparent text-muted hover:border-line hover:text-ink'}"
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
			<OverviewTab
				{selectedBean}
				{isEditing}
				bind:editedBean
				{canManagePortfolio}
				onToggleEdit={toggleEdit}
				onDelete={deleteBean}
			/>
		{:else if currentTab === 'cupping'}
			<CuppingTab
				{selectedBean}
				aiTastingNotes={aiTastingNotes()}
				userTastingNotes={userTastingNotes()}
				{canManagePortfolio}
				onSave={handleCuppingSave}
			/>
		{:else if currentTab === 'roasting'}
			<RoastingTab {selectedBean} {role} onStartNewRoast={startNewRoast} />
		{:else if currentTab === 'analytics'}
			<AnalyticsTab {selectedBean} />
		{/if}
	</div>

	<!-- Action Buttons (non-overview tabs) -->
	{#if canManagePortfolio && currentTab !== 'overview'}
		<div class="mt-6 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
			<button
				class="min-w-[80px] rounded-md border border-danger px-3 py-1 font-medium text-danger transition-all duration-200 hover:bg-danger hover:text-white focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
				onclick={deleteBean}
			>
				Delete
			</button>
		</div>
	{/if}
</div>
