<script lang="ts">
	import { untrack } from 'svelte';
	import BeanForm from './BeanForm.svelte';
	import FormShell from '$lib/components/FormShell.svelte';
	import BeanProfileTabs from './BeanProfileTabs.svelte';
	import PortfolioBeanDetail from './PortfolioBeanDetail.svelte';
	import type { PortfolioContext, PortfolioPage } from '$lib/server/portfolioPage';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import MetricTile from '$lib/components/ui/MetricTile.svelte';
	import OperationsHero from '$lib/components/ui/OperationsHero.svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { canManagePortfolio } from '$lib/services/portfolioAccess';
	import { loadBeanPickerCatalog } from './catalogPicker';
	import { deletePortfolioBean } from './deleteBean';
	import { createTrackedLotStateController } from '$lib/client/trackedLots';
	import type { PageAuthView } from '$lib/types/auth.types';
	import { formatSourceName } from '$lib/utils/formatters';

	import { filteredData, filterStore } from '$lib/stores/filterStore';

	// Cast filtered data to the correct type for this page
	let typedFilteredData = $derived($filteredData as unknown as InventoryWithCatalog[]);
	import BeansPageSkeleton from '$lib/components/BeansPageSkeleton.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';
	import type {
		InventoryWithCatalog,
		CoffeeCatalog,
		CoffeeFormData
	} from '$lib/types/component.types';

	// Define the type for the page data
	type PageData = {
		searchState?: {
			searchType?: 'green';
			searchId?: number;
		};
		purchases?: Promise<{
			data: unknown[];
			error: string | null;
			portfolio?: PortfolioContext;
			pagination?: PortfolioPage['pagination'];
		}>;
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
		auth: PageAuthView;
		trackedLots?: Array<{
			catalogId: number;
			stocked: boolean | null;
			unstockedDate: string | null;
			priceDelta: number | null;
		}>;
		trackedCatalog?: CoffeeCatalog[];
	};

	let {
		data = {
			data: [],
			auth: { isSignedIn: false, user: null, role: 'viewer', ppiAccess: false },
			catalogData: []
		}
	} = $props<{
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
		data.auth?.role === 'member' || data.auth?.role === 'admin' || data.auth?.ppiAccess === true
	);
	let trackedLotsList = $state<TrackedLotContext[]>([]);
	let trackedCatalog = $state<CoffeeCatalog[]>([]);
	let watchlistLoaded = $state(false);
	let watchlistLoading = $state(false);
	let watchlistError = $state<string | null>(null);
	let watchlistEpoch = 0;
	$effect(() => {
		const owner = data.auth?.user?.id;
		void owner;
		untrack(() => {
			watchlistEpoch += 1;
			trackedLotsList = [];
			trackedCatalog = [];
			watchlistLoaded = false;
			watchlistLoading = false;
			watchlistError = null;
		});
	});
	let trackedCatalogById = $derived(
		new Map(
			(trackedCatalog as Array<{ id: number }>).map((coffee) => [
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

	const trackedLotStateController = createTrackedLotStateController(fetch, setTracked);

	async function handleToggleTrack(catalogId: number) {
		const wasTracked = trackedIds.has(catalogId);
		await trackedLotStateController.setDesiredState(catalogId, wasTracked, !wasTracked);
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
	let portfolioContext = $state<PortfolioContext | null>(null);
	let portfolioPagination = $state<PortfolioPage['pagination'] | null>(null);
	let portfolioRefetching = $state(false);
	let portfolioPageError = $state<string | null>(null);
	let lastPortfolioQuery = '';
	let portfolioRequest = 0;
	function currentPortfolioQuery() {
		return JSON.stringify({
			filters: $filterStore.filters,
			sort_field: $filterStore.sortField ?? '',
			sort_direction: $filterStore.sortDirection ?? 'desc'
		});
	}
	function applyPortfolioPage(result: PortfolioPage) {
		error = null;
		isLoading = false;
		clientData = result.data as PageData['data'];
		portfolioContext = result.portfolio;
		portfolioPagination = result.pagination;
		filterStore.setPortfolioPage(result.data, result.portfolio.uniqueValues);
	}
	async function loadPortfolioPage(offset = 0) {
		error = null;
		if (!portfolioContext) isLoading = true;
		const request = ++portfolioRequest;
		portfolioRefetching = true;
		portfolioPageError = null;
		const params = new URLSearchParams({
			portfolio: 'true',
			filters: JSON.stringify($filterStore.filters),
			sort_field: $filterStore.sortField ?? '',
			sort_direction: $filterStore.sortDirection ?? 'desc',
			offset: String(offset),
			limit: '50'
		});
		try {
			const response = await fetch(`/api/beans?${params}`);
			if (!response.ok) throw new Error('Unable to load portfolio page');
			const result = (await response.json()) as PortfolioPage;
			if (request !== portfolioRequest) return;
			if (!result.portfolio || !result.pagination) throw new Error('Invalid portfolio page');
			// A deletion can empty the last page. Return to a valid page while keeping filters.
			if (offset > 0 && result.pagination.total <= offset) {
				await loadPortfolioPage(Math.max(0, Math.floor((result.pagination.total - 1) / 50) * 50));
				return;
			}
			applyPortfolioPage(result);
		} catch {
			if (request === portfolioRequest) {
				portfolioPageError = 'Unable to refresh your portfolio. Please try again.';
				if (!portfolioContext) error = portfolioPageError;
			}
		} finally {
			if (request === portfolioRequest) {
				portfolioRefetching = false;
				isLoading = false;
			}
		}
	}
	$effect(() => {
		if (!portfolioContext || !$filterStore.portfolioServerSide || $filterStore.routeId !== '/beans')
			return;
		const key = currentPortfolioQuery();
		if (key === lastPortfolioQuery) return;
		portfolioRequest += 1;
		const timer = setTimeout(() => {
			lastPortfolioQuery = key;
			void untrack(() => loadPortfolioPage(0));
		}, 200);
		return () => clearTimeout(timer);
	});
	let catalogData = $state<CoffeeCatalog[]>([]);
	let canManagePortfolioRows = $derived(
		canManagePortfolio(data.auth?.role || 'viewer', data.auth?.ppiAccess === true)
	);
	let isSharedPortfolioView = $derived(Boolean(page.url.searchParams.get('share')));
	let canAddPortfolioCoffee = $derived(canManagePortfolioRows && !isSharedPortfolioView);
	let error = $state<string | null>(null);
	let deleteError = $state<string | null>(null);
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

	$effect(() => () => {
		portfolioRequest += 1;
	});

	// The server begins this read before hydration; refreshes remain explicit.
	$effect(() => {
		const purchases = data.purchases;
		portfolioRequest += 1;
		let cancelled = false;
		isLoading = true;
		error = null;
		void Promise.resolve(purchases)
			.then((result) => {
				if (cancelled) return;
				if (!result) return refreshData();
				clientData = result.data as PageData['data'];
				error = result.error;
				filterStore.initializeForRoute('/beans', clientData, {
					portfolioServerSide: Boolean(result.portfolio)
				});
				lastPortfolioQuery = untrack(currentPortfolioQuery);
				if (result.portfolio && result.pagination)
					applyPortfolioPage({
						data: result.data as Record<string, unknown>[],
						portfolio: result.portfolio,
						pagination: result.pagination
					});
				else {
					portfolioContext = null;
					portfolioPagination = null;
				}
				isLoading = false;
			})
			.catch(() => {
				if (cancelled) return;
				error = 'Unable to load your coffee portfolio. Please try again.';
				isLoading = false;
			});
		return () => {
			cancelled = true;
		};
	});

	async function loadWatchlist() {
		if (watchlistLoading || watchlistLoaded) return;
		const epoch = watchlistEpoch;
		watchlistLoading = true;
		watchlistError = null;
		try {
			const response = await fetch('/api/beans/watchlist');
			if (!response.ok) throw new Error('Unable to load bookmarked lots.');
			const result = await response.json();
			if (epoch !== watchlistEpoch) return;
			trackedLotsList = result.trackedLots;
			trackedCatalog = result.trackedCatalog;
			watchlistLoaded = true;
		} catch {
			if (epoch !== watchlistEpoch) return;
			watchlistError = 'Unable to load bookmarked lots. Please try again.';
		} finally {
			if (epoch === watchlistEpoch) watchlistLoading = false;
		}
	}

	$effect(() => {
		const owner = data.auth?.user?.id;
		void owner;
		if (portfolioTab === 'bookmarked' && canUseWatchlist) {
			// Do not subscribe to the loader's state writes.
			untrack(() => {
				void loadWatchlist();
			});
		}
	});

	// State for form and bean selection
	let isFormVisible = $derived(page.url.searchParams.get('modal') === 'new');

	$effect(() => {
		const shareToken = page.url.searchParams.get('share');
		if (!isFormVisible || shareToken || catalogData.length > 0 || catalogLoadPromise) {
			return;
		}

		loadCatalogData().catch((err) => {
			console.error('Error fetching catalog data:', err);
		});
	});

	// Function to refresh data using client-side API call
	async function refreshData() {
		if (!isSharedPortfolioView) {
			await loadPortfolioPage(portfolioPagination?.offset ?? 0);
			return;
		}
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
		deleteError = null;
		try {
			const result = await deletePortfolioBean(fetch, id, refreshData);
			if (!result.ok) {
				deleteError = result.message || 'Failed to delete this coffee.';
			}
		} catch (error) {
			console.error('Error deleting bean:', error);
			deleteError = 'Inventory deletion is temporarily unavailable. Try again shortly.';
		} finally {
			isSaving = null;
		}
	}

	// Function to handle editing

	async function handleFormSubmit(_formData: CoffeeFormData[]) {
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
		if (!isLoading && (portfolioContext?.ownerTotal ?? clientData.length) > 0) {
			const searchState = page.state as Record<string, unknown>;

			// Check if we should show a bean based on the search state
			if (searchState?.searchType === 'green' && searchState?.searchId) {
				const foundBean = clientData.find((bean) => bean.id === searchState.searchId);
				if (foundBean) {
					const element = document.getElementById(`portfolio-coffee-${foundBean.id}`);
					element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}
		}
	});

	function handleAddNewBean() {
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
			(bean as InventoryWithCatalog & { roasted_oz_in?: number }).roasted_oz_in ??
			bean.roast_profiles?.reduce((ozSum, profile) => ozSum + (Number(profile.oz_in) || 0), 0) ??
			0;
		return (purchasedOz - roastedOz) / 16;
	}

	const formatCurrency = (value: number) =>
		`$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

	function getPurchaseCostPerLb(bean: InventoryWithCatalog): number | null {
		const totalCost = (Number(bean.bean_cost) || 0) + (Number(bean.tax_ship_cost) || 0);
		const purchasedLbs = Number(bean.purchased_qty_lbs) || 0;
		if (totalCost <= 0 || purchasedLbs <= 0) return null;
		return totalCost / purchasedLbs;
	}

	function portfolioCoffee(bean: InventoryWithCatalog): CoffeeCatalog {
		const purchaseCostPerLb = getPurchaseCostPerLb(bean);
		const purchasePriceTiers = purchaseCostPerLb
			? [{ min_lbs: 1, price: purchaseCostPerLb }]
			: undefined;
		if (bean.coffee_catalog) {
			return {
				...bean.coffee_catalog,
				cost_lb: purchaseCostPerLb ?? bean.coffee_catalog.cost_lb,
				price_per_lb: purchaseCostPerLb ?? bean.coffee_catalog.price_per_lb,
				price_tiers: purchasePriceTiers ?? bean.coffee_catalog.price_tiers,
				stocked: bean.stocked,
				stocked_date: null,
				arrival_date: null,
				unstocked_date: null
			};
		}
		return {
			id: bean.catalog_id ?? bean.id,
			name: 'Unknown coffee',
			source: 'Portfolio',
			cost_lb: purchaseCostPerLb,
			price_per_lb: purchaseCostPerLb,
			price_tiers: purchasePriceTiers ?? null,
			stocked: bean.stocked
		} as unknown as CoffeeCatalog;
	}

	function portfolioAnnotation(bean: InventoryWithCatalog): string {
		const notes: string[] = [];
		if (bean.purchased_qty_lbs) notes.push(`${bean.purchased_qty_lbs.toFixed(1)} lb purchased`);
		const remainingLbs = getRemainingLbs(bean);
		if (remainingLbs >= 0) notes.push(`${remainingLbs.toFixed(1)} lb remaining`);
		if (bean.rank != null) notes.push(`Rated ${bean.rank}`);
		if (bean.cupping_notes) notes.push('Cupped');
		return notes.join(' · ');
	}

	let portfolioSummary = $derived.by(() => {
		if (portfolioContext) return portfolioContext.summary;
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

{#if isLoading && portfolioTab === 'purchased'}
	<BeansPageSkeleton />
{:else if error && portfolioTab === 'purchased'}
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
			primaryLabel={canAddPortfolioCoffee ? 'Add coffee' : ''}
			primaryHref={canAddPortfolioCoffee ? '/beans?modal=new' : ''}
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
					Bookmarked{watchlistLoaded ? ` (${trackedLotsList.length})` : ''}
				</button>
			</div>
		{/if}

		{#if canUseWatchlist && portfolioTab === 'bookmarked'}
			<!-- Bookmarked (watchlist) lots -->
			{#if !watchlistLoaded && !watchlistError}
				<p role="status" class="text-sm text-muted">Loading bookmarked lots…</p>
			{:else if watchlistError}
				<p role="alert" class="text-sm text-danger">{watchlistError}</p>
				<button class="text-sm font-medium text-accent" onclick={loadWatchlist}>Try again</button>
			{:else if trackedLotsList.length === 0}
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
			{#if typedFilteredData && typedFilteredData.length > 0}
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
						{#each Object.entries(portfolioContext?.sources ?? typedFilteredData.reduce((acc, bean) => {
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
								<h4 class="text-base font-semibold text-ink">
									{formatSourceName(source) || 'Unknown'}
								</h4>
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

			<!-- Form Modal -->
			<FormShell visible={isFormVisible}>
				<BeanForm
					bean={null}
					onClose={hideForm}
					onSubmit={handleFormSubmit}
					catalogBeans={catalogData}
					ownerId={data.auth?.user?.id ?? null}
				/>
			</FormShell>

			<!-- Quick Actions -->
			{#if deleteError}
				<div
					class="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
					role="alert"
				>
					{deleteError}
				</div>
			{/if}

			{#if typedFilteredData && typedFilteredData.length > 0}
				<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
					<div class="text-sm text-muted">
						Showing {typedFilteredData.length} of {portfolioPagination?.total ?? clientData.length} selected
						coffees
					</div>
				</div>
			{/if}

			{#if portfolioPagination}
				<div class="flex items-center gap-4" aria-label="Portfolio pagination">
					<button
						class="text-sm font-medium text-accent disabled:opacity-40"
						disabled={portfolioRefetching || portfolioPagination.offset === 0}
						onclick={() => loadPortfolioPage(Math.max(0, portfolioPagination!.offset - 50))}
						>Previous</button
					>
					<span class="text-sm text-muted"
						>Page {Math.floor(portfolioPagination.offset / 50) + 1} of {Math.max(
							1,
							Math.ceil(portfolioPagination.total / 50)
						)}</span
					>
					<button
						class="text-sm font-medium text-accent disabled:opacity-40"
						disabled={portfolioRefetching || !portfolioPagination.hasNext}
						onclick={() => loadPortfolioPage(portfolioPagination!.offset + 50)}>Next</button
					>
					{#if portfolioRefetching}<span role="status" class="text-sm text-muted">Updating…</span
						>{/if}
				</div>
			{/if}
			{#if portfolioPageError}<p role="alert" class="text-sm text-danger">{portfolioPageError}</p>
				<button
					class="text-sm text-accent"
					onclick={() => loadPortfolioPage(portfolioPagination?.offset ?? 0)}>Try again</button
				>{/if}
			<!-- Coffee Cards; the loading branch above owns the skeleton state. -->
			<div class="flex-1">
				{#if !typedFilteredData || typedFilteredData.length === 0}
					<div class="rounded-lg bg-surface-panel p-8 text-center ring-1 ring-line">
						<div class="mb-4 text-6xl opacity-50">☕</div>
						<h3 class="mb-2 text-lg font-semibold text-ink">
							{(portfolioContext?.ownerTotal ?? clientData.length) > 0
								? 'No Coffees Match Your Filters'
								: 'No Coffee Beans Yet'}
						</h3>
						<p class="mb-4 text-muted">
							{(portfolioContext?.ownerTotal ?? clientData.length) > 0
								? 'Try adjusting your filters to see more coffees, or add a new coffee to your inventory.'
								: 'Start building your coffee inventory by adding your first green coffee bean.'}
						</p>
						<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
							<button
								onclick={() => handleAddNewBean()}
								class="rounded-md bg-accent px-4 py-2 font-medium text-ink transition-all duration-200 hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
							>
								{(portfolioContext?.ownerTotal ?? clientData.length) > 0
									? 'Add New Coffee'
									: 'Add Your First Bean'}
							</button>
							{#if (portfolioContext?.ownerTotal ?? clientData.length) > 0}
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
						{#each typedFilteredData as bean (bean.id)}
							{@const coffee = portfolioCoffee(bean)}
							<div id="portfolio-coffee-{bean.id}">
								<CoffeeCard
									{coffee}
									{parseTastingNotes}
									annotation={portfolioAnnotation(bean)}
									showCatalogLink={bean.coffee_catalog?.public_coffee === true}
								>
									{#snippet detailContent()}
										{@const DetailComponent = portfolioContext
											? PortfolioBeanDetail
											: BeanProfileTabs}
										<DetailComponent
											selectedBean={bean}
											role={data.auth?.role || 'viewer'}
											canManagePortfolio={canManagePortfolioRows}
											embedded={true}
											onUpdate={(updatedBean: InventoryWithCatalog) => {
												if (portfolioContext) {
													void refreshData();
													return;
												}
												clientData = clientData.map((portfolioBean) =>
													portfolioBean.id === updatedBean.id
														? (updatedBean as (typeof clientData)[0])
														: portfolioBean
												);
												filterStore.initializeForRoute(page.url.pathname, clientData);
											}}
											onDelete={async (id) => {
												await deleteBean(id);
											}}
										/>
									{/snippet}
								</CoffeeCard>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
