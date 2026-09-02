<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CatalogMapResponse } from '@purveyors/sdk';
	import type { CoffeeCatalog } from '$lib/types/component.types';
	import { getDisplayPrice } from '$lib/utils/pricing';
	import CatalogMapCanvas, {
		type CatalogMapClusterSelection,
		type CatalogMapViewportChange
	} from '$lib/components/catalog/CatalogMapCanvas.svelte';
	import {
		buildCatalogMapRequestParams,
		type CatalogMapBounds,
		type CatalogMapUrlState
	} from '$lib/catalog/mapState';
	import type { CatalogUrlState } from '$lib/catalog/urlState';
	import {
		ELEVATION_BANDS,
		formatElevationRange,
		formatElevationValue,
		formatGeographicPrecision,
		isCatalogMapCluster,
		isCatalogMapLocation,
		isCatalogMapPlace,
		type CatalogMapDisplayItem,
		type CatalogMapPlace
	} from '$lib/catalog/mapPresentation';

	type CatalogMapUiResponse = Omit<CatalogMapResponse, 'data'> & {
		data: CatalogMapDisplayItem[];
	};

	const SELECTED_COFFEE_PAGE_SIZE = 25;

	interface ElevationRangeInput {
		min: string | number;
		max: string | number;
	}

	interface Props {
		initialState: CatalogMapUrlState;
		catalogState: CatalogUrlState;
		elevationRange?: ElevationRangeInput | null;
		canUseAdvancedMaps: boolean;
		resultsRail: Snippet;
		onStateChange: (state: CatalogMapUrlState) => void;
		onElevationRangeChange: (range: ElevationRangeInput | null) => void;
		onSelectCoffee: (catalogId: number) => Promise<boolean>;
		onSwitchToList: () => void;
	}

	let {
		initialState,
		catalogState,
		elevationRange = null,
		canUseAdvancedMaps,
		resultsRail,
		onStateChange,
		onElevationRangeChange,
		onSelectCoffee,
		onSwitchToList
	}: Props = $props();

	let currentState = $state<CatalogMapUrlState>({
		view: 'map',
		lens: 'catalog',
		units: 'masl',
		center: [0, 18],
		zoom: 1.75,
		bbox: null,
		placeId: null
	});
	let committedState = $state<CatalogMapUrlState>({
		view: 'map',
		lens: 'catalog',
		units: 'masl',
		center: [0, 18],
		zoom: 1.75,
		bbox: null,
		placeId: null
	});
	let pendingBounds = $state<CatalogMapBounds | null>(null);
	let mapResponse = $state<CatalogMapUiResponse | null>(null);
	let mapLoading = $state(true);
	let mapRequestError = $state<string | null>(null);
	let rendererError = $state<string | null>(null);
	let selectionError = $state<string | null>(null);
	let sheetOpen = $state(false);
	let sheetPointerStart: number | null = null;
	let suppressSheetClick = false;
	let elevationMinInput = $state('');
	let elevationMaxInput = $state('');
	let elevationInputError = $state<string | null>(null);
	let clusterSelection = $state<CatalogMapClusterSelection | null>(null);
	let selectionQuery = $state('');
	let selectedCoffees = $state<CoffeeCatalog[]>([]);
	let selectedCoffeeOffset = $state(0);
	let selectedCoffeeLoading = $state(false);
	let selectedCoffeeError = $state<string | null>(null);
	let selectionRequestVersion = 0;
	let locationListOpen = $state(false);
	let locationListLimit = $state(48);
	let lastIncomingStateKey = '';
	let lastPublishedStateKey = '';

	let requestQuery = $derived(
		buildCatalogMapRequestParams(catalogState, committedState).toString()
	);
	let items = $derived((mapResponse?.data ?? []) as CatalogMapDisplayItem[]);
	let clusters = $derived(items.filter(isCatalogMapCluster));
	let locations = $derived(items.filter(isCatalogMapLocation));
	let places = $derived(items.filter(isCatalogMapPlace));
	let visibleClusters = $derived(clusters.slice(0, locationListLimit));
	let visibleLocations = $derived(
		locations.slice(0, Math.max(0, locationListLimit - visibleClusters.length))
	);
	let visiblePlaces = $derived(
		places.slice(
			0,
			Math.max(0, locationListLimit - visibleClusters.length - visibleLocations.length)
		)
	);
	let totals = $derived(mapResponse?.meta.totals ?? null);
	let access = $derived(mapResponse?.meta.access ?? null);
	let profile = $derived(mapResponse?.elevation_profile ?? null);
	let canSearchViewport = $derived(access?.viewportSearch ?? canUseAdvancedMaps);
	let canUseElevation = $derived(access?.elevationProfile ?? canUseAdvancedMaps);
	let canExplorePlaces = $derived(access?.fineGrainedPlaces ?? canUseAdvancedMaps);
	let hasMoreSelectedCoffees = $derived(
		clusterSelection !== null && selectedCoffeeOffset < clusterSelection.catalogIds.length
	);

	function stateKey(state: CatalogMapUrlState): string {
		return JSON.stringify(state);
	}

	function publishState(next: CatalogMapUrlState, commit = false) {
		currentState = next;
		if (commit) committedState = next;
		lastPublishedStateKey = stateKey(next);
		onStateChange(next);
	}

	$effect(() => {
		const incomingKey = stateKey(initialState);
		if (incomingKey === lastIncomingStateKey) return;
		lastIncomingStateKey = incomingKey;
		// The parent mirrors every map change into the URL and immediately passes
		// that state back. Do not reinterpret our own non-committed pan/zoom as an
		// external navigation: doing so clears pendingBounds and turns viewport
		// exploration into implicit API work. A genuinely different incoming URL
		// still replaces the internal state below.
		if (incomingKey === lastPublishedStateKey) {
			lastPublishedStateKey = '';
			return;
		}
		currentState = { ...initialState };
		committedState = { ...initialState };
		pendingBounds = null;
	});

	$effect(() => {
		elevationMinInput = String(elevationRange?.min ?? '');
		elevationMaxInput = String(elevationRange?.max ?? '');
	});

	$effect(() => {
		const query = requestQuery;
		if (clusterSelection && selectionQuery && selectionQuery !== query) {
			clearMapSelection();
		}
		const controller = new AbortController();
		const timeout = setTimeout(() => {
			mapLoading = true;
			mapRequestError = null;
			mapResponse = null;
			void fetch(`/api/catalog/map?${query}`, { signal: controller.signal })
				.then(async (response) => {
					const body = (await response.json()) as CatalogMapUiResponse & {
						error?: { message?: string } | string;
						message?: string;
					};
					if (!response.ok) {
						const message =
							typeof body.error === 'object'
								? body.error?.message
								: typeof body.message === 'string'
									? body.message
									: undefined;
						throw new Error(message ?? `Map data request failed (${response.status}).`);
					}
					return body;
				})
				.then((body) => {
					if (controller.signal.aborted) return;
					mapResponse = body;
					mapLoading = false;
					const effective = body.meta.effective;
					if (effective.lens !== currentState.lens) {
						publishState({ ...currentState, lens: effective.lens }, true);
					}
				})
				.catch((error) => {
					if (controller.signal.aborted) return;
					mapResponse = null;
					mapLoading = false;
					mapRequestError = error instanceof Error ? error.message : 'Map data is unavailable.';
				});
		}, 180);

		return () => {
			clearTimeout(timeout);
			controller.abort();
		};
	});

	function handleViewportChange(viewport: CatalogMapViewportChange) {
		pendingBounds = viewport.commitSearch ? null : viewport.bounds;
		publishState(
			{
				...currentState,
				center: viewport.center,
				zoom: viewport.zoom,
				bbox: viewport.commitSearch ? viewport.bounds : currentState.bbox
			},
			viewport.commitSearch
		);
	}

	function searchPendingViewport() {
		if (!pendingBounds || !canSearchViewport) return;
		publishState({ ...currentState, bbox: pendingBounds }, true);
		pendingBounds = null;
	}

	function clearViewportSearch() {
		pendingBounds = null;
		publishState({ ...currentState, bbox: null }, true);
	}

	function setLens(lens: 'catalog' | 'elevation') {
		if (lens === 'elevation' && !canUseElevation) return;
		publishState({ ...currentState, lens }, true);
	}

	function setUnits(units: 'masl' | 'ft') {
		publishState({ ...currentState, units });
	}

	function explorePlace(place: CatalogMapPlace) {
		if (!place.place_id || !canExplorePlaces) return;
		pendingBounds = null;
		publishState({ ...currentState, bbox: null, placeId: place.place_id }, true);
	}

	function clearPlaceNavigation() {
		publishState({ ...currentState, placeId: null }, true);
	}

	async function selectCoffee(place: CatalogMapPlace) {
		selectionError = null;
		if (!(await onSelectCoffee(place.catalog_id))) {
			selectionError = "We couldn't open that coffee. Try finding it in the list.";
		}
	}

	function catalogCoffeeId(coffee: CoffeeCatalog): number {
		return coffee.id;
	}

	function clearMapSelection() {
		selectionRequestVersion += 1;
		clusterSelection = null;
		selectionQuery = '';
		selectedCoffees = [];
		selectedCoffeeOffset = 0;
		selectedCoffeeLoading = false;
		selectedCoffeeError = null;
	}

	async function loadSelectedCoffees(reset = false) {
		const selection = clusterSelection;
		if (!selection) return;
		const start = reset ? 0 : selectedCoffeeOffset;
		const ids = selection.catalogIds.slice(start, start + SELECTED_COFFEE_PAGE_SIZE);
		if (ids.length === 0) {
			if (reset) {
				selectedCoffeeError = 'This map group did not include selectable coffee records.';
			}
			return;
		}

		const requestVersion = reset ? ++selectionRequestVersion : selectionRequestVersion;
		selectedCoffeeLoading = true;
		selectedCoffeeError = null;
		try {
			const params = new URLSearchParams({
				ids: ids.join(','),
				stocked: 'all',
				showWholesale: catalogState.showWholesale ? 'true' : 'false',
				limit: String(ids.length)
			});
			if (catalogState.wholesaleOnly) params.set('wholesaleOnly', 'true');
			const response = await fetch(`/api/catalog?${params.toString()}`);
			if (!response.ok) throw new Error(`Catalog selection failed (${response.status}).`);
			const body = (await response.json()) as { data?: CoffeeCatalog[] };
			if (selectionRequestVersion !== requestVersion || clusterSelection !== selection) return;
			const rowsById = new Map(
				(body.data ?? []).map((coffee) => [catalogCoffeeId(coffee), coffee])
			);
			const orderedRows = ids.flatMap((id) => {
				const coffee = rowsById.get(id);
				return coffee ? [coffee] : [];
			});
			selectedCoffees = reset ? orderedRows : [...selectedCoffees, ...orderedRows];
			selectedCoffeeOffset = start + ids.length;
			if (reset && orderedRows.length === 0) {
				selectedCoffeeError = 'No coffees in this area are available in the current catalog view.';
			}
		} catch {
			if (selectionRequestVersion !== requestVersion || clusterSelection !== selection) return;
			selectedCoffeeError = "We couldn't load the coffees in this area. Try again.";
		} finally {
			if (selectionRequestVersion === requestVersion && clusterSelection === selection) {
				selectedCoffeeLoading = false;
			}
		}
	}

	function selectMapArea(selection: CatalogMapClusterSelection) {
		const catalogIds = [...new Set(selection.catalogIds)].sort((left, right) => left - right);
		clusterSelection = {
			...selection,
			catalogIds,
			coffeeMatchCount: catalogIds.length || selection.coffeeMatchCount
		};
		selectionQuery = requestQuery;
		selectedCoffees = [];
		selectedCoffeeOffset = 0;
		selectedCoffeeError = null;
		sheetOpen = true;
		void loadSelectedCoffees(true);
	}

	function originSummary(labels: string[]): string | null {
		if (labels.length === 0) return null;
		if (labels.length === 1) return labels[0] ?? null;
		if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
		return `${labels[0]}, ${labels[1]}, and ${labels.length - 2} more`;
	}

	function selectedCoffeeLocation(coffee: CoffeeCatalog): string {
		return [coffee.country, coffee.region].filter(Boolean).join(' · ') || 'Origin not listed';
	}

	function selectedCoffeePrice(coffee: CoffeeCatalog): string {
		const price = getDisplayPrice(coffee);
		return price === null ? 'Price unavailable' : `$${price.toFixed(2)}/lb`;
	}

	async function openSelectedCoffee(catalogId: number) {
		selectedCoffeeError = null;
		if (await onSelectCoffee(catalogId)) {
			clearMapSelection();
		} else {
			selectedCoffeeError = "We couldn't open that coffee. Try again.";
		}
	}

	function coffeeCountLabel(count: number): string {
		return `${count} coffee${count === 1 ? '' : 's'}`;
	}

	function applyElevationRange() {
		if (!canUseElevation) return;
		const min = elevationMinInput.trim();
		const max = elevationMaxInput.trim();
		const parsedMin = min === '' ? null : Number(min);
		const parsedMax = max === '' ? null : Number(max);
		if (
			(parsedMin !== null && !Number.isFinite(parsedMin)) ||
			(parsedMax !== null && !Number.isFinite(parsedMax))
		) {
			elevationInputError = 'Enter numeric elevation bounds.';
			return;
		}
		if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
			elevationInputError = 'Minimum elevation cannot exceed maximum elevation.';
			return;
		}
		elevationInputError = null;
		onElevationRangeChange(min === '' && max === '' ? null : { min, max });
	}

	function beginSheetDrag(event: PointerEvent) {
		sheetPointerStart = event.clientY;
		suppressSheetClick = false;
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
	}

	function finishSheetDrag(event: PointerEvent) {
		if (sheetPointerStart === null) return;
		const delta = event.clientY - sheetPointerStart;
		suppressSheetClick = Math.abs(delta) > 36;
		if (delta < -36) sheetOpen = true;
		if (delta > 36) sheetOpen = false;
		sheetPointerStart = null;
	}

	function bandLabel(minimum: number | null, maximumExclusive: number | null): string {
		if (minimum === null && maximumExclusive !== null) {
			return `Below ${formatElevationValue(maximumExclusive, currentState.units)}`;
		}
		if (minimum !== null && maximumExclusive === null) {
			return `${formatElevationValue(minimum, currentState.units)}+`;
		}
		if (minimum !== null && maximumExclusive !== null) {
			return `${formatElevationValue(minimum, currentState.units)}–${formatElevationValue(
				maximumExclusive - 1,
				currentState.units
			)}`;
		}
		return 'Unknown elevation';
	}
