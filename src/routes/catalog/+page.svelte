<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { filteredData, filterStore } from '$lib/stores/filterStore';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import {
		formatProcessDisplayValue,
		isPublicProcessFacetOption
	} from '$lib/catalog/processDisplay';
	import { PROCESSING_CONFIDENCE_OPTIONS } from '$lib/catalog/urlState';
	import CatalogPageSkeleton from '$lib/components/CatalogPageSkeleton.svelte';
	import {
		summarizeSourcingBriefMatches,
		type MatchableSourcingLot
	} from '$lib/procurement/sourcingBriefMatching';

	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import { pageChatContext } from '$lib/stores/pageContextStore.svelte';
	import { getLotPriceContext } from '$lib/catalog/priceContext';
	import type { OriginPriceStats, LotPriceContext } from '$lib/catalog/priceContext';
	import { getDisplayPrice } from '$lib/utils/pricing';

	let { data } = $props<{ data: PageData }>();

	let { session, role = 'viewer', ppiAccess = false } = $derived(data);

	let trackedIds = $state<Set<number>>(new Set());

	$effect(() => {
		trackedIds = new Set(data.trackedLotIds ?? []);
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

	import type { UserRole } from '$lib/types/auth.types';
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

	$effect(() => {
		const currentRoute = page.url.pathname;

		if (
			!trackedOnlyView &&
			data?.data &&
			(!$filterStore.initialized || $filterStore.routeId !== currentRoute)
		) {
			filterStore.initializeForRoute(currentRoute, data.data, {
				catalogUrlState: data.initialCatalogState,
				pagination: data.pagination,
				serverData: data.data
			});
		}
	});

	let hydratedCatalogState = $derived(
		!trackedOnlyView && $filterStore.initialized && $filterStore.routeId === page.url.pathname
	);

	let activePagination = $derived(hydratedCatalogState ? $filterStore.pagination : data.pagination);

	let displayData = $derived((): CoffeeCatalog[] => {
		if (trackedOnlyView) {
			return (data?.data ?? []) as unknown as CoffeeCatalog[];
		}

		if (hydratedCatalogState) {
			return $filterStore.serverData as unknown as CoffeeCatalog[];
		}

		if (data?.data) {
			return data.data as unknown as CoffeeCatalog[];
		}

		return ($filteredData as unknown as CoffeeCatalog[]).slice(0, displayLimit);
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

	function formatFilterOption(value: unknown): string {
		if (value === undefined || value === null || value === '') return '';
		return formatProcessDisplayValue(String(value));
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
	let briefMatchSummaries = $derived(
		summarizeSourcingBriefMatches(
			data.briefMatchSummaries ?? [],
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

	let serverOriginPriceStats = $derived((data.originPriceStats ?? []) as OriginPriceStats[]);
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

{#if $filterStore.isLoading}
	<CatalogPageSkeleton />
{:else}
	<div class="space-y-4">
		<div class="rounded-lg border border-border-light bg-background-secondary-light px-5 py-4">
			<div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
				<div class="max-w-3xl">
					<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
						Supply evidence layer
					</p>
					<h1 class="mt-1 text-2xl font-bold text-text-primary-light sm:text-3xl">
						Green Coffee Catalog
					</h1>
					<p class="mt-2 text-sm leading-relaxed text-text-secondary-light sm:text-base">
						Inspect the row-level supply substrate behind Parchment Market Index reads: stocked
						coffees, supplier coverage, origin and process signals, and pricing evidence that turn
						market movement into named lots to investigate.
					</p>
					<div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
						<div
							class="rounded-md border border-border-light bg-background-primary-light px-3 py-2"
						>
							<p class="text-lg font-semibold text-text-primary-light">
								{catalogResultCount.toLocaleString()}
							</p>
							<p class="text-xs text-text-secondary-light">Active rows in this query</p>
						</div>
						<div
							class="rounded-md border border-border-light bg-background-primary-light px-3 py-2"
						>
							<p class="text-lg font-semibold text-text-primary-light">{visibleOriginCount}</p>
							<p class="text-xs text-text-secondary-light">Origins shown on this page</p>
						</div>
						<div
							class="rounded-md border border-border-light bg-background-primary-light px-3 py-2"
						>
							<p class="text-lg font-semibold text-text-primary-light">{visibleSupplierCount}</p>
							<p class="text-xs text-text-secondary-light">Suppliers shown on this page</p>
						</div>
						<div
							class="rounded-md border border-border-light bg-background-primary-light px-3 py-2"
						>
							<p class="text-lg font-semibold text-text-primary-light">{visiblePricedCount}</p>
							<p class="text-xs text-text-secondary-light">Priced rows shown</p>
						</div>
					</div>
					{#if canUseSourcingIntelligence && trackedIds.size > 0}
						<p class="mt-2 text-xs text-text-secondary-light">
							<span class="font-semibold text-background-tertiary-light">{trackedIds.size}</span>
							{trackedIds.size === 1 ? 'lot' : 'lots'} tracked ·
							{trackedCountOnPage} on this page ·
							{#if trackedOnlyView}
								<a
									href="/catalog"
									class="font-semibold text-background-tertiary-light hover:text-text-primary-light"
								>
									Show full catalog
								</a>
							{:else}
								<a
									href="/catalog?tracked=only"
									class="font-semibold text-background-tertiary-light hover:text-text-primary-light"
								>
									View all tracked
								</a>
							{/if}
						</p>
					{/if}
				</div>
				<div
					class="w-full rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-4 lg:max-w-sm"
				>
					<p class="text-sm font-semibold text-text-primary-light">
						Trace catalog evidence into market intelligence
					</p>
					<p class="mt-1 text-sm text-text-secondary-light">
						Use the index for aggregate price and coverage reads, then return here for the named
						coffees and suppliers behind the signal.
					</p>
					<div class="mt-3 flex flex-col gap-2 sm:flex-row lg:flex-col">
						<a
							href="/analytics"
							class="rounded-md bg-background-tertiary-light px-3 py-2 text-center text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Open Parchment Market Index
						</a>
						<a
							href={supplierComparisonHref}
							class="rounded-md border border-background-tertiary-light px-3 py-2 text-center text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							{supplierComparisonLabel}
						</a>
					</div>
					<div class="mt-3 border-t border-border-light pt-3">
						<button
							onclick={copyFilteredCatalogLink}
							class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm font-medium text-text-primary-light shadow-sm transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
						>
							{copyLinkStatus === 'copied'
								? 'Copied filtered link'
								: copyLinkStatus === 'error'
									? 'Copy failed'
									: 'Copy filtered link'}
						</button>
						<p class="mt-1 text-xs text-text-secondary-light">
							Share the current catalog filters, sort, and page with one link.
						</p>
					</div>
				</div>
			</div>
		</div>
		{#if !session}
			<div
				class="flex flex-wrap items-center gap-2 rounded-lg border border-border-light bg-background-secondary-light px-4 py-3"
			>
				<select
					value={Array.isArray($filterStore.filters.country)
						? ($filterStore.filters.country[0] ?? '')
						: ($filterStore.filters.country ?? '')}
					onchange={(e) => {
						const val = e.currentTarget.value;
						filterStore.setFilter('country', val ? [val] : []);
					}}
					class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
				>
					<option value="">Origin</option>
					{#each $filterStore.uniqueValues.countries ?? [] as country}
						<option value={country}>{country}</option>
					{/each}
				</select>

				<select
					value={$filterStore.filters.processing ?? ''}
					onchange={(e) => filterStore.setFilter('processing', e.currentTarget.value)}
					class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
				>
					<option value="">Process</option>
					{#each $filterStore.uniqueValues.processing ?? [] as process}
						<option value={process}>{process}</option>
					{/each}
				</select>

				<input
					type="search"
					value={$filterStore.filters.name ?? ''}
					oninput={(e) => filterStore.setFilter('name', e.currentTarget.value)}
					placeholder="Search coffees..."
					class="min-w-[160px] flex-1 rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
				/>

				{#if hasInlineFilters}
					<button
						onclick={filterStore.clearFilters}
						class="rounded-md border border-border-light px-3 py-1.5 text-sm text-text-secondary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
					>
						Clear
					</button>
				{/if}
			</div>
		{/if}

		{#if data.catalogSchemaUnavailable}
			<div class="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
				<h2 class="text-sm font-semibold">Catalog filters are temporarily unavailable</h2>
				<p class="mt-1 text-sm">
					{data.catalogSchemaUnavailable.message}
				</p>
			</div>
		{/if}

		{#if data.catalogAccess?.canUseProcessFacets}
			<div class="rounded-lg border border-border-light bg-background-secondary-light px-4 py-3">
				<details open={hasAdvancedProcessFilters} class="group">
					<summary
						class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-text-primary-light"
					>
						<span>Advanced process transparency</span>
						<span class="text-xs font-normal text-text-secondary-light">
							Filter by disclosed method, fermentation, additives, and confidence
						</span>
					</summary>
					<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
						<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
							Base method
							<select
								value={$filterStore.filters.processing_base_method?.toString() ?? ''}
								onchange={(e) =>
									filterStore.setFilter('processing_base_method', e.currentTarget.value)}
								class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
							>
								<option value="">Any method</option>
								{#each ($filterStore.uniqueValues.processing_base_method ?? []).filter(isPublicProcessFacetOption) as method}
									<option value={String(method)}>{formatFilterOption(method)}</option>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
							Fermentation
							<select
								value={$filterStore.filters.fermentation_type?.toString() ?? ''}
								onchange={(e) => filterStore.setFilter('fermentation_type', e.currentTarget.value)}
								class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
							>
								<option value="">Any fermentation</option>
								{#each ($filterStore.uniqueValues.fermentation_type ?? []).filter(isPublicProcessFacetOption) as fermentationType}
									<option value={String(fermentationType)}
										>{formatFilterOption(fermentationType)}</option
									>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
							Additive
							<select
								value={$filterStore.filters.process_additive?.toString() ?? ''}
								onchange={(e) => filterStore.setFilter('process_additive', e.currentTarget.value)}
								class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
							>
								<option value="">Any additive</option>
								{#each ($filterStore.uniqueValues.process_additives ?? []).filter(isPublicProcessFacetOption) as additive}
									<option value={String(additive)}>{formatFilterOption(additive)}</option>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
							Disclosure
							<select
								value={$filterStore.filters.processing_disclosure_level?.toString() ?? ''}
								onchange={(e) =>
									filterStore.setFilter('processing_disclosure_level', e.currentTarget.value)}
								class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
							>
								<option value="">Any disclosure</option>
								{#each ($filterStore.uniqueValues.processing_disclosure_level ?? []).filter(isPublicProcessFacetOption) as disclosureLevel}
									<option value={String(disclosureLevel)}
										>{formatFilterOption(disclosureLevel)}</option
									>
								{/each}
							</select>
						</label>

						<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
							Confidence
							<select
								value={$filterStore.filters.processing_confidence_min?.toString() ?? ''}
								onchange={(e) =>
									filterStore.setFilter('processing_confidence_min', e.currentTarget.value)}
								class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
							>
								<option value="">Any confidence</option>
								{#each PROCESSING_CONFIDENCE_OPTIONS as option}
									<option value={option.value.toString()}>{option.label}</option>
								{/each}
							</select>
						</label>
					</div>

					{#if hasAdvancedProcessFilters}
						<div
							class="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary-light"
						>
							<span>Structured process filters are added to the shareable catalog URL.</span>
							<button
								type="button"
								onclick={clearProcessTransparencyFilters}
								class="rounded-md border border-border-light px-3 py-1.5 text-xs font-medium text-text-secondary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
							>
								Clear process facets
							</button>
						</div>
					{/if}
				</details>
			</div>
		{:else}
			<div class="rounded-lg border border-border-light bg-background-secondary-light px-4 py-3">
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 class="text-sm font-semibold text-text-primary-light">
							Members unlock structured process filters
						</h2>
						<p class="mt-1 text-sm text-text-secondary-light">
							Coffee cards still show disclosed process facts. Member search adds process facets,
							confidence thresholds, and other sourcing leverage.
						</p>
						{#if data.catalogAccessNotice}
							<p class="mt-1 text-xs text-text-secondary-light">
								{data.catalogAccessNotice.message}
							</p>
						{/if}
					</div>
					<button
						type="button"
						onclick={() => goto('/subscription')}
						class="rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-colors hover:bg-background-tertiary-light hover:text-white"
					>
						Compare paid products
					</button>
				</div>
			</div>
		{/if}

		{#if session && !hasRequiredRole('member') && !canUseParchmentIntelligence}
			<div class="rounded-lg border border-background-tertiary-light/20 bg-accent-subtle/10 p-6">
				<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
					<div class="text-center sm:text-left">
						<h3 class="text-lg font-semibold text-text-primary-light">
							Need workflow leverage from this supply layer?
						</h3>
						<p class="text-sm text-text-secondary-light">
							Parchment Intelligence adds supplier comparison and market movement reads. Mallard
							Studio adds owned-stock and roasting context. Watchlists and saved shortlists are
							still future workflows, so this catalog only routes to evidence that exists today.
						</p>
					</div>
					<div class="flex flex-col gap-3 sm:flex-row">
						<button
							onclick={() => goto('/subscription')}
							class="rounded-md bg-background-tertiary-light px-6 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Compare paid products
						</button>
						<button
							onclick={() => goto('/analytics')}
							class="rounded-md border border-background-tertiary-light px-6 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							Open Market Index
						</button>
					</div>
				</div>
			</div>
		{/if}

		{#if trackedOnlyView}
			<div
				class="mb-4 flex flex-col gap-2 rounded-lg border border-background-tertiary-light/25 bg-accent-subtle/10 p-4 sm:flex-row sm:items-center sm:justify-between"
				aria-label="Tracked lots filter"
			>
				<p class="text-sm text-text-primary-light">
					<span class="font-semibold">Watchlist view:</span>
					showing only your {displayData().length} tracked
					{displayData().length === 1 ? 'lot' : 'lots'}, including delisted ones.
				</p>
				<button
					onclick={() => goto('/catalog')}
					class="rounded-md border border-background-tertiary-light px-4 py-1.5 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
				>
					Show full catalog
				</button>
			</div>
		{/if}

		{#if hasBriefMatches}
			<div
				class="rounded-lg border border-background-tertiary-light/30 bg-background-secondary-light px-4 py-3"
				aria-label="Sourcing brief matches"
			>
				<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
					Active sourcing briefs
				</p>
				<div class="mt-2 flex flex-col gap-2">
					{#each briefMatchSummaries as summary}
						<div class="flex items-center justify-between gap-3 text-sm">
							<span class="font-medium text-text-primary-light">{summary.briefName}</span>
							<span class="shrink-0 text-xs text-text-secondary-light">
								<span class="font-semibold text-background-tertiary-light"
									>{summary.matchCount}</span
								>
								{summary.matchCount === 1 ? 'lot matches' : 'lots match'} criteria on this page
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="space-y-4">
			<div class="flex-1">
				{#if $filterStore.isLoading}
					<div class="flex justify-center p-8">
						<div
							class="h-8 w-8 animate-spin rounded-full border-4 border-background-primary-dark border-t-background-tertiary-light"
						></div>
					</div>
				{:else if !displayData() || displayData().length === 0}
					<div
						class="rounded-lg border border-border-light bg-background-secondary-light p-6 text-center"
					>
						<h2 class="text-lg font-semibold text-text-primary-light">
							No catalog rows match this supply query
						</h2>
						<p class="mx-auto mt-2 max-w-2xl text-sm text-text-secondary-light">
							Clear or broaden the filters to inspect named coffees, or use the Parchment Market
							Index to review broader origin, supplier, and pricing evidence before returning to
							row-level catalog inspection.
						</p>
						<div class="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
							<button
								onclick={filterStore.clearFilters}
								class="rounded-md border border-border-light px-4 py-2 text-sm font-medium text-text-primary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
							>
								Clear catalog filters
							</button>
							<a
								href="/analytics"
								class="rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
							>
								Review broader Market Index
							</a>
						</div>
					</div>
				{:else}
					{#if activeOriginStats()}
						{@const stats = activeOriginStats()!}
						<div
							class="rounded-lg border border-border-light bg-background-secondary-light px-4 py-3"
							aria-label="Origin price context"
						>
							<p
								class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light"
							>
								{stats.origin} supply context
							</p>
							<div class="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
								<span class="text-text-secondary-light">
									Median
									<span class="font-semibold text-text-primary-light"
										>${stats.median.toFixed(2)}/lb</span
									>
								</span>
								<span class="text-text-secondary-light">
									Range
									<span class="font-medium text-text-primary-light"
										>${stats.min.toFixed(2)} – ${stats.max.toFixed(2)}</span
									>
								</span>
								<span class="text-text-secondary-light">
									<span class="font-medium text-text-primary-light">{stats.supplier_count}</span>
									{stats.supplier_count === 1 ? 'supplier' : 'suppliers'}
								</span>
								<span class="text-text-secondary-light">
									<span class="font-medium text-text-primary-light">{stats.sample_size}</span> priced
									lots across all suppliers
								</span>
							</div>
						</div>
					{/if}
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
						{#each session ? displayData() : displayData().slice(0, 15) as coffee}
							<CoffeeCard
								{coffee}
								{parseTastingNotes}
								showSimilarComparisonAction={true}
								{canUseBeanMatching}
								priceContext={getCardPriceContext(coffee)}
								tracked={trackedIds.has((coffee as unknown as { id: number }).id)}
								onToggleTrack={canUseSourcingIntelligence ? handleToggleTrack : undefined}
							/>
						{/each}

						{#if isLoadingMore}
							<div class="flex justify-center p-4">
								<div
									class="h-8 w-8 animate-spin rounded-full border-4 border-background-primary-dark border-t-background-tertiary-light"
								></div>
							</div>
						{/if}

						{#if !session && (activePagination.total > 15 || displayData().length >= 15)}
							<div class="col-span-full mt-2">
								<div
									class="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 px-8 py-10 text-center shadow-sm ring-1 ring-amber-200"
								>
									<p class="mb-1 text-sm font-medium text-amber-700">
										You're viewing 15 of {activePagination.total || displayData().length} specialty coffees
									</p>
									<h3 class="mb-2 text-xl font-semibold text-text-primary-light">
										Keep going with a free account
									</h3>
									<p class="mb-6 text-sm text-text-secondary-light">
										Create a free account to browse the full catalog, inspect more supply evidence,
										and continue from public market discovery.
									</p>
									<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
										<button
											onclick={() => goto('/auth')}
											class="rounded-md bg-background-tertiary-light px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-opacity-90"
										>
											Create free account
										</button>
										<button
											onclick={() => goto('/subscription')}
											class="rounded-md border border-background-tertiary-light px-6 py-2.5 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
										>
											See products
										</button>
									</div>
								</div>
							</div>
						{/if}

						{#if session && activePagination.totalPages > 1}
							<div class="col-span-full flex items-center justify-center gap-4 p-4">
								<button
									onclick={() => filterStore.loadPrevPage()}
									disabled={!activePagination.hasPrev || $filterStore.isLoading}
									class="rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
								>
									Previous
								</button>

								<span class="text-sm text-text-secondary-light">
									Page {activePagination.page} of {activePagination.totalPages}
									({activePagination.total} total items)
								</span>

								<button
									onclick={() => filterStore.loadNextPage()}
									disabled={!activePagination.hasNext || $filterStore.isLoading}
									class="rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
								>
									Next
								</button>
							</div>
						{/if}

						{#if session && !$filterStore.pagination.totalPages && !isLoadingMore && displayLimit < $filteredData.length}
							<div class="flex justify-center p-4">
								<p class="text-sm text-text-primary-light">Scroll for more coffees...</p>
							</div>
						{/if}

						{#if session && !$filterStore.pagination.totalPages && displayLimit >= $filteredData.length && $filteredData.length > 0}
							<div class="flex justify-center p-4">
								<p class="text-sm text-text-primary-light">No more coffees to load</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
