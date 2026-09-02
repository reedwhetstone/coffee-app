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
		formatElevationRange,
		formatGeographicPrecision,
		isCatalogMapCluster,
		isCatalogMapLocation,
		isCatalogMapPlace,
		type CatalogMapDisplayItem,
		type CatalogMapPlace
	} from '$lib/catalog/mapPresentation';
	import { TERRAIN_ELEVATION_BANDS } from '$lib/styles/mapColors';

	type CatalogMapUiResponse = Omit<CatalogMapResponse, 'data'> & {
		data: CatalogMapDisplayItem[];
	};

	const SELECTED_COFFEE_PAGE_SIZE = 25;

	interface Props {
		initialState: CatalogMapUrlState;
		catalogState: CatalogUrlState;
		canUseAdvancedMaps: boolean;
		resultsRail: Snippet;
		coffeeDetail: Snippet<[CoffeeCatalog, () => void]>;
		onStateChange: (state: CatalogMapUrlState) => void;
		onSelectCoffee: (catalogId: number) => Promise<CoffeeCatalog | null>;
		onClearCoffee: () => void;
		onSwitchToList: () => void;
	}

	let {
		initialState,
		catalogState,
		canUseAdvancedMaps,
		resultsRail,
		coffeeDetail,
		onStateChange,
		onSelectCoffee,
		onClearCoffee,
		onSwitchToList
	}: Props = $props();

	let currentState = $state<CatalogMapUrlState>({
		view: 'map',
		center: [0, 18],
		zoom: 1.75,
		bbox: null,
		placeId: null
	});
	let committedState = $state<CatalogMapUrlState>({
		view: 'map',
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
	let clusterSelection = $state<CatalogMapClusterSelection | null>(null);
	let selectionQuery = $state('');
	let selectedCoffees = $state<CoffeeCatalog[]>([]);
	let focusedCoffee = $state<CoffeeCatalog | null>(null);
	let selectedCoffeeOffset = $state(0);
	let selectedCoffeeLoading = $state(false);
	let selectedCoffeeError = $state<string | null>(null);
	let selectionRequestVersion = 0;
	let coffeeOpenRequestVersion = 0;
	let locationListOpen = $state(false);
	let locationListLimit = $state(48);
	let lastIncomingStateKey = '';
	let lastPublishedStateKey = '';

	let requestQuery = $derived(
		buildCatalogMapRequestParams(catalogState, committedState, canUseAdvancedMaps).toString()
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
	let canSearchViewport = $derived(access?.viewportSearch ?? canUseAdvancedMaps);
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
					const nextState: CatalogMapUrlState = {
						...currentState,
						bbox: effective.bbox
							? {
									west: effective.bbox.west,
									south: effective.bbox.south,
									east: effective.bbox.east,
									north: effective.bbox.north
								}
							: null,
						placeId: effective.place_id
					};
					if (stateKey(nextState) !== stateKey(currentState)) {
						// Parchment may strip gated spatial or place scope in lenient mode.
						// Reflect that effective scope in the URL so the UI never claims a
						// narrower map than the data actually represents.
						publishState(nextState, true);
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

	function explorePlace(place: CatalogMapPlace) {
		if (!place.place_id || !canExplorePlaces) return;
		pendingBounds = null;
		publishState({ ...currentState, bbox: null, placeId: place.place_id }, true);
	}

	function clearPlaceNavigation() {
		publishState({ ...currentState, placeId: null }, true);
	}

	function catalogCoffeeId(coffee: CoffeeCatalog): number {
		return coffee.id;
	}

	function clearFocusedCoffee() {
		coffeeOpenRequestVersion += 1;
		focusedCoffee = null;
		onClearCoffee();
	}

	function closeFocusedCoffeeToMap() {
		clearFocusedCoffee();
		sheetOpen = false;
	}

	function clearMapSelection() {
		selectionRequestVersion += 1;
		clusterSelection = null;
		selectionQuery = '';
		selectedCoffees = [];
		selectedCoffeeOffset = 0;
		selectedCoffeeLoading = false;
		selectedCoffeeError = null;
		clearFocusedCoffee();
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
		clearFocusedCoffee();
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
		const requestVersion = ++coffeeOpenRequestVersion;
		selectionError = null;
		selectedCoffeeError = null;
		const coffee = await onSelectCoffee(catalogId);
		if (requestVersion !== coffeeOpenRequestVersion) return;
		if (coffee) {
			focusedCoffee = coffee;
			sheetOpen = true;
			return;
		}
		const message = "We couldn't open that coffee. Try again.";
		if (clusterSelection) selectedCoffeeError = message;
		else selectionError = message;
	}

	async function selectCoffee(place: CatalogMapPlace) {
		clearMapSelection();
		await openSelectedCoffee(place.catalog_id);
	}

	function coffeeCountLabel(count: number): string {
		return `${count} coffee${count === 1 ? '' : 's'}`;
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
</script>

<section class="space-y-3" aria-label="Coffee origin map">
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

	<div
		class="relative h-[clamp(26rem,72dvh,46rem)] overflow-hidden rounded-lg border border-line bg-surface-panel lg:flex lg:h-[46rem]"
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
					center={currentState.center}
					zoom={currentState.zoom}
					onViewportChange={handleViewportChange}
					onPlaceSelect={(catalogId) => {
						clearMapSelection();
						void openSelectedCoffee(catalogId);
					}}
					onClusterSelect={selectMapArea}
					onMapError={(message) => (rendererError = message)}
				/>
			{/if}

			<div
				class="pointer-events-none absolute bottom-[5.25rem] left-3 z-10 w-[min(20rem,calc(100%-6rem))] rounded-md border border-line bg-surface-canvas/95 px-3 py-2 shadow-sm backdrop-blur-sm lg:bottom-9"
				aria-label="Terrain elevation key"
			>
				<p class="text-[0.68rem] font-semibold text-ink">Approx. terrain elevation · MASL</p>
				<ul class="mt-1.5 grid grid-cols-5 overflow-hidden rounded-sm" aria-label="Elevation bands">
					{#each TERRAIN_ELEVATION_BANDS as band}
						<li class="min-w-0" aria-label={band.label}>
							<span class="block h-2" style={`background:${band.color}`}></span>
							<span class="mt-1 block text-center text-[0.58rem] leading-none text-muted"
								>{band.shortLabel}</span
							>
						</li>
					{/each}
				</ul>
			</div>

			<div class="absolute left-3 top-3 z-10 flex max-w-[calc(100%-5rem)] flex-wrap gap-2">
				{#if pendingBounds}
					<button
						type="button"
						disabled={!canSearchViewport}
						class="rounded-md bg-accent px-3 py-2 text-xs font-semibold text-ink shadow-sm transition-colors hover:bg-accent/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
						<strong class="text-sm text-ink"
							>{focusedCoffee?.name ?? clusterSelection?.label ?? 'Catalog results'}</strong
						>
						{#if focusedCoffee}
							<span class="ml-2 text-xs text-muted">Selected coffee</span>
						{:else}
							<span class="ml-2 text-xs text-muted"
								>{clusterSelection?.coffeeMatchCount ?? totals?.unique_coffee_count ?? '—'} coffees</span
							>
						{/if}
					</span>
					<span class="text-xs font-medium text-link lg:hidden"
						>{sheetOpen ? 'Collapse' : 'Open'}</span
					>
				</span>
			</button>
			<div class="min-h-0 flex-1 overflow-y-auto border-t border-line p-3">
				{#if focusedCoffee}
					<div class="mb-3 flex items-start justify-between gap-3 border-b border-line pb-3">
						<div>
							<p class="text-xs font-semibold text-muted">Selected coffee</p>
							<h2 class="mt-1 text-lg font-semibold text-ink">
								{focusedCoffee.name}
							</h2>
						</div>
						<button
							type="button"
							class="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted hover:text-ink"
							onclick={clearFocusedCoffee}
						>
							{clusterSelection ? `Back to ${clusterSelection.label}` : 'Back to map results'}
						</button>
					</div>
					{#key focusedCoffee.id}
						{@render coffeeDetail(focusedCoffee, closeFocusedCoffeeToMap)}
					{/key}
				{:else if clusterSelection}
					{@const selectedOriginSummary = originSummary(clusterSelection.originLabels)}
					<div class="mb-3 border-b border-line pb-3">
						<div class="flex items-start justify-between gap-3">
							<div>
								<p class="text-xs font-semibold text-muted">
									{clusterSelection.precisionLabel}
								</p>
								<h2 class="mt-1 text-lg font-semibold text-ink">
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
								{formatElevationRange(place.elevation_min_masl, place.elevation_max_masl, 'masl')}
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