</script>

<section class="space-y-3" aria-label="Coffee origin map">
	<div
		class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface-panel px-4 py-3"
	>
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.16em] text-organic-rust">
				Explore coffee origins
			</p>
			<p class="mt-1 text-sm text-muted">
				Browse coffees by origin. Bubble numbers count mapped placements; multi-origin coffees may
				appear in more than one place.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2" aria-label="Map lens controls">
			<button
				type="button"
				class="rounded-md px-3 py-2 text-sm font-medium ring-1 transition-colors {currentState.lens ===
				'catalog'
					? 'bg-ink text-surface-canvas ring-ink'
					: 'bg-surface-raised text-ink ring-line hover:ring-accent'}"
				onclick={() => setLens('catalog')}
			>
				Catalog
			</button>
			<button
				type="button"
				disabled={!canUseElevation}
				aria-describedby={!canUseElevation ? 'elevation-access-note' : undefined}
				class="rounded-md px-3 py-2 text-sm font-medium ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-45 {currentState.lens ===
				'elevation'
					? 'bg-intelligence text-white ring-intelligence'
					: 'bg-surface-raised text-ink ring-line hover:ring-intelligence'}"
				onclick={() => setLens('elevation')}
			>
				Elevation
			</button>
			{#if currentState.lens === 'elevation'}
				<div
					class="ml-1 flex rounded-md bg-surface-raised p-1 ring-1 ring-line"
					aria-label="Elevation units"
				>
					<button
						type="button"
						class="rounded px-2 py-1 text-xs font-semibold {currentState.units === 'masl'
							? 'bg-accent text-ink'
							: 'text-muted'}"
						onclick={() => setUnits('masl')}>MASL</button
					>
					<button
						type="button"
						class="rounded px-2 py-1 text-xs font-semibold {currentState.units === 'ft'
							? 'bg-accent text-ink'
							: 'text-muted'}"
						onclick={() => setUnits('ft')}>Feet</button
					>
				</div>
			{/if}
		</div>
	</div>

	{#if !canUseElevation}
		<p id="elevation-access-note" class="text-xs text-muted">
			Unlock elevation profiles and elevation range filters with Parchment Intelligence.
			<a class="font-medium text-link underline" href="/subscription">Compare plans</a>.
		</p>
	{/if}

	{#if mapResponse?.meta.notices?.length}
		<div
			class="space-y-1 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning-strong"
		>
			{#each mapResponse.meta.notices as notice}
				<p>{notice.message}</p>
			{/each}
		</div>
	{/if}

	<div class="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Map coverage summary">
		<div class="rounded-lg border border-line bg-surface-raised p-3">
			<p class="text-xs text-muted">Catalog coffees</p>
			<p class="mt-1 text-lg font-semibold text-ink">{totals?.unique_coffee_count ?? '—'}</p>
		</div>
		<div class="rounded-lg border border-line bg-surface-raised p-3">
			<p class="text-xs text-muted">Coffees on map</p>
			<p class="mt-1 text-lg font-semibold text-ink">{totals?.placed_unique_coffee_count ?? '—'}</p>
		</div>
		<div class="rounded-lg border border-line bg-surface-raised p-3">
			<p class="text-xs text-muted">Origin not mapped</p>
			<p class="mt-1 text-lg font-semibold text-ink">
				{totals?.unplaced_unique_coffee_count ?? '—'}
			</p>
		</div>
		<div class="rounded-lg border border-line bg-surface-raised p-3">
			<p class="text-xs text-muted">Map points in view</p>
			<p class="mt-1 text-lg font-semibold text-ink">{totals?.viewport_placement_count ?? '—'}</p>
		</div>
	</div>

	{#if currentState.lens === 'elevation'}
		<div
			class="grid gap-3 rounded-lg border border-line bg-surface-panel p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
		>
			<div>
				<div class="flex flex-wrap items-center justify-between gap-2">
					<h2 class="text-sm font-semibold text-ink">Elevation profile</h2>
					{#if profile}
						<p class="text-xs text-muted">
							{profile.evidence_count} with reported elevation · {profile.unknown_count} unavailable
							· {profile.partial_bound_count}
							with a partial range
						</p>
					{/if}
				</div>
				{#if profile}
					<div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
						<span class="text-muted"
							>Median <strong class="text-ink"
								>{formatElevationValue(profile.median_masl, currentState.units)}</strong
							></span
						>
						<span class="text-muted"
							>Reported range <strong class="text-ink"
								>{formatElevationRange(
									profile.min_known_masl,
									profile.max_known_masl,
									currentState.units
								)}</strong
							></span
						>
						<span class="text-muted"
							>Complete ranges <strong class="text-ink">{profile.statistic_sample_count}</strong
							></span
						>
					</div>
					<ul class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Elevation key">
						{#each profile.bands as band, index}
							<li class="flex items-center gap-2 text-xs text-muted">
								<span
									class="h-3 w-3 shrink-0 rounded-full"
									style={`background:${ELEVATION_BANDS[index]?.color ?? '#695C4D'}`}
								></span>
								<span>{bandLabel(band.min_masl, band.max_masl_exclusive)} ({band.count})</span>
							</li>
						{/each}
						<li class="flex items-center gap-2 text-xs text-muted">
							<span class="h-3 w-3 shrink-0 rounded-full bg-muted"></span>
							<span
								>Elevation unavailable ({profile.partial_bound_count + profile.unknown_count})</span
							>
						</li>
					</ul>
				{:else if mapLoading}
					<p class="mt-2 text-sm text-muted">Loading elevation profile…</p>
				{:else}
					<p class="mt-2 text-sm text-muted">No elevation profile is available for this scope.</p>
				{/if}
			</div>
			<form
				class="flex flex-wrap items-end gap-2"
				onsubmit={(event) => {
					event.preventDefault();
					applyElevationRange();
				}}
			>
				<label class="text-xs font-medium text-muted">
					Min MASL
					<input
						class="mt-1 w-28 rounded-md border-line bg-surface-raised text-sm"
						type="number"
						bind:value={elevationMinInput}
						disabled={!canUseElevation}
					/>
				</label>
				<label class="text-xs font-medium text-muted">
					Max MASL
					<input
						class="mt-1 w-28 rounded-md border-line bg-surface-raised text-sm"
						type="number"
						bind:value={elevationMaxInput}
						disabled={!canUseElevation}
					/>
				</label>
				<button
					type="submit"
					disabled={!canUseElevation}
					class="rounded-md bg-intelligence px-3 py-2 text-sm font-medium text-white disabled:opacity-45"
					>Apply range</button
				>
				{#if elevationRange}
					<button
						type="button"
						class="rounded-md border border-line px-3 py-2 text-sm text-ink"
						onclick={() => {
							elevationMinInput = '';
							elevationMaxInput = '';
							elevationInputError = null;
							onElevationRangeChange(null);
						}}>Clear</button
					>
				{/if}
				{#if elevationInputError}<p class="w-full text-xs text-danger" role="alert">
						{elevationInputError}
					</p>{/if}
			</form>
		</div>
	{/if}

	<div
		class="relative h-[clamp(26rem,72dvh,46rem)] overflow-hidden rounded-xl border border-line bg-surface-panel lg:flex lg:h-[46rem]"
	>
		<div class="relative h-full min-w-0 flex-1">
			{#if rendererError}
				<div class="flex h-full min-h-0 items-center justify-center p-6">
					<div
						class="max-w-md rounded-lg border border-warning/30 bg-warning-subtle p-5 text-center"
					>
						<h2 class="font-semibold text-warning-strong">Map temporarily unavailable</h2>
						<p class="mt-2 text-sm text-warning-strong">
							We couldn't load the map. You can continue browsing the catalog list.
						</p>
						<button
							class="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-medium text-surface-canvas"
							onclick={onSwitchToList}>Use catalog list</button
						>
					</div>
				</div>
			{:else}
				<CatalogMapCanvas
					{items}
					lens={currentState.lens}
					center={currentState.center}
					zoom={currentState.zoom}
					onViewportChange={handleViewportChange}
					onPlaceSelect={(catalogId) => {
						clearMapSelection();
						const place = places.find((item) => item.catalog_id === catalogId);
						if (place) void selectCoffee(place);
					}}
					onClusterSelect={selectMapArea}
					onMapError={(message) => (rendererError = message)}
				/>
			{/if}

			<div class="absolute left-3 top-3 z-10 flex max-w-[calc(100%-5rem)] flex-wrap gap-2">
				{#if pendingBounds}
					<button
						type="button"
						disabled={!canSearchViewport}
						class="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-surface-canvas shadow disabled:cursor-not-allowed disabled:opacity-50"
						onclick={searchPendingViewport}
					>
						{canSearchViewport ? 'Search this area' : 'Upgrade to search this area'}
					</button>
				{/if}
				{#if currentState.bbox}
					<button
						type="button"
						class="rounded-md bg-surface-raised px-3 py-2 text-xs font-semibold text-ink shadow ring-1 ring-line"
						onclick={clearViewportSearch}>Show global map</button
					>
				{/if}
				{#if currentState.placeId}
					<button
						type="button"
						class="rounded-md bg-surface-raised px-3 py-2 text-xs font-semibold text-ink shadow ring-1 ring-line"
						onclick={clearPlaceNavigation}>Back to all origins</button
					>
				{/if}
			</div>

			{#if mapLoading}
				<div
					class="pointer-events-none absolute inset-x-0 top-16 z-10 flex justify-center"
					aria-live="polite"
				>
					<span
						class="rounded-full bg-surface-raised/95 px-3 py-1.5 text-xs font-medium text-muted shadow"
						>Updating map…</span
					>
				</div>
			{/if}
			{#if mapRequestError}
				<div
					class="absolute inset-x-3 top-16 z-10 rounded-lg border border-danger/30 bg-danger-subtle p-3 text-sm text-danger-strong"
					role="alert"
				>
					<strong>We couldn't refresh the map.</strong>
					Your catalog results are still available.
				</div>
			{/if}
		</div>

		<aside
			class="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t border-line bg-surface-canvas shadow-2xl transition-[max-height] duration-200 lg:static lg:z-auto lg:max-h-none lg:w-[27rem] lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none {sheetOpen
				? 'max-h-[72%]'
				: 'max-h-[4.5rem]'}"
			aria-label="Catalog results rail"
		>
			<button
				type="button"
				class="touch-none px-4 py-3 text-left lg:cursor-default"
				aria-expanded={sheetOpen}
				onpointerdown={beginSheetDrag}
				onpointerup={finishSheetDrag}
				onpointercancel={() => {
					sheetPointerStart = null;
					suppressSheetClick = false;
				}}
				onclick={() => {
					if (suppressSheetClick) {
						suppressSheetClick = false;
						return;
					}
					sheetOpen = !sheetOpen;
				}}
			>
				<span class="mx-auto mb-2 block h-1 w-10 rounded-full bg-line lg:hidden"></span>
				<span class="flex items-center justify-between gap-3">
					<span>
						<strong class="text-sm text-ink">{clusterSelection?.label ?? 'Catalog results'}</strong>
						<span class="ml-2 text-xs text-muted"
							>{clusterSelection?.coffeeMatchCount ?? totals?.unique_coffee_count ?? '—'} coffees</span
						>
					</span>
					<span class="text-xs font-medium text-link lg:hidden"
						>{sheetOpen ? 'Collapse' : 'Open'}</span
					>
				</span>
			</button>
			<div class="min-h-0 flex-1 overflow-y-auto border-t border-line p-3">
				{#if clusterSelection}
					{@const selectedOriginSummary = originSummary(clusterSelection.originLabels)}
					<div class="mb-3 border-b border-line pb-3">
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-xs font-semibold uppercase tracking-[0.14em] text-organic-rust">
									{clusterSelection.precisionLabel}
								</p>
								<h2 class="mt-1 font-display text-xl font-semibold text-ink">
									{clusterSelection.label}
								</h2>
							</div>
							<button
								type="button"
								class="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted hover:text-ink"
								onclick={clearMapSelection}>All results</button
							>
						</div>
						{#if selectedOriginSummary}
							<p class="mt-2 text-sm text-ink">{selectedOriginSummary}</p>
						{/if}
						<p class="mt-2 text-sm text-muted">
							{coffeeCountLabel(clusterSelection.coffeeMatchCount)} across
							{clusterSelection.mappedOriginCount.toLocaleString()} mapped placements.
						</p>
						{#if clusterSelection.kind === 'location' && /area/i.test(clusterSelection.precisionLabel)}
							<p
								class="mt-2 rounded-md bg-surface-panel px-3 py-2 text-xs leading-relaxed text-muted"
							>
								This marker represents a broad geographic center, not an exact farm location.
							</p>
						{/if}
					</div>

					{#if selectedCoffeeLoading && selectedCoffees.length === 0}
						<p class="py-4 text-sm text-muted" aria-live="polite">Loading coffees in this area…</p>
					{/if}
					{#if selectedCoffeeError}
						<div class="rounded-md border border-danger/30 bg-danger-subtle p-3" role="alert">
							<p class="text-sm text-danger-strong">{selectedCoffeeError}</p>
							<button
								type="button"
								class="mt-2 text-xs font-semibold text-link underline"
								onclick={() => void loadSelectedCoffees(selectedCoffees.length === 0)}
								>Try again</button
							>
						</div>
					{/if}
					<div class="space-y-2">
						{#each selectedCoffees as coffee (coffee.id)}
							<button
								type="button"
								class="w-full rounded-lg border border-line bg-surface-raised p-3 text-left transition-colors hover:border-accent hover:bg-surface-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								onclick={() => void openSelectedCoffee(coffee.id)}
							>
								<span class="block text-sm font-semibold leading-snug text-ink">{coffee.name}</span>
								<span class="mt-1 block text-xs font-medium text-muted"
									>{coffee.source ?? 'Supplier not listed'}</span
								>
								<span class="mt-2 block text-xs text-muted">{selectedCoffeeLocation(coffee)}</span>
								<span class="mt-2 flex flex-wrap gap-1.5">
									{#if coffee.processing}
										<span class="rounded-full bg-surface-panel px-2 py-1 text-[0.7rem] text-ink"
											>{coffee.processing}</span
										>
									{/if}
									<span
										class="rounded-full bg-accent/25 px-2 py-1 text-[0.7rem] font-semibold text-ink"
										>{selectedCoffeePrice(coffee)}</span
									>
								</span>
							</button>
						{/each}
					</div>
					{#if hasMoreSelectedCoffees}
						<button
							type="button"
							disabled={selectedCoffeeLoading}
							class="mt-3 w-full rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:border-accent disabled:opacity-50"
							onclick={() => void loadSelectedCoffees()}
							>{selectedCoffeeLoading ? 'Loading…' : 'Show more coffees'}</button
						>
					{/if}
				{:else}
					{@render resultsRail()}
				{/if}
			</div>
		</aside>
	</div>

	<details
		bind:open={locationListOpen}
		class="rounded-lg border border-line bg-surface-panel px-4 py-3"
	>
		<summary class="cursor-pointer text-sm font-semibold text-ink"
			>Browse map locations ({items.length})</summary
		>
		<p class="mt-2 text-xs text-muted">
			Zoom into grouped locations or choose an origin to open its coffee details.
		</p>
		{#if locationListOpen}
			<div class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
				{#each visibleClusters as cluster}
					<button
						type="button"
						class="rounded-md border border-line bg-surface-raised p-3 text-left hover:border-accent"
						onclick={() => {
							selectMapArea({
								kind: 'area',
								label: 'Selected map area',
								precisionLabel: 'Grouped map area',
								mappedOriginCount: cluster.placement_count,
								coffeeMatchCount: cluster.unique_coffee_count,
								catalogIds: cluster.catalog_ids,
								originLabels: []
							});
							pendingBounds = null;
							publishState({
								...currentState,
								center: [cluster.longitude, cluster.latitude],
								zoom: Math.min(11, currentState.zoom + 2)
							});
						}}
					>
						<span class="block text-sm font-semibold text-ink"
							>{coffeeCountLabel(cluster.unique_coffee_count)}</span
						>
						<span class="mt-1 block text-xs text-muted">Zoom in to explore this area</span>
					</button>
				{/each}
				{#each visibleLocations as location}
					<button
						type="button"
						class="rounded-md border border-line bg-surface-raised p-3 text-left hover:border-accent"
						onclick={() =>
							selectMapArea({
								kind: 'location',
								label: location.canonical_name,
								precisionLabel: formatGeographicPrecision(location),
								mappedOriginCount: location.placement_count,
								coffeeMatchCount: location.unique_coffee_count,
								catalogIds: location.catalog_ids,
								originLabels: [location.canonical_name]
							})}
					>
						<span class="block text-sm font-semibold text-ink">{location.canonical_name}</span>
						<span class="mt-1 block text-xs text-muted">
							{formatGeographicPrecision(location)} · {coffeeCountLabel(
								location.unique_coffee_count
							)}
						</span>
					</button>
				{/each}
				{#each visiblePlaces as place}
					<div class="rounded-md border border-line bg-surface-raised p-3">
						<button type="button" class="w-full text-left" onclick={() => void selectCoffee(place)}>
							<span class="block text-sm font-semibold text-ink">{place.canonical_name}</span>
							<span class="mt-1 block text-xs text-muted">{formatGeographicPrecision(place)}</span>
							<span class="mt-1 block text-xs text-muted">
								{formatElevationRange(
									place.elevation_min_masl,
									place.elevation_max_masl,
									currentState.units
								)}
							</span>
						</button>
						{#if place.place_id && canExplorePlaces}
							<button
								type="button"
								class="mt-2 text-xs font-semibold text-link underline"
								onclick={() => explorePlace(place)}>Explore this origin</button
							>
						{/if}
					</div>
				{/each}
			</div>
			{#if items.length > locationListLimit}
				<button
					type="button"
					class="mt-3 rounded-md border border-line bg-surface-raised px-3 py-2 text-sm font-medium text-ink hover:border-accent"
					onclick={() => (locationListLimit += 48)}>Show more locations</button
				>
			{/if}
		{/if}
		{#if selectionError}<p class="mt-3 text-sm text-danger" role="alert">{selectionError}</p>{/if}
	</details>

	<p class="text-xs text-muted">
		Coffees without a mapped origin still appear in the results list.
	</p>
</section>
