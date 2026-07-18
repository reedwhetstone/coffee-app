import { writable, derived, get } from 'svelte/store';
import {
	buildCatalogRequestParams,
	buildCatalogShareParams,
	createDefaultCatalogUrlState,
	type CatalogFilterValue,
	type CatalogUrlState
} from '$lib/catalog/urlState';
import {
	isCatalogRoute,
	getDefaultSortSettings,
	getFilterableColumns,
	sanitizeFilters,
	getFieldValue,
	processData,
	arraysEqual,
	type DataItem
} from '$lib/data/catalogFilters';

// Define types
type FilterValue = CatalogFilterValue;

// Field names Parchment may use on a stripped-filter notice to name the
// filter param it dropped. coffee-app stays a shell: it does not decide which
// filters are entitled, it only believes the server about what was stripped so
// the UI can reconcile local active-filter state to the server-applied result.
const STRIPPED_FILTER_NOTICE_FIELDS = [
	'deniedParams',
	'strippedParams',
	'params',
	'param',
	'fields',
	'field',
	'filters',
	'filter'
] as const;

const UPSTREAM_NOTICE_TO_APP_FILTER_KEY: Readonly<Record<string, string>> = {
	scoreValueMin: 'score_value',
	scoreValueMax: 'score_value',
	pricePerLbMin: 'cost_lb',
	pricePerLbMax: 'cost_lb',
	stockedDate: 'stocked_date',
	stockedDays: 'stocked_days',
	arrivalDate: 'arrival_date',
	variety: 'cultivar_detail'
};

/**
 * Extracts the set of filter param keys that upstream reports as stripped from a
 * lenient website request. Only returns keys the server explicitly names, so a
 * filter is never cleared unless the API says it was dropped.
 */
function extractStrippedFilterKeys(notices: unknown[]): string[] {
	const keys = new Set<string>();
	for (const notice of notices) {
		if (!notice || typeof notice !== 'object') continue;
		const record = notice as Record<string, unknown>;
		for (const field of STRIPPED_FILTER_NOTICE_FIELDS) {
			const value = record[field];
			if (Array.isArray(value)) {
				for (const candidate of value) {
					if (typeof candidate === 'string' && candidate.trim() !== '') {
						keys.add(candidate.trim());
					}
				}
			} else if (typeof value === 'string' && value.trim() !== '') {
				keys.add(value.trim());
			}
		}
	}
	return Array.from(keys, (key) => UPSTREAM_NOTICE_TO_APP_FILTER_KEY[key] ?? key);
}

type CatalogPaginationState = {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
	hasNext: boolean;
	hasPrev: boolean;
};

type FilterState = {
	routeId: string;
	sortField: string | null;
	sortDirection: 'asc' | 'desc' | null;
	showWholesale: boolean;
	wholesaleOnly: boolean;
	filters: Record<string, FilterValue>;
	uniqueValues: Record<string, unknown[]>;
	originalData: DataItem[]; // Keep for backward compatibility
	filteredData: DataItem[];
	serverData: DataItem[]; // Server-side filtered/sorted data
	pagination: CatalogPaginationState;
	lastProcessedString: string;
	processing: boolean;
	isLoading: boolean; // First-mount pending state for server requests (drives full skeleton)
	isRefetching: boolean; // Refetch pending state while stale rows stay visible (drives overlay)
	hasLoadedOnce: boolean; // True once server rows have been provided or fetched at least once
	catalogResponseMeta: Record<string, unknown> | null;
	catalogNotices: unknown[];
	initialized: boolean;
	initializingRoute: string | null;
	lastDebounceId: NodeJS.Timeout | null;
	lastProcessedCacheKey: string | null;
	changeCounter: number;
};

type InitializeRouteOptions = {
	catalogUrlState?: CatalogUrlState;
	pagination?: CatalogPaginationState;
	serverData?: DataItem[];
};

function createInitialCatalogPagination(): CatalogPaginationState {
	const defaultCatalogState = createDefaultCatalogUrlState();
	return {
		page: defaultCatalogState.pagination.page,
		limit: defaultCatalogState.pagination.limit,
		total: 0,
		totalPages: 0,
		hasNext: false,
		hasPrev: false
	};
}

