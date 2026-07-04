<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { filteredData, filterStore } from '$lib/stores/filterStore';
	import { page } from '$app/state';
	import { checkRole } from '$lib/types/auth.types';

	import CatalogPageSkeleton from '$lib/components/CatalogPageSkeleton.svelte';
	import {
		summarizeSourcingBriefMatches,
		type MatchableSourcingLot,
		type SourcingBriefMatchSummary
	} from '$lib/procurement/sourcingBriefMatching';

	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import { pageChatContext } from '$lib/stores/pageContextStore.svelte';
	import { getLotPriceContext } from '$lib/catalog/priceContext';
	import type { OriginPriceStats, LotPriceContext } from '$lib/catalog/priceContext';
	import { getDisplayPrice } from '$lib/utils/pricing';

	import PageHeaderSection from '$lib/components/catalog/sections/PageHeaderSection.svelte';
	import FilterBarSection from '$lib/components/catalog/sections/FilterBarSection.svelte';
	import ProcessFilterSection from '$lib/components/catalog/sections/ProcessFilterSection.svelte';
	import UpsellBannerSection from '$lib/components/catalog/sections/UpsellBannerSection.svelte';
	import WatchlistBannerSection from '$lib/components/catalog/sections/WatchlistBannerSection.svelte';
	import BriefMatchSection from '$lib/components/catalog/sections/BriefMatchSection.svelte';
	import ResultsGridSection from '$lib/components/catalog/sections/ResultsGridSection.svelte';

	import type { UserRole } from '$lib/types/auth.types';

	let { data } = $props<{ data: PageData }>();

	let { session, role = 'viewer', ppiAccess = false } = $derived(data);

	// Deferred enrichment (origin stats, tracked ids, brief matches, deep-link card)
	// arrives from the server load as streamed promises. Tests and any non-streamed
	// path may still pass plain arrays, so seed synchronously from an array when one
	// is present and let the effects below resolve the promise form as it streams in.
	function toInitialArray<T>(value: Promise<T[] | null> | T[] | undefined | null): T[] {
		return Array.isArray(value) ? value : [];
	}

	let trackedIds = $state<Set<number>>(new Set());
	let trackedIdsReady = $state(false);

	$effect(() => {
		const value = data.trackedLotIds;
		// Streamed form: resolve into the set when it arrives. Guard on Promise so a
		// non-streamed array seeds synchronously and a later microtask can't clobber an
		// optimistic track toggle the user made in between.
		if (value instanceof Promise) {
			let cancelled = false;
			trackedIdsReady = false;
			void value
				.then((ids) => {
					if (!cancelled && ids !== null) {
						trackedIds = new Set(ids ?? []);
						trackedIdsReady = true;
					}
				})
				.catch(() => {});
			return () => {
				cancelled = true;
			};
		}
		trackedIds = new Set(toInitialArray<number>(value));
		trackedIdsReady = value !== null;
	});

	// Deep-linked coffee streams in when it is off the current page; prepend it to
	// the visible rows once it resolves so the main grid never waits on it.
	let streamedDeepLinkCoffee = $state<CoffeeCatalog | null>(null);

	$effect(() => {
		let cancelled = false;
		void Promise.resolve(data.deepLinkCoffee)
			.then((coffee) => {
				if (!cancelled) streamedDeepLinkCoffee = (coffee ?? null) as CoffeeCatalog | null;
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});

	let deepLinkCoffee = $derived(
		streamedDeepLinkCoffee ??
			(data.deepLinkCoffee && !(data.deepLinkCoffee instanceof Promise)
				? (data.deepLinkCoffee as unknown as CoffeeCatalog)
				: null)
	);

	function setTracked(catalogId: number, tracked: boolean) {
		const next = new Set(trackedIds);
		if (tracked) next.add(catalogId);
		else next.delete(catalogId);
		trackedIds = next;
	}

	async function handleToggleTrack(catalogId: number) {
		if (!trackedIdsReady) return;

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

	let userRole: UserRole = $derived(role as UserRole);

	function hasRequiredRole(requiredRole: UserRole): boolean {
		const hasRole = checkRole(userRole, requiredRole);
		return hasRole;
	}

	let displayLimit = $state(15);
	let isLoadingMore = $state(false);
	let copyLinkStatus = $state<'idle' | 'copied' | 'error'>('idle');
	let copyLinkResetTimeout: ReturnType<typeof setTimeout> | null = null;

	// Watchlist-only view renders straight from server data and bypasses the
	// client filter store so its pagination/fetch flows can't replace the tracked set.
	let trackedOnlyView = $derived(data.trackedOnly === true);

	// /catalog?coffee=<id> deep link (e.g. from chat canvas cards): auto-open
	// that coffee's detail panel when the card is in the rendered set.
	let deepLinkCoffeeId = $derived.by(() => {
		const raw = page.url.searchParams.get('coffee');
		if (!raw || !/^\d+$/.test(raw)) return null;
		const parsed = Number.parseInt(raw, 10);
		return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
	});

	function catalogCoffeeId(coffee: unknown): number | null {
		const id = (coffee as { id?: unknown }).id;
		return typeof id === 'number' && Number.isSafeInteger(id) ? id : null;
	}

	function catalogCoffeeCardKey(coffee: CoffeeCatalog): string {
		const id = catalogCoffeeId(coffee);
		return `${id ?? 'unknown'}:${deepLinkCoffeeId === id ? 'open' : 'closed'}`;
	}

	let hydratedCatalogDataKey = $state<string | null>(null);
	let incomingCatalogDataKey = $derived.by(() =>
		JSON.stringify({
			route: page.url.pathname,
			deepLinkCoffeeId,
			rowIds: (data.data ?? []).map((coffee: unknown) => catalogCoffeeId(coffee)),
			initialCatalogState: data.initialCatalogState,
			pagination: data.pagination
		})
	);

	$effect(() => {
		const currentRoute = page.url.pathname;

		if (
			!trackedOnlyView &&
			data?.data &&
			(!$filterStore.initialized ||
				$filterStore.routeId !== currentRoute ||
				hydratedCatalogDataKey !== incomingCatalogDataKey)
		) {
			filterStore.initializeForRoute(currentRoute, data.data, {
				catalogUrlState: data.initialCatalogState,
				pagination: data.pagination,
				serverData: data.data
			});
			hydratedCatalogDataKey = incomingCatalogDataKey;
		}
	});

	let hydratedCatalogState = $derived(
		!trackedOnlyView && $filterStore.initialized && $filterStore.routeId === page.url.pathname
	);

	// Full skeleton only on the true first mount / initial-empty state. Once rows
	// have loaded once, later filter/sort/page fetches keep the existing rows
	// visible and surface a quiet refetch state instead of blanking the page.
	let showInitialSkeleton = $derived($filterStore.isLoading && !$filterStore.hasLoadedOnce);
	let isRefetching = $derived($filterStore.isRefetching);

	let activePagination = $derived(hydratedCatalogState ? $filterStore.pagination : data.pagination);

	function withDeepLinkCoffee(rows: CoffeeCatalog[]): CoffeeCatalog[] {
		const coffee = deepLinkCoffee;
		if (!coffee) return rows;
		const id = catalogCoffeeId(coffee);
		if (id === null || id !== deepLinkCoffeeId) return rows;
		if (rows.some((row) => catalogCoffeeId(row) === id)) return rows;
		return [coffee, ...rows];
	}

	let displayData = $derived((): CoffeeCatalog[] => {
		if (trackedOnlyView) {
			return withDeepLinkCoffee((data?.data ?? []) as unknown as CoffeeCatalog[]);
		}

		if (hydratedCatalogState) {
			return withDeepLinkCoffee($filterStore.serverData as unknown as CoffeeCatalog[]);
		}

		if (data?.data) {
			return withDeepLinkCoffee(data.data as unknown as CoffeeCatalog[]);
		}

		return withDeepLinkCoffee(($filteredData as unknown as CoffeeCatalog[]).slice(0, displayLimit));
	});

	const PROCESS_TRANSPARENCY_FILTER_KEYS = [
		'processing_base_method',
		'fermentation_type',
		'process_additive',
		'has_additives',
		'processing_disclosure_level',
		'processing_confidence_min'
	] as const;

	function isActiveFilterValue(value: unknown): boolean {
		if (value === undefined || value === null || value === '') return false;
		if (Array.isArray(value)) return value.length > 0;
		return true;
	}

	function clearProcessTransparencyFilters() {
		filterStore.clearFiltersByKeys([...PROCESS_TRANSPARENCY_FILTER_KEYS]);
	}

	let hasAdvancedProcessFilters = $derived(
		PROCESS_TRANSPARENCY_FILTER_KEYS.some((key) => isActiveFilterValue($filterStore.filters[key]))
	);

	// Publish what this view shows so chat can ground answers in it.
	$effect(() => {
		const items = displayData();
		const activeFilters = Object.entries($filterStore.filters)
			.filter(
				([, value]) =>
					isActiveFilterValue(value) && (typeof value !== 'object' || Array.isArray(value))
			)
			.map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`);
		const scope = trackedOnlyView
			? 'tracked lots only'
			: activeFilters.length > 0
				? `filtered by ${activeFilters.join('; ')}`
				: 'no filters applied';
		pageChatContext.set({
			surface: 'catalog',
			summary: `Green coffee catalog (${scope}) — ${items.length} coffees in view.`,
			entities: items.slice(0, 5).map((coffee) => ({
				type: 'coffee',
				id: coffee.id,
				label: [coffee.name, coffee.source].filter(Boolean).join(' — ') || `Coffee #${coffee.id}`
			}))
		});
		return () => pageChatContext.clear();
	});

	let hasInlineFilters = $derived(
		(Array.isArray($filterStore.filters.country) && $filterStore.filters.country.length > 0) ||
			Boolean($filterStore.filters.processing) ||
			Boolean($filterStore.filters.name) ||
			hasAdvancedProcessFilters
	);

	let canUseBeanMatching = $derived(data.catalogAccess?.canUseBeanMatching === true);
	let canUseParchmentIntelligence = $derived(ppiAccess === true);
	let canUseSourcingIntelligence = $derived(
		canUseParchmentIntelligence || hasRequiredRole('member')
	);
	let streamedBriefMatchSummaries = $state<SourcingBriefMatchSummary[] | null>(null);

	$effect(() => {
		let cancelled = false;
		void Promise.resolve(data.briefMatchSummaries)
			.then((summaries) => {
				if (!cancelled)
					streamedBriefMatchSummaries = (summaries ?? []) as SourcingBriefMatchSummary[];
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});

	let serverBriefMatchSummaries = $derived(
		streamedBriefMatchSummaries ??
			toInitialArray<SourcingBriefMatchSummary>(data.briefMatchSummaries)
	);

	let briefMatchSummaries = $derived(
		summarizeSourcingBriefMatches(
			serverBriefMatchSummaries,
			displayData() as unknown as MatchableSourcingLot[]
		)
	);
	let hasBriefMatches = $derived(briefMatchSummaries.length > 0);
	let trackedCountOnPage = $derived(
		displayData().filter((c) => trackedIds.has((c as unknown as { id: number }).id)).length
	);

	function countDistinctCatalogValues(rows: CoffeeCatalog[], key: 'country' | 'source'): number {
		return new Set(
			rows
				.map((row) => row[key])
				.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
		).size;
	}

	function hasCatalogPriceEvidence(row: CoffeeCatalog): boolean {
		return row.price_per_lb != null || row.cost_lb != null;
	}

	let catalogResultCount = $derived(activePagination.total || displayData().length);
	let visibleOriginCount = $derived(countDistinctCatalogValues(displayData(), 'country'));
	let visibleSupplierCount = $derived(countDistinctCatalogValues(displayData(), 'source'));
	let visiblePricedCount = $derived(displayData().filter(hasCatalogPriceEvidence).length);
	let supplierComparisonHref = $derived(
		canUseParchmentIntelligence ? '/analytics#supplier-comparison' : '/analytics'
	);
	let supplierComparisonLabel = $derived(
		canUseParchmentIntelligence
			? 'Review supplier comparison evidence'
			: 'Preview supplier comparison gate'
	);

	type OriginPriceStatsResponse = {
		originPriceStats?: OriginPriceStats[];
	};

	function getOriginStatsScopeKey(showWholesale: boolean, wholesaleOnly: boolean): string {
		return `${showWholesale ? 'wholesale-visible' : 'retail'}:${wholesaleOnly ? 'only' : 'mixed'}`;
	}

	function buildOriginStatsParams(showWholesale: boolean, wholesaleOnly: boolean): URLSearchParams {
		const params = new URLSearchParams();
		if (showWholesale) params.set('showWholesale', 'true');
		if (wholesaleOnly) params.set('wholesaleOnly', 'true');
		return params;
	}

	let streamedOriginPriceStats = $state<OriginPriceStats[] | null>(null);

	$effect(() => {
		let cancelled = false;
		streamedOriginPriceStats = null;
		void Promise.resolve(data.originPriceStats)
			.then((stats) => {
				if (!cancelled) streamedOriginPriceStats = (stats ?? []) as OriginPriceStats[];
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	});

	let serverOriginPriceStats = $derived(
		streamedOriginPriceStats ?? toInitialArray<OriginPriceStats>(data.originPriceStats)
	);

	let serverOriginStatsKey = $derived(
		getOriginStatsScopeKey(
			data.initialCatalogState.showWholesale,
			data.initialCatalogState.wholesaleOnly ?? false
		)
	);
	let originStatsCache = $state<Record<string, OriginPriceStats[]>>({});
	let originStatsAbortController: AbortController | null = null;

	$effect(() => {
		originStatsCache = { [serverOriginStatsKey]: serverOriginPriceStats };
	});

	let activeStatsShowWholesale = $derived(
		hydratedCatalogState ? $filterStore.showWholesale : data.initialCatalogState.showWholesale
	);
	let activeStatsWholesaleOnly = $derived(
		hydratedCatalogState
			? $filterStore.wholesaleOnly
			: (data.initialCatalogState.wholesaleOnly ?? false)
	);

	let activeOriginStatsKey = $derived(
		getOriginStatsScopeKey(activeStatsShowWholesale, activeStatsWholesaleOnly)
	);
	let currentOriginPriceStats = $derived(
		originStatsCache[activeOriginStatsKey] ?? serverOriginPriceStats
	);

	$effect(() => {
		const key = activeOriginStatsKey;
		if (originStatsCache[key]) return;
		if (typeof window === 'undefined') return;

		originStatsAbortController?.abort();
		const controller = new AbortController();
		originStatsAbortController = controller;
		const params = buildOriginStatsParams(activeStatsShowWholesale, activeStatsWholesaleOnly);
		const queryString = params.toString();

		void fetch(`/api/catalog/origin-price-stats${queryString ? `?${queryString}` : ''}`, {
			signal: controller.signal
		})
			.then(async (response) => {
				if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				return (await response.json()) as OriginPriceStatsResponse;
			})
			.then((result) => {
				if (controller.signal.aborted) return;
				originStatsCache = {
					...originStatsCache,
					[key]: result.originPriceStats ?? []
				};
			})
			.catch((error) => {
				if (error instanceof DOMException && error.name === 'AbortError') return;
				console.error('Error fetching origin price stats:', error);
			});

		return () => {
			controller.abort();
		};
	});

	let originPriceMap = $derived(
		new Map<string, OriginPriceStats>(
			currentOriginPriceStats.map((s) => [s.origin, s] as [string, OriginPriceStats])
		)
	);

	function getCardPriceContext(coffee: CoffeeCatalog): LotPriceContext | null {
		const price = getDisplayPrice(coffee);
		return getLotPriceContext(price, originPriceMap.get(coffee.country ?? ''));
	}

	let activeOriginStats = $derived((): OriginPriceStats | null => {
		const country = $filterStore.filters.country;
		let origin: string | null = null;
		if (Array.isArray(country) && country.length === 1) origin = country[0] as string;
		else if (typeof country === 'string' && country.length > 0) origin = country;
		if (!origin) return null;
		return (originPriceMap.get(origin) as OriginPriceStats | undefined) ?? null;
	});

	async function handleScroll() {
		if (!session) {
			return;
		}

		if (page.url.pathname.includes('/catalog') || page.url.pathname === '/') {
			return;
		}

		const scrollPosition = window.innerHeight + window.scrollY;
		const bottomOfPage = document.documentElement.offsetHeight - 200;

		if (scrollPosition >= bottomOfPage && !isLoadingMore && displayLimit < $filteredData.length) {
			isLoadingMore = true;
			await new Promise((resolve) => setTimeout(resolve, 300));
			displayLimit += 15;
			isLoadingMore = false;
		}
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll);
		return () => {
			window.removeEventListener('scroll', handleScroll);
			if (copyLinkResetTimeout) {
				clearTimeout(copyLinkResetTimeout);
			}
		};
	});

	function updateCopyLinkStatus(status: 'idle' | 'copied' | 'error') {
		copyLinkStatus = status;
		if (copyLinkResetTimeout) {
			clearTimeout(copyLinkResetTimeout);
		}
		if (status !== 'idle') {
			copyLinkResetTimeout = setTimeout(() => {
				copyLinkStatus = 'idle';
			}, 2500);
		}
	}

	async function copyFilteredCatalogLink() {
		const currentUrl = window.location.href;

		try {
			if (navigator.share) {
				await navigator.share({
					title: 'Purveyors Green Coffee Catalog',
					url: currentUrl
				});
				updateCopyLinkStatus('copied');
				return;
			}

			await navigator.clipboard.writeText(currentUrl);
			updateCopyLinkStatus('copied');
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			try {
				await navigator.clipboard.writeText(currentUrl);
				updateCopyLinkStatus('copied');
			} catch {
				updateCopyLinkStatus('error');
			}
		}
	}

	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			let parsed: Partial<TastingNotes> & Record<string, unknown>;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson as Record<string, unknown>;
			} else {
				return null;
			}

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

{#if showInitialSkeleton}
	<CatalogPageSkeleton />
{:else}
	<div class="space-y-4">
		<PageHeaderSection
			{catalogResultCount}
			{visibleOriginCount}
			{visibleSupplierCount}
			{visiblePricedCount}
			{canUseSourcingIntelligence}
			{isRefetching}
			trackedIdsSize={trackedIds.size}
			{trackedCountOnPage}
			{trackedOnlyView}
			{supplierComparisonHref}
			{supplierComparisonLabel}
			{copyLinkStatus}
			onCopyFilteredCatalogLink={copyFilteredCatalogLink}
		/>

		{#if !session}
			<FilterBarSection {hasInlineFilters} />
		{/if}

		{#if data.catalogSchemaUnavailable}
			<div class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
				<h2 class="text-sm font-semibold">Catalog filters are temporarily unavailable</h2>
				<p class="mt-1 text-sm">
					{data.catalogSchemaUnavailable.message}
				</p>
			</div>
		{/if}

		<ProcessFilterSection
			canUseProcessFacets={data.catalogAccess?.canUseProcessFacets ?? false}
			{hasAdvancedProcessFilters}
			catalogAccessNotice={data.catalogAccessNotice}
			onClearProcessTransparencyFilters={clearProcessTransparencyFilters}
		/>

		{#if session && !hasRequiredRole('member') && !canUseParchmentIntelligence}
			<UpsellBannerSection />
		{/if}

		{#if trackedOnlyView}
			<WatchlistBannerSection displayCount={displayData().length} />
		{/if}

		{#if hasBriefMatches}
			<BriefMatchSection {briefMatchSummaries} />
		{/if}

		<ResultsGridSection
			{session}
			displayData={displayData()}
			{isLoadingMore}
			{isRefetching}
			{activePagination}
			activeOriginStats={activeOriginStats()}
			{trackedIds}
			{canUseBeanMatching}
			canUseSourcingIntelligence={canUseSourcingIntelligence && trackedIdsReady}
			{deepLinkCoffeeId}
			filteredDataLength={$filteredData.length}
			{displayLimit}
			{parseTastingNotes}
			{getCardPriceContext}
			{catalogCoffeeId}
			{catalogCoffeeCardKey}
			onToggleTrack={handleToggleTrack}
		/>
	</div>
{/if}
