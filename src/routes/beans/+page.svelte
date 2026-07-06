<script lang="ts">
	import BeanForm from './BeanForm.svelte';
	import FormShell from '$lib/components/FormShell.svelte';
	import BeanProfileTabs from './BeanProfileTabs.svelte';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import MetricTile from '$lib/components/ui/MetricTile.svelte';
	import OperationsHero from '$lib/components/ui/OperationsHero.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { canManagePortfolio } from '$lib/services/portfolioAccess';
	import { loadBeanPickerCatalog } from './catalogPicker';

	import { filteredData, filterStore } from '$lib/stores/filterStore';

	// Cast filtered data to the correct type for this page
	let typedFilteredData = $derived($filteredData as unknown as InventoryWithCatalog[]);
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import BeansPageSkeleton from '$lib/components/BeansPageSkeleton.svelte';
	import SimpleLoadingScreen from '$lib/components/SimpleLoadingScreen.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type {
		InventoryWithCatalog,
		RoastProfile,
		CoffeeCatalog,
		CoffeeFormData
	} from '$lib/types/component.types';

	// Lazy load the tasting notes radar component
	import type { Component } from 'svelte';
	let TastingNotesRadar = $state<Component | null>(null);
	let radarComponentLoading = $state(true);

	// Load radar component after initial render
	$effect(() => {
		setTimeout(async () => {
			try {
				const module = await import('$lib/components/TastingNotesRadar.svelte');
				TastingNotesRadar = module.default;
				radarComponentLoading = false;
			} catch (error) {
				console.error('Failed to load radar component:', error);
				radarComponentLoading = false;
			}
		}, 150); // Slightly delayed to prioritize main content
	});

	// Define the type for the page data
	type PageData = {
		searchState?: {
			searchType?: 'green';
			searchId?: number;
		};
		data: Array<{
			id: number;
			rank: number | null;
			notes: string | null;
			purchase_date: string | null;
			purchased_qty_lbs: number | null;
			bean_cost: number | null;
			tax_ship_cost: number | null;
			last_updated: string;
			user: string;
			catalog_id: number | null;
			stocked: boolean | null;
			coffee_catalog?: CoffeeCatalog;
			roast_profiles?: Array<{
				oz_in: number | null;
				oz_out: number | null;
				weight_loss_percent: number | null;
				roast_id: number | null;
				batch_name: string | null;
				roast_date: string | null;
			}>;
		}>;
		catalogData?: CoffeeCatalog[];
		role?: 'viewer' | 'member' | 'admin';
		ppiAccess?: boolean;
		trackedLots?: Array<{
			catalogId: number;
			stocked: boolean | null;
			unstockedDate: string | null;
			priceDelta: number | null;
		}>;
		trackedCatalog?: CoffeeCatalog[];
	};

	let { data = { data: [], role: 'viewer', ppiAccess: false, catalogData: [] } } = $props<{
		data?: Partial<PageData>;
	}>();

	// ── Bookmarked (watchlist) tab ────────────────────────────────────────────
	type TrackedLotContext = {
		catalogId: number;
		stocked: boolean | null;
		unstockedDate: string | null;
		priceDelta: number | null;
	};

	let canUseWatchlist = $derived(
		data?.role === 'member' || data?.role === 'admin' || data?.ppiAccess === true
	);
	let trackedLotsList = $derived((data?.trackedLots ?? []) as TrackedLotContext[]);
	let trackedCatalogById = $derived(
		new Map(
			((data?.trackedCatalog ?? []) as Array<{ id: number }>).map((coffee) => [
				coffee.id,
				coffee as unknown as CoffeeCatalog
			])
		)
	);
	let portfolioTab = $state<'purchased' | 'bookmarked'>(
		page.url.searchParams.get('tab') === 'bookmarked' ? 'bookmarked' : 'purchased'
	);

	let trackedIds = $state<Set<number>>(new Set());
	$effect(() => {
		trackedIds = new Set(trackedLotsList.map((lot) => lot.catalogId));
	});

	function setTracked(catalogId: number, tracked: boolean) {
		const next = new Set(trackedIds);
		if (tracked) next.add(catalogId);
		else next.delete(catalogId);
		trackedIds = next;
	}

	async function handleToggleTrack(catalogId: number) {
		const wasTracked = trackedIds.has(catalogId);
		setTracked(catalogId, !wasTracked);
		// Optimistic update, reverted on failure.
		try {
			const res = await fetch(`/api/catalog/${catalogId}/track`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' }
			});
			if (!res.ok) throw new Error('track failed');
			const body = (await res.json()) as { tracked: boolean };
			if (body.tracked !== !wasTracked) {
				setTracked(catalogId, body.tracked);
			}
		} catch {
			setTracked(catalogId, wasTracked);
		}
	}

	function watchlistAnnotation(lot: TrackedLotContext): string {
		const parts: string[] = [];
		if (lot.stocked === false) {
			parts.push(`Delisted${lot.unstockedDate ? ` ${lot.unstockedDate}` : ''}`);
		}
		if (lot.priceDelta !== null && Math.abs(lot.priceDelta) >= 0.005) {
			const sign = lot.priceDelta > 0 ? '+' : '−';
			parts.push(`${sign}$${Math.abs(lot.priceDelta).toFixed(2)}/lb since tracked`);
		}
		return parts.join(' · ');
	}

	// Debug logging removed - was causing Svelte 5 console_log_state warnings
	// Use $inspect() or $state.snapshot() if debugging is needed

	// Track loading state for client-side data fetching
	let isLoading = $state(true);
	let clientData = $state<PageData['data']>([]);
	let catalogData = $state<CoffeeCatalog[]>([]);
	let canManagePortfolioRows = $derived(
		canManagePortfolio(data?.role || 'viewer', data?.ppiAccess === true)
	);
	let error = $state<string | null>(null);
	let isSaving = $state<string | null>(null);
	let catalogLoadPromise: Promise<void> | null = null;

	async function loadCatalogData() {
		if (catalogData.length > 0) {
			return;
		}

		if (catalogLoadPromise) {
			return catalogLoadPromise;
		}

		catalogLoadPromise = (async () => {
			catalogData = await loadBeanPickerCatalog(fetch);
		})();

		try {
			await catalogLoadPromise;
		} finally {
			catalogLoadPromise = null;
		}
	}

	// Client-side data fetching
	$effect(() => {
		const shareToken = page.url.searchParams.get('share');
		const fetchData = async () => {
			isLoading = true;
			error = null;
			try {
				// Build query params
				const params = new URLSearchParams();
				if (shareToken) params.append('share', shareToken);

				// Fetch beans data
				const response = await fetch(`/api/beans?${params}`);
				if (!response.ok) {
					throw new Error('Failed to fetch beans data');
				}
				const result = await response.json();
				clientData = result.data || [];

				// Initialize FilterStore with client data
				const currentRoute = page.url.pathname;
				filterStore.initializeForRoute(currentRoute, clientData);
			} catch (err) {
				console.error('Error fetching beans data:', err);
				error = err instanceof Error ? err.message : 'Failed to load data';
			} finally {
				isLoading = false;
			}
		};

		fetchData();
	});

	// State for form and bean selection
	let isFormVisible = $derived(page.url.searchParams.get('modal') === 'new');
	let selectedBean = $state<InventoryWithCatalog | null>(null);
	let beanProfileElement = $state<HTMLElement | null>(null);

	$effect(() => {
		const shareToken = page.url.searchParams.get('share');
		if (!isFormVisible || shareToken || catalogData.length > 0 || catalogLoadPromise) {
			return;
		}

		loadCatalogData().catch((err) => {
			console.error('Error fetching catalog data:', err);
		});
	});

	// Reset selectedBean if it's filtered out
	$effect(() => {
		if (selectedBean && typedFilteredData.length > 0) {
			const stillExists = typedFilteredData.some((bean) => bean.id === selectedBean?.id);
			if (!stillExists) {
				selectedBean = null;
			}
		}
	});

	// Function to select a bean
	function selectBean(bean: InventoryWithCatalog) {
		if (!selectedBean || selectedBean.id !== bean.id) {
			selectedBean = bean;
			// Scroll to bean profile after it renders
			setTimeout(() => {
				if (beanProfileElement) {
					beanProfileElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, 100);
		}
	}

	// Function to refresh data using client-side API call
	async function refreshData() {
		isLoading = true;
		try {
			const shareToken = page.url.searchParams.get('share');
			const params = new URLSearchParams();
			if (shareToken) params.append('share', shareToken);

			// Fetch fresh beans data
			const response = await fetch(`/api/beans?${params}`);
			if (!response.ok) {
				throw new Error('Failed to refresh beans data');
			}
			const result = await response.json();
			clientData = result.data || [];

			// Re-initialize FilterStore with fresh data
			filterStore.initializeForRoute(page.url.pathname, clientData);
		} catch (err) {
			console.error('Error refreshing data:', err);
		} finally {
			isLoading = false;
		}
	}

	// Function to handle bean deletion
	async function deleteBean(id: number) {
		isSaving = 'Deleting bean...';
		try {
			selectedBean = null;
			const response = await fetch(`/api/beans?id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await refreshData();
			} else {
				const errorData = await response.json();
				console.error('Failed to delete bean:', errorData.error || 'Unknown error');
				await refreshData();
			}
		} catch (error) {
			console.error('Error deleting bean:', error);
			await refreshData();
		} finally {
			isSaving = null;
		}
	}

	// Function to handle editing

	async function handleFormSubmit(_formData: CoffeeFormData) {
		isSaving = 'Saving...';
		try {
			await refreshData();
		} finally {
			isSaving = null;
			hideForm();
		}
	}

	// Handle search state and navigation after data loads
	$effect(() => {
		if (!isLoading && clientData.length > 0) {
			const searchState = page.state as Record<string, unknown>;

			// Check if we should show a bean based on the search state
			if (searchState?.searchType === 'green' && searchState?.searchId) {
				const foundBean = clientData.find((bean) => bean.id === searchState.searchId);
				if (foundBean) {
					selectedBean = foundBean as unknown as InventoryWithCatalog;
					setTimeout(() => {
						if (beanProfileElement) {
							beanProfileElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
						}
					}, 100);
				}
			}
		}
	});

	function handleAddNewBean() {
		selectedBean = null;
		const url = new URL(page.url);
		url.searchParams.set('modal', 'new');
		goto(url.pathname + '?' + url.searchParams.toString(), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function hideForm() {
		const url = new URL(page.url);
		url.searchParams.delete('modal');
		const search = url.searchParams.toString();
		goto(url.pathname + (search ? '?' + search : ''), {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	// Remove selectedBean from data object - use URL params for navigation instead
	function getRemainingLbs(bean: InventoryWithCatalog): number {
		const purchasedOz = (Number(bean.purchased_qty_lbs) || 0) * 16;
		const roastedOz =
			bean.roast_profiles?.reduce(
				(ozSum: number, profile: RoastProfile) => ozSum + (Number(profile.oz_in) || 0),
				0
			) || 0;
		return (purchasedOz - roastedOz) / 16;
	}

	const formatCurrency = (value: number) =>
		`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

	let portfolioSummary = $derived.by(() => {
		const rows = typedFilteredData ?? [];
		const value = rows.reduce(
			(sum, bean) => sum + (Number(bean.bean_cost) || 0) + (Number(bean.tax_ship_cost) || 0),
			0
		);
		const purchasedLbs = rows.reduce((sum, bean) => sum + (Number(bean.purchased_qty_lbs) || 0), 0);
		const remainingLbs = rows.reduce((sum, bean) => {
			const remaining = getRemainingLbs(bean);
			return remaining >= 0.5 ? sum + remaining : sum;
		}, 0);
		const stockedCount = rows.filter((bean) => bean.stocked).length;
		const avgCost = purchasedLbs > 0 ? value / purchasedLbs : 0;

		return {
			value,
			purchasedLbs,
			remainingLbs,
			stockedCount,
			avgCost,
			totalCount: rows.length
		};
	});

	/**
	 * Parses AI tasting notes JSON data safely
	 * @param tastingNotesJson - JSON string from database
	 * @returns Parsed tasting notes or null if invalid
	 */
	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			// Handle both string and object formats (Supabase jsonb can return either)
			let parsed: TastingNotes;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson as TastingNotes;
			} else {
				return null;
			}

			// Validate that required properties exist
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
			console.warn('Failed to parse tasting notes:', error, 'Input:', tastingNotesJson);
		}
		return null;
	}
</script>

<!-- Saving Operation Status -->
{#if isSaving}
	<div class="fixed right-4 top-4 z-50 rounded-lg bg-info-subtle p-4 ring-1 ring-info/30">
		<div class="flex items-center">
			<div
				class="mr-3 h-4 w-4 animate-spin rounded-full border-2 border-info border-t-transparent"
			></div>
			<span class="text-sm font-medium text-info-strong">{isSaving}</span>
		</div>
	</div>
{/if}

{#if isLoading}
	<BeansPageSkeleton />
{:else if error}
	<!-- Error state -->
	<div class="rounded-lg bg-danger-subtle p-6 text-center ring-1 ring-danger/30">
		<div class="mb-4 text-6xl opacity-50">⚠️</div>
		<h3 class="mb-2 text-lg font-semibold text-danger-strong">Failed to load data</h3>
		<p class="mb-4 text-danger">{error}</p>
		<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
			<button
				onclick={async () => {
					error = null;
					await refreshData();
				}}
				class="rounded-md bg-danger px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-danger-strong focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
			>
				Try Again
			</button>
			<button
				onclick={() => window.location.reload()}
				class="rounded-md border border-danger px-4 py-2 font-medium text-danger transition-all duration-200 hover:bg-danger hover:text-white focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
			>
				Reload Page
			</button>
		</div>
	</div>
{:else}
	<div class="space-y-6">
		<OperationsHero
			kicker="Portfolio"
			title="Coffee portfolio"
			description="Keep purchased coffee, bookmarked market lots, and roast context in one place so procurement decisions stay connected to what is actually on the shelf."
			contextLabel="Selected value"
			contextValue={formatCurrency(portfolioSummary.value)}
			primaryLabel={canManagePortfolioRows ? 'Add coffee' : ''}
			primaryHref={canManagePortfolioRows ? '/beans?modal=new' : ''}
			secondaryLabel="Browse catalog"
			secondaryHref="/catalog"
		/>

		{#if canUseWatchlist}
			<div
				class="inline-flex gap-1 rounded-lg border border-line bg-surface-panel p-1"
				role="tablist"
				aria-label="Portfolio sections"
			>
				<button
					role="tab"
					aria-selected={portfolioTab === 'purchased'}
					onclick={() => (portfolioTab = 'purchased')}
					class="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150 {portfolioTab ===
					'purchased'
						? 'bg-accent text-ink shadow-sm'
						: 'text-muted hover:text-ink'}"
				>
					Purchased
				</button>
				<button
					role="tab"
					aria-selected={portfolioTab === 'bookmarked'}
					onclick={() => (portfolioTab = 'bookmarked')}
					class="rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-150 {portfolioTab ===
					'bookmarked'
						? 'bg-accent text-ink shadow-sm'
						: 'text-muted hover:text-ink'}"
				>
					Bookmarked ({trackedLotsList.length})
				</button>
			</div>
		{/if}

		{#if canUseWatchlist && portfolioTab === 'bookmarked'}
			<!-- Bookmarked (watchlist) lots -->
			{#if trackedLotsList.length === 0}
				<div class="rounded-lg bg-surface-panel p-8 text-center ring-1 ring-line">
					<div class="mb-4 text-6xl opacity-50">🔖</div>
					<h3 class="mb-2 text-lg font-semibold text-ink">No Bookmarked Lots Yet</h3>
					<p class="mb-4 text-muted">
						Bookmark catalog lots to monitor their price and availability here, alongside your
						purchased coffees.
					</p>
					<button
						onclick={() => goto('/catalog')}
						class="rounded-md bg-accent px-4 py-2 font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
					>
						Browse the catalog
					</button>
				</div>
			{:else}
				<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
					<p class="text-sm text-muted">
						{trackedLotsList.length} bookmarked
						{trackedLotsList.length === 1 ? 'lot' : 'lots'} — click a card for the full detail panel.
					</p>
					<button
						onclick={() => goto('/catalog?tracked=only')}
						class="text-sm font-medium text-accent transition-colors duration-200 hover:text-ink"
					>
						Manage in catalog
					</button>
				</div>
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					{#each trackedLotsList as lot (lot.catalogId)}
						{@const coffee = trackedCatalogById.get(lot.catalogId)}
						{#if coffee}
							<CoffeeCard
								{coffee}
								{parseTastingNotes}
								annotation={watchlistAnnotation(lot)}
								tracked={trackedIds.has(lot.catalogId)}
								onToggleTrack={handleToggleTrack}
							/>
						{/if}
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Dashboard Cards Section -->
			{#if !isLoading && typedFilteredData && typedFilteredData.length > 0}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
					<MetricTile
						label="Portfolio value"
						value={formatCurrency(portfolioSummary.value)}
						detail={`${portfolioSummary.totalCount} selected coffees`}
						tone="accent"
					/>
					<MetricTile
						label="Purchased weight"
						value={`${portfolioSummary.purchasedLbs.toFixed(1)} lb`}
						detail={`${(portfolioSummary.purchasedLbs * 16).toFixed(0)} oz total`}
					/>
					<MetricTile
						label="Owned green coffee"
						value={`${portfolioSummary.remainingLbs.toFixed(1)} lb`}
						detail="Available for roasting"
						tone="success"
					/>
					<MetricTile
						label="Average cost"
						value={formatCurrency(portfolioSummary.avgCost)}
						detail="Per lb, including shipping and tax"
					/>
					<MetricTile
						label="Currently stocked"
						value={portfolioSummary.stockedCount}
						detail={`of ${portfolioSummary.totalCount} selected coffees`}
						tone="intelligence"
					/>
				</div>

				<!-- Source Distribution Chart -->
				<div class="rounded-lg border border-line bg-surface-panel p-5 shadow-sm">
					<h3 class="text-xl font-semibold tracking-tight text-ink">Portfolio by source</h3>
					<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each Object.entries(typedFilteredData.reduce((acc, bean) => {
									const source = bean.coffee_catalog?.source || 'Unknown';
									if (!acc[source]) {
										acc[source] = { count: 0, weight: 0, value: 0 };
									}
									acc[source].count += 1;
									acc[source].weight += bean.purchased_qty_lbs || 0;
									acc[source].value += (bean.bean_cost || 0) + (bean.tax_ship_cost || 0);
									return acc;
								}, {} as Record<string, { count: number; weight: number; value: number }>)) as entry}
							{@const [source, stats] = entry as [
								string,
								{ count: number; weight: number; value: number }
							]}
							<div class="rounded-lg border border-line bg-surface-canvas p-3">
								<h4 class="text-base font-semibold text-ink">{source}</h4>
								<div class="mt-2 space-y-1 text-sm text-muted">
									<div>{stats.count} coffee{stats.count !== 1 ? 's' : ''}</div>
									<div>{stats.weight.toFixed(1)} lbs</div>
									<div class="font-medium text-accent">
										${stats.value.toFixed(2)}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Bean Profile Section -->

			{#if selectedBean}
				<div class="mb-4" bind:this={beanProfileElement}>
					<BeanProfileTabs
						{selectedBean}
						role={data?.role || 'viewer'}
						canManagePortfolio={canManagePortfolioRows}
						onUpdate={(updatedBean) => {
							// Update selectedBean immediately for instant UI feedback
							selectedBean = updatedBean;
							// Update clientData in place without triggering loading skeleton
							clientData = clientData.map((bean) =>
								bean.id === updatedBean.id ? (updatedBean as (typeof clientData)[0]) : bean
							);
							// Re-initialize filter store with updated data (no isLoading flash)
							filterStore.initializeForRoute(page.url.pathname, clientData);
						}}
						onDelete={async (id) => {
							await deleteBean(id);
							selectedBean = null;
						}}
					/>
				</div>
			{/if}

			<!-- Form Modal -->
			<FormShell visible={isFormVisible}>
				<BeanForm
					bean={null}
					onClose={hideForm}
					onSubmit={handleFormSubmit}
					catalogBeans={catalogData}
				/>
			</FormShell>

			<!-- Quick Actions -->
			{#if !isLoading && typedFilteredData && typedFilteredData.length > 0}
				<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
					<div class="text-sm text-muted">
						Showing {typedFilteredData.length} of {clientData.length || 0} coffees
					</div>
				</div>
			{/if}

			<!-- Coffee Cards -->
			<div class="flex-1">
				{#if isLoading}
					<SimpleLoadingScreen
						show={true}
						message="Loading your coffee inventory..."
						overlay={false}
					/>
				{:else if !typedFilteredData || typedFilteredData.length === 0}
					<div class="rounded-lg bg-surface-panel p-8 text-center ring-1 ring-line">
						<div class="mb-4 text-6xl opacity-50">☕</div>
						<h3 class="mb-2 text-lg font-semibold text-ink">
							{clientData.length > 0 ? 'No Coffees Match Your Filters' : 'No Coffee Beans Yet'}
						</h3>
						<p class="mb-4 text-muted">
							{clientData.length > 0
								? 'Try adjusting your filters to see more coffees, or add a new coffee to your inventory.'
								: 'Start building your coffee inventory by adding your first green coffee bean.'}
						</p>
						<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
							<button
								onclick={() => handleAddNewBean()}
								class="rounded-md bg-accent px-4 py-2 font-medium text-ink transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
							>
								{clientData.length > 0 ? 'Add New Coffee' : 'Add Your First Bean'}
							</button>
							{#if clientData.length > 0}
								<button
									onclick={() => filterStore.clearFilters()}
									class="rounded-md border border-accent px-4 py-2 font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
								>
									Clear Filters
								</button>
							{/if}
						</div>
					</div>
				{:else}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						{#each typedFilteredData as bean}
							{@const catalogData = bean.coffee_catalog}
							{@const displayName = catalogData?.name || 'Unknown Coffee'}
							{@const displaySource = catalogData?.source || 'Unknown Source'}
							{@const displayAiDescription = catalogData?.ai_description}
							{@const displayLocation =
								[catalogData?.continent, catalogData?.country, catalogData?.region]
									.filter(Boolean)
									.join(' > ') || '-'}
							{@const displayProcessing = catalogData?.processing}
							{@const displayCultivar = catalogData?.cultivar_detail}
							{@const displayGrade = catalogData?.grade}
							{@const displayAppearance = catalogData?.appearance}
							{@const displayType = catalogData?.type}
							{@const displayArrival = catalogData?.arrival_date}
							{@const tastingNotes = parseTastingNotes(
								catalogData?.ai_tasting_notes as string | object | null
							)}
							{@const userCuppingNotes = parseTastingNotes(
								bean.cupping_notes as string | object | null
							)}
							{@const isWholesale = catalogData?.wholesale === true}
							{@const hasUserRating = bean.rank !== undefined && bean.rank !== null}
							{@const hasUserCupping = userCuppingNotes !== null}
							{@const purchasedOz = (bean.purchased_qty_lbs || 0) * 16}
							{@const roastedOz =
								bean.roast_profiles?.reduce(
									(ozSum: number, profile: RoastProfile) => ozSum + (profile.oz_in || 0),
									0
								) || 0}
							{@const remainingLbs = (purchasedOz - roastedOz) / 16}
							<button
								type="button"
								class="group relative rounded-lg border border-line bg-surface-canvas p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-accent/70 hover:shadow-md"
								onclick={() => selectBean(bean)}
							>
								<!-- Mobile-optimized layout -->
								<div
									class="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0"
								>
									<!-- Content section -->
									<div class="flex-1">
										<h3
											class="text-xl font-semibold leading-snug tracking-tight text-ink group-hover:text-accent {hasUserRating ||
											hasUserCupping ||
											isWholesale
												? 'pr-16 sm:pr-0'
												: ''}"
										>
											{displayName}
										</h3>
										<div class="mt-1 flex items-center justify-between">
											<div class="flex items-center gap-2">
												<p class="text-sm font-medium text-organic-rust">
													{displaySource}
												</p>
												{#if hasUserRating || hasUserCupping || isWholesale}
													<div class="hidden gap-1 sm:flex">
														{#if isWholesale}
															<span
																class="rounded-full bg-intelligence-subtle px-2 py-0.5 text-[11px] font-medium text-intelligence-strong"
															>
																Wholesale
															</span>
														{/if}
														{#if hasUserRating}
															<span
																class="rounded-full bg-warning-subtle px-2 py-0.5 text-[11px] font-medium text-warning-strong"
															>
																Rated {bean.rank}
															</span>
														{/if}
														{#if hasUserCupping}
															<span
																class="rounded-full bg-success-subtle px-2 py-0.5 text-[11px] font-medium text-success-strong"
															>
																Cupped
															</span>
														{/if}
													</div>
												{/if}
											</div>
											<!-- Mobile: Price next to supplier name -->
											<div class="text-right sm:hidden">
												<div class="text-xl font-semibold text-ink">
													${(bean.purchased_qty_lbs
														? ((bean.tax_ship_cost || 0) + (bean.bean_cost || 0)) /
															bean.purchased_qty_lbs
														: 0
													).toFixed(2)}/lb
												</div>
											</div>
										</div>
										{#if displayAiDescription}
											<p class="my-4 border-l-4 border-accent pl-3 text-sm leading-6 text-muted">
												{displayAiDescription}
											</p>
										{/if}

										<!-- Mobile: Chart full width -->
										{#if tastingNotes}
											<div class="mt-2 px-6 sm:hidden">
												{#if radarComponentLoading}
													<ChartSkeleton height="300px" title="Loading tasting profile..." />
												{:else if TastingNotesRadar}
													<TastingNotesRadar {tastingNotes} size={300} responsive={true} />
												{/if}
											</div>
										{/if}

										<div class="mt-3 grid gap-x-4 gap-y-1.5 text-xs text-muted sm:grid-cols-2">
											<div><span class="font-medium">Location:</span> {displayLocation}</div>
											<div>
												{#if displayProcessing}
													<span>Processing: {displayProcessing}</span>
												{/if}
											</div>
											<div>
												{#if displayCultivar}
													<span>Cultivar: {displayCultivar}</span>
												{/if}
											</div>
											<div>
												{#if displayGrade}
													<span>Elevation: {displayGrade}</span>
												{/if}
											</div>
											<div>
												{#if displayAppearance}
													<span>Appearance: {displayAppearance}</span>
												{/if}
											</div>
											<div>
												{#if displayType}
													<span>Importer: {displayType}</span>
												{/if}
											</div>
											<div>
												{#if displayArrival}
													<span>Arrival: {displayArrival}</span>
												{/if}
											</div>
											<div>
												{#if bean.purchase_date}
													<span>Purchase: {bean.purchase_date}</span>
												{/if}
											</div>
											<div>
												<span class="font-medium">{bean.stocked ? 'Stocked' : 'Unstocked'}:</span>
												<span
													class={bean.stocked === false
														? 'text-danger'
														: remainingLbs > 0
															? 'text-success-strong'
															: 'text-danger'}
												>
													{remainingLbs.toFixed(1)} lbs
												</span>
												{#if roastedOz > 0}
													<span class="text-muted">
														({roastedOz.toFixed(0)} oz roasted)
													</span>
												{/if}
											</div>
										</div>
									</div>

									<!-- Desktop: Price, score, and chart in sidebar -->
									<div class="hidden flex-col items-end space-y-2 sm:flex">
										<div class="text-right">
											<div class="text-2xl font-semibold tabular-nums text-ink">
												${(bean.purchased_qty_lbs
													? ((bean.tax_ship_cost || 0) + (bean.bean_cost || 0)) /
														bean.purchased_qty_lbs
													: 0
												).toFixed(2)}/lb
											</div>
										</div>
										{#if tastingNotes}
											<div class="pt-4">
												{#if radarComponentLoading}
													<ChartSkeleton height="180px" title="Loading tasting profile..." />
												{:else if TastingNotesRadar}
													<TastingNotesRadar {tastingNotes} size={180} />
												{/if}
											</div>
										{/if}
									</div>
								</div>

								<div class="mt-3 flex items-center justify-end">
									<svg
										class="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
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
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