// Initialize default state
const initialState: FilterState = {
	routeId: '',
	sortField: null,
	sortDirection: null,
	showWholesale: true,
	wholesaleOnly: false,
	filters: {},
	uniqueValues: {},
	originalData: [],
	filteredData: [],
	serverData: [],
	pagination: createInitialCatalogPagination(),
	lastProcessedString: '',
	processing: false,
	isLoading: false,
	isRefetching: false,
	hasLoadedOnce: false,
	catalogResponseMeta: null,
	catalogNotices: [],
	initialized: false,
	initializingRoute: null,
	lastDebounceId: null,
	lastProcessedCacheKey: null,
	changeCounter: 0
};

// Create the store
function createFilterStore() {
	const { subscribe, update } = writable<FilterState>(initialState);

	function toCatalogUrlState(state: FilterState): CatalogUrlState {
		const defaultCatalogState = createDefaultCatalogUrlState();
		return {
			...defaultCatalogState,
			filters: state.filters,
			sortField: state.sortField,
			sortDirection: state.sortDirection,
			showWholesale: state.showWholesale,
			wholesaleOnly: state.wholesaleOnly,
			pagination: {
				page: state.pagination.page,
				limit: state.pagination.limit
			}
		};
	}

	function buildQueryParams(state: FilterState): URLSearchParams {
		return buildCatalogRequestParams(toCatalogUrlState(state), state.routeId);
	}

	function buildShareQueryParams(state: FilterState): URLSearchParams {
		return buildCatalogShareParams(toCatalogUrlState(state), state.routeId);
	}

	function syncCatalogUrl(state: FilterState) {
		if (typeof window === 'undefined' || !isCatalogRoute(state.routeId)) {
			return;
		}

		const params = buildShareQueryParams(state);
		const search = params.toString();
		const nextUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
		const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

		if (nextUrl !== currentUrl) {
			window.history.replaceState(window.history.state, '', nextUrl);
		}
	}

	// Server fetch debouncing plus request-lifecycle guards. The abort controller
	// cancels an in-flight request when a newer fetch starts; the monotonic
	// sequence id ensures a slower earlier response can never overwrite newer
	// filter state even if the transport (or a test mock) ignores the abort.
	let serverFetchTimeout: NodeJS.Timeout | null = null;
	let activeAbortController: AbortController | null = null;
	let requestSequence = 0;

	/**
	 * Fetches data from the server with current filter/sort/pagination settings.
	 * Includes debouncing, request cancellation, and a sequence guard so
	 * stale-while-revalidate interactions stay correct under rapid changes.
	 */
	async function fetchServerData() {
		const state = get({ subscribe });

		// Only fetch for catalog route
		if (!isCatalogRoute(state.routeId)) {
			return;
		}

		// Clear existing timeout
		if (serverFetchTimeout) {
			clearTimeout(serverFetchTimeout);
		}

		// Invalidate any request still in flight the moment a newer fetch is
		// scheduled, not when the debounce fires. Bumping the sequence and
		// aborting the active controller here closes the window where an earlier
		// response could resolve during the 150ms debounce and still match
		// requestSequence, landing stale rows/pagination and stripped-filter
		// reconciliation against the newer filter state.
		activeAbortController?.abort();
		activeAbortController = null;
		const requestId = ++requestSequence;

		// Debounce server requests for better performance
		serverFetchTimeout = setTimeout(async () => {
			const controller = new AbortController();
			activeAbortController = controller;

			// First mount shows the full skeleton; subsequent fetches keep the
			// already-visible rows and surface a quiet refetch state instead.
			update((s) => ({
				...s,
				isLoading: !s.hasLoadedOnce,
				isRefetching: s.hasLoadedOnce
			}));

			try {
				const currentState = get({ subscribe });
				const params = buildQueryParams(currentState);
				const queryString = params.toString();
				const response = await fetch(`/api/catalog${queryString ? `?${queryString}` : ''}`, {
					signal: controller.signal
				});

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const result = await response.json();

				// A newer request superseded this one while it was in flight; drop
				// this response so it cannot overwrite fresher state.
				if (requestId !== requestSequence) {
					return;
				}

				const meta =
					result?.meta && typeof result.meta === 'object'
						? (result.meta as Record<string, unknown>)
						: null;
				const notices = Array.isArray(meta?.notices) ? meta.notices : [];
				const strippedKeys = extractStrippedFilterKeys(notices);
				const sortWasStripped = strippedKeys.includes('sort');

				if (activeAbortController === controller) {
					activeAbortController = null;
				}

				update((s) => {
					// Reconcile local active-filter state to the server-applied result:
					// drop any filter the API reported as stripped so the UI never
					// claims an unentitled filter is still active.
					const filters =
						strippedKeys.length > 0
							? (Object.fromEntries(
									Object.entries(s.filters).filter(([key]) => !strippedKeys.includes(key))
								) as Record<string, FilterValue>)
							: s.filters;

					return {
						...s,
						filters,
						sortField: sortWasStripped ? null : s.sortField,
						sortDirection: sortWasStripped ? null : s.sortDirection,
						serverData: result.data || [],
						pagination: result.pagination || s.pagination,
						filteredData: result.data || [], // Keep filteredData in sync for backward compatibility
						catalogResponseMeta: meta,
						catalogNotices: notices,
						isLoading: false,
						isRefetching: false,
						hasLoadedOnce: true,
						changeCounter: s.changeCounter + 1
					};
				});

				// Keep the shareable URL honest about the effective filter state.
				if (strippedKeys.length > 0) {
					syncCatalogUrl(get({ subscribe }));
				}
			} catch (error) {
				// An aborted request is expected when a newer fetch supersedes it;
				// the newer request owns the pending state, so leave it untouched.
				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}

				// Ignore late failures from a superseded request.
				if (requestId !== requestSequence) {
					return;
				}

				if (activeAbortController === controller) {
					activeAbortController = null;
				}

				console.error('Error fetching server data:', error);
				// Preserve the currently visible rows on error (stale-while-revalidate)
				// and only clear the pending flags.
				update((s) => ({ ...s, isLoading: false, isRefetching: false }));
			}
		}, 150); // Debounce server requests by 150ms
	}

	/**
	 * Fetches unique filter values from the server
	 */
	async function fetchUniqueValues() {
		try {
			const state = get({ subscribe });
			const params = new URLSearchParams();
			params.set('showWholesale', state.showWholesale ? 'true' : 'false');
			if (state.wholesaleOnly) {
				params.append('wholesaleOnly', 'true');
			}

			const response = await fetch(`/api/catalog/filters?${params.toString()}`);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const uniqueValues = await response.json();

			update((s) => ({
				...s,
				uniqueValues
			}));
		} catch (error) {
			console.error('Error fetching unique values:', error);
		}
	}

	/**
	 * Initializes the filter store for a specific route with data
	 * For catalog route, switches to server-side mode
	 * @param routeId - The route identifier (e.g., '/beans', '/roast', '/')
	 * @param data - Array of data items to initialize with
	 */
	function initializeForRoute(
		routeId: string,
		data: DataItem[],
		options: InitializeRouteOptions = {}
	) {
		// Skip if already initializing this route
		const currentState = get({ subscribe });
		if (currentState.initializingRoute === routeId) {
			return;
		}

		const isServerSideRoute = isCatalogRoute(routeId);
		const catalogUrlState = options.catalogUrlState ?? createDefaultCatalogUrlState();

		// Immediate setup with minimal processing
		update((state) => {
			state.initializingRoute = routeId;
			state.routeId = routeId;
			state.originalData = data;
			state.processing = false;
			state.lastProcessedCacheKey = null;

			// Set default sort settings for this route
			const { field, direction } = getDefaultSortSettings(routeId);
			state.filters = isServerSideRoute ? { ...catalogUrlState.filters } : {};
			state.showWholesale = isServerSideRoute ? catalogUrlState.showWholesale : false;
			state.wholesaleOnly = isServerSideRoute ? catalogUrlState.wholesaleOnly : false;
			state.sortField = isServerSideRoute ? catalogUrlState.sortField : field;
			state.sortDirection = isServerSideRoute ? catalogUrlState.sortDirection : direction;

			// Auto-filter beans by green_coffee_inv.stocked = 'TRUE' for beans route (user can change this)
			if (routeId.includes('beans')) {
				state.filters.stocked = 'TRUE';
			}

			state.isLoading = false;
			state.isRefetching = false;

			if (isServerSideRoute) {
				state.serverData = options.serverData ?? data;
				state.pagination = options.pagination ?? {
					...createInitialCatalogPagination(),
					page: catalogUrlState.pagination.page,
					limit: catalogUrlState.pagination.limit
				};
				state.filteredData = options.serverData ?? data;
				state.catalogResponseMeta = null;
				state.catalogNotices = [];
				// Server rows provided at init (SSR hydration) count as a first load,
				// so later interactions revalidate in place instead of re-skeletoning.
				state.hasLoadedOnce = options.serverData !== undefined || data.length > 0;
			} else {
				// For other routes, use client-side processing
				state.serverData = [];
				state.pagination = createInitialCatalogPagination();
				state.filteredData = processData(
					data,
					state.sortField,
					state.sortDirection,
					state.filters,
					state.showWholesale
				);
				state.catalogResponseMeta = null;
				state.catalogNotices = [];
				state.hasLoadedOnce = false;
			}

			state.initialized = true;
			state.initializingRoute = null;

			return state;
		});

		if (isServerSideRoute) {
			setTimeout(() => {
				syncCatalogUrl(get({ subscribe }));
				fetchUniqueValues();
				if (!options.serverData && data.length === 0) {
					fetchServerData();
				}
			}, 0);
		} else {
			// For other routes, use client-side processing
			setTimeout(() => {
				updateUniqueFilterValues();
			}, 0);
		}
	}

	// Set the default sort for a route
	function setDefaultSort(routeId: string) {
		const { field, direction } = getDefaultSortSettings(routeId);
		update((state) => {
			state.sortField = field;
			state.sortDirection = direction;
			return state;
		});
		processAndUpdateFilteredData();
	}

	/**
	 * Sets the sort field for the current route
	 * @param field - The field name to sort by, or null to clear sorting
	 */
	function setSortField(field: string | null) {
		// Convert empty string to null for consistency with internal state
		const normalizedField = field === '' ? null : field;

		update((state) => {
			state.sortField = normalizedField;
			// Reset sort direction if field is cleared to maintain consistent state
			if (!normalizedField) {
				state.sortDirection = null;
			}
			// Reset to first page for server-side routes
			if (isCatalogRoute(state.routeId)) {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (isCatalogRoute(currentState.routeId)) {
			syncCatalogUrl(currentState);
			fetchServerData();
		} else {
			processAndUpdateFilteredData();
		}
	}

	/**
	 * Sets the sort direction for the current route
	 * @param direction - 'asc', 'desc', or null to clear direction
	 */
	function setSortDirection(direction: 'asc' | 'desc' | null | string) {
		// Convert empty string to null for consistency with internal state
		const normalizedDirection =
			direction === '' || direction === null ? null : (direction as 'asc' | 'desc');

		update((state) => {
			state.sortDirection = normalizedDirection;
			// Reset to first page for server-side routes
			if (isCatalogRoute(state.routeId)) {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (isCatalogRoute(currentState.routeId)) {
			syncCatalogUrl(currentState);
			fetchServerData();
		} else {
			processAndUpdateFilteredData();
		}
	}

	/**
	 * Sets a filter value for a specific field
	 * @param key - The field name to filter on
	 * @param value - The filter value (can be string, array, object with min/max, etc.)
	 */
	function setFilter(key: string, value: FilterValue) {
		update((state) => {
			state.filters = sanitizeFilters({ ...state.filters, [key]: value });
			// Reset to first page for server-side routes
			if (isCatalogRoute(state.routeId)) {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (isCatalogRoute(currentState.routeId)) {
			syncCatalogUrl(currentState);
			fetchServerData();
		} else {
			processAndUpdateFilteredData();
		}
	}

	/**
	 * Clears a set of filters in one catalog request.
	 */
	function clearFiltersByKeys(keys: string[]) {
		const keySet = new Set(keys);
		update((state) => {
			state.filters = Object.fromEntries(
				Object.entries(state.filters).filter(([key]) => !keySet.has(key))
			) as Record<string, FilterValue>;
			if (isCatalogRoute(state.routeId)) {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (isCatalogRoute(currentState.routeId)) {
			syncCatalogUrl(currentState);
			fetchServerData();
		} else {
			processAndUpdateFilteredData();
		}
	}

	/**
	 * Toggles wholesale visibility on catalog routes.
	 * true (default): show retail + wholesale
	 * false: hobbyist suppliers only
	 */
	function setShowWholesale(showWholesale: boolean) {
		update((state) => {
			state.showWholesale = showWholesale;
			if (!showWholesale) {
				state.wholesaleOnly = false;
			}
			if (isCatalogRoute(state.routeId)) {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (isCatalogRoute(currentState.routeId)) {
			syncCatalogUrl(currentState);
			fetchServerData();
			fetchUniqueValues();
		} else {
			processAndUpdateFilteredData();
		}
	}

	// Toggle sort field or direction
	function toggleSort(field: string) {
		update((state) => {
			// If the field is the same, toggle direction
			if (state.sortField === field) {
				// None -> Asc -> Desc -> None
				if (state.sortDirection === null) {
					state.sortDirection = 'asc';
				} else if (state.sortDirection === 'asc') {
					state.sortDirection = 'desc';
				} else {
					state.sortField = null;
					state.sortDirection = null;
				}
			} else {
				// If the field is different, set sort field and direction to asc
				state.sortField = field;
				state.sortDirection = 'asc';
			}
			if (isCatalogRoute(state.routeId)) {
				state.pagination.page = 1;
			}
			return state;
		});
		const currentState = get({ subscribe });
		if (isCatalogRoute(currentState.routeId)) {
			syncCatalogUrl(currentState);
			fetchServerData();
		} else {
			processAndUpdateFilteredData();
		}
	}

	// Clear active filters while preserving the current sort contract.
	function clearFilters() {
		update((state) => {
			state.filters = {};
			state.showWholesale = true;
			state.wholesaleOnly = false;
			// Reset to first page for server-side routes
			if (isCatalogRoute(state.routeId)) {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (isCatalogRoute(currentState.routeId)) {
			syncCatalogUrl(currentState);
			fetchServerData();
			fetchUniqueValues();
		} else {
			processAndUpdateFilteredData();
		}
	}

	/**
	 * Loads a specific page (server-side only)
	 * @param page - Page number to load
	 */
	function loadPage(page: number) {
		update((state) => {
			state.pagination.page = page;
			return state;
		});
		const currentState = get({ subscribe });
		syncCatalogUrl(currentState);
		fetchServerData();
	}

	/**
	 * Loads the next page (server-side only)
	 */
	function loadNextPage() {
		const currentState = get({ subscribe });
		if (currentState.pagination.hasNext) {
			loadPage(currentState.pagination.page + 1);
		}
	}

	/**
	 * Loads the previous page (server-side only)
	 */
	function loadPrevPage() {
		const currentState = get({ subscribe });
		if (currentState.pagination.hasPrev) {
			loadPage(currentState.pagination.page - 1);
		}
	}

	// Update unique filter values based on original data (optimized)
	function updateUniqueFilterValues() {
		try {
			update((state) => {
				// If already processing, don't start another update
				if (state.processing) {
					return state;
				}

				state.processing = true;

				// Don't process if there's no data
				if (!state.originalData?.length) {
					state.processing = false;
					return state;
				}

				// Optimized cache key - use data length and checksum for better performance
				const cacheKey = `${state.originalData.length}-${state.originalData[0]?.id || 'start'}-${state.originalData[state.originalData.length - 1]?.id || 'end'}`;
				if (cacheKey === state.lastProcessedCacheKey) {
					state.processing = false;
					return state;
				}

				// Save the cache key to avoid reprocessing
				state.lastProcessedCacheKey = cacheKey;

				// Optimized unique values processing with efficient Set operations
				const uniqueValues: Record<string, unknown[]> = {};
				const data = state.originalData;

				// Helper to extract and dedupe values efficiently
				const extractUnique = (fieldExtractor: (item: DataItem) => unknown) => {
					const values = new Set<string>();
					for (const item of data) {
						const value = fieldExtractor(item);
						if (value) values.add(String(value));
					}
					return values.size > 0 ? Array.from(values).sort() : null;
				};

				// Process each field type efficiently
				const sourceExtractor = (item: DataItem) => {
					const catalog = item.coffee_catalog as DataItem | undefined;
					return catalog?.source || item.source || item.vendor;
				};
				const sources = extractUnique(sourceExtractor);
				if (sources) uniqueValues.sources = sources;

				const continents = extractUnique((item) => getFieldValue(item, 'continent'));
				if (continents) uniqueValues.continents = continents;

				const countries = extractUnique((item) => getFieldValue(item, 'country'));
				if (countries) uniqueValues.countries = countries;

				const arrivalDates = extractUnique((item) => getFieldValue(item, 'arrival_date'));
				if (arrivalDates) uniqueValues.arrivalDates = arrivalDates;

				const purchaseDates = extractUnique((item) => item.purchase_date);
				if (purchaseDates) uniqueValues.purchaseDates = purchaseDates;

				const roastDates = extractUnique((item) => item.roast_date);
				if (roastDates) uniqueValues.roastDates = roastDates;

				const batchNames = extractUnique((item) => item.batch_name);
				if (batchNames) uniqueValues.batchNames = batchNames;

				// Roast IDs need special numeric sorting
				const roastIdSet = new Set<number>();
				for (const item of data) {
					if (item.roast_id) roastIdSet.add(Number(item.roast_id));
				}
				if (roastIdSet.size > 0) {
					uniqueValues.roastIds = Array.from(roastIdSet).sort((a, b) => a - b);
				}

				// Only update if there are actual changes (shallow comparison)
				const hasChanges =
					Object.keys(uniqueValues).length !== Object.keys(state.uniqueValues).length ||
					Object.keys(uniqueValues).some(
						(key) => uniqueValues[key].length !== state.uniqueValues[key]?.length
					);

				if (hasChanges) {
					state.uniqueValues = uniqueValues;
				}

				state.processing = false;
				return state;
			});
		} catch (error) {
			console.error('Error updating unique filter values:', error);
			update((state) => {
				state.processing = false;
				return state;
			});
		}
	}

	// Process and update filtered data, with optimized debounce
	function processAndUpdateFilteredData() {
		// If a debounce timer exists, clear it
		const currentState = get({ subscribe });
		if (currentState.lastDebounceId) {
			clearTimeout(currentState.lastDebounceId);
		}

		// Optimized debounce - faster response for better UX
		const debounceId = setTimeout(() => {
			update((state) => {
				// Skip if already processing to prevent race conditions
				if (state.processing) {
					return state;
				}

				state.processing = true;

				try {
					// Early return for empty data
					if (!state.originalData?.length) {
						const hadData = state.filteredData.length > 0;
						state.filteredData = [];
						state.processing = false;
						if (hadData) state.changeCounter++;
						return state;
					}

					// Optimized processing - avoid unnecessary work
					const cacheKey = `${state.sortField}-${state.sortDirection}-${state.showWholesale}-${state.wholesaleOnly}-${JSON.stringify(state.filters)}`;
					if (cacheKey === state.lastProcessedString && state.filteredData.length > 0) {
						state.processing = false;
						return state;
					}

					// Process the data efficiently
					const processedData = processData(
						state.originalData,
						state.sortField,
						state.sortDirection,
						state.filters,
						state.showWholesale
					);

					// Efficient change detection using IDs
					const dataChanged = !arraysEqual(
						state.filteredData.map((item) => item.id),
						processedData.map((item) => item.id)
					);

					state.filteredData = processedData;
					state.lastProcessedString = cacheKey;

					if (dataChanged) {
						state.changeCounter++;
					}
				} catch (err) {
					console.error('Error processing data:', err);
				} finally {
					state.processing = false;
					state.lastDebounceId = null;
				}

				return state;
			});
		}, 8); // Reduced debounce for snappier response

		// Store the debounce timer ID
		update((state) => {
			state.lastDebounceId = debounceId;
			return state;
		});
	}

	// Create a filtered data derived store
	const filteredData = derived({ subscribe }, ($state) => $state.filteredData);

	return {
		subscribe,
		initializeForRoute,
		setDefaultSort,
		setSortField,
		setSortDirection,
		setFilter,
		clearFiltersByKeys,
		setShowWholesale,
		toggleSort,
		clearFilters,
		getFilterableColumns,
		filteredData,
		loadPage,
		loadNextPage,
		loadPrevPage,
		fetchServerData,
		fetchUniqueValues
	};
}

// Create the filter store instance
export const filterStore = createFilterStore();

// Create a derived store for the filtered data
export const filteredData = derived(filterStore, ($filterStore) => $filterStore.filteredData);

// Create a derived store that emits a notification when filters change
export const filterChangeNotifier = derived(
	filterStore,
	($filterStore) => $filterStore.changeCounter
);
