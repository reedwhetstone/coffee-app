import { writable, derived, get } from 'svelte/store';

// Define types
type DataItem = Record<string, unknown>;
type FilterValue =
	| string
	| number
	| boolean
	| { min: string | number; max: string | number }
	| string[]
	| null;

type FilterState = {
	routeId: string;
	sortField: string | null;
	sortDirection: 'asc' | 'desc' | null;
	filters: Record<string, FilterValue>;
	uniqueValues: Record<string, unknown[]>;
	originalData: DataItem[]; // Keep for backward compatibility
	filteredData: DataItem[];
	serverData: DataItem[]; // Server-side filtered/sorted data
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
		hasNext: boolean;
		hasPrev: boolean;
	};
	lastProcessedString: string;
	processing: boolean;
	isLoading: boolean; // Loading state for server requests
	initialized: boolean;
	initializingRoute: string | null;
	lastDebounceId: NodeJS.Timeout | null;
	lastProcessedCacheKey: string | null;
	changeCounter: number;
};

// Initialize default state
const initialState: FilterState = {
	routeId: '',
	sortField: null,
	sortDirection: null,
	filters: {},
	uniqueValues: {},
	originalData: [],
	filteredData: [],
	serverData: [],
	pagination: {
		page: 1,
		limit: 15,
		total: 0,
		totalPages: 0,
		hasNext: false,
		hasPrev: false
	},
	lastProcessedString: '',
	processing: false,
	isLoading: false,
	initialized: false,
	initializingRoute: null,
	lastDebounceId: null,
	lastProcessedCacheKey: null,
	changeCounter: 0
};

// Create the store
function createFilterStore() {
	const { subscribe, update } = writable<FilterState>(initialState);

	/**
	 * Builds query parameters for server-side filtering and sorting
	 * @returns URLSearchParams object
	 */
	function buildQueryParams(state: FilterState): URLSearchParams {
		const params = new URLSearchParams();

		// Add pagination parameters
		params.append('page', state.pagination.page.toString());
		params.append('limit', state.pagination.limit.toString());

		// Add sort parameters
		if (state.sortField) {
			params.append('sortField', state.sortField);
		}
		if (state.sortDirection) {
			params.append('sortDirection', state.sortDirection);
		}

		// Add filter parameters
		Object.entries(state.filters).forEach(([key, value]) => {
			if (value === undefined || value === null || value === '') return;

			if (Array.isArray(value)) {
				value.forEach((v) => {
					if (v) params.append(key, v.toString());
				});
			} else if (typeof value === 'object' && value.min !== undefined && value.max !== undefined) {
				// Handle range filters (score_value, cost_lb)
				if (value.min !== '') params.append(`${key}_min`, value.min.toString());
				if (value.max !== '') params.append(`${key}_max`, value.max.toString());
			} else {
				params.append(key, value.toString());
			}
		});

		return params;
	}

	// Server fetch debouncing
	let serverFetchTimeout: NodeJS.Timeout | null = null;

	/**
	 * Fetches data from the server with current filter/sort/pagination settings
	 * Includes debouncing to prevent excessive API calls
	 */
	async function fetchServerData() {
		const state = get({ subscribe });

		// Only fetch for catalog route
		if (!state.routeId.includes('/catalog') && state.routeId !== '/') {
			return;
		}

		// Clear existing timeout
		if (serverFetchTimeout) {
			clearTimeout(serverFetchTimeout);
		}

		// Debounce server requests for better performance
		serverFetchTimeout = setTimeout(async () => {
			update((s) => ({ ...s, isLoading: true }));

			try {
				const currentState = get({ subscribe });
				const params = buildQueryParams(currentState);
				const response = await fetch(`/api/catalog?${params}`);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const result = await response.json();

				update((s) => ({
					...s,
					serverData: result.data || [],
					pagination: result.pagination || s.pagination,
					filteredData: result.data || [], // Keep filteredData in sync for backward compatibility
					isLoading: false,
					changeCounter: s.changeCounter + 1
				}));
			} catch (error) {
				console.error('Error fetching server data:', error);
				update((s) => ({ ...s, isLoading: false }));
			}
		}, 150); // Debounce server requests by 150ms
	}

	/**
	 * Fetches unique filter values from the server
	 */
	async function fetchUniqueValues() {
		try {
			const response = await fetch('/api/catalog/filters');

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
	function initializeForRoute(routeId: string, data: DataItem[]) {
		// Skip if already initializing this route
		const currentState = get({ subscribe });
		if (currentState.initializingRoute === routeId) {
			return;
		}

		// Determine if this is a server-side route (catalog)
		const isServerSideRoute = routeId.includes('/catalog') || routeId === '/';

		// Immediate setup with minimal processing
		update((state) => {
			state.initializingRoute = routeId;
			state.routeId = routeId;
			state.originalData = data;
			state.filters = {};
			state.processing = false;
			state.lastProcessedCacheKey = null;

			// Set default sort settings for this route
			const { field, direction } = getDefaultSortSettings(routeId);
			state.sortField = field;
			state.sortDirection = direction;

			// Auto-filter beans by green_coffee_inv.stocked = 'TRUE' for beans route (user can change this)
			if (routeId.includes('beans')) {
				state.filters.stocked = 'TRUE';
			}

			if (isServerSideRoute) {
				// For catalog route, use server-side mode
				state.serverData = [];
				state.pagination = {
					page: 1,
					limit: 15,
					total: 0,
					totalPages: 0,
					hasNext: false,
					hasPrev: false
				};
				state.filteredData = []; // Start empty, will be populated by server
			} else {
				// For other routes, use client-side processing
				state.filteredData = processData(data, state.sortField, state.sortDirection, state.filters);
			}

			state.initialized = true;
			state.initializingRoute = null;

			return state;
		});

		if (isServerSideRoute) {
			// For catalog route, fetch server data and unique values
			setTimeout(() => {
				fetchServerData();
				fetchUniqueValues();
			}, 0);
		} else {
			// For other routes, use client-side processing
			setTimeout(() => {
				updateUniqueFilterValues();
			}, 0);
		}
	}

	/**
	 * Returns default sort settings for different routes
	 * @param routeId - The route identifier
	 * @returns Object with field and direction properties
	 */
	function getDefaultSortSettings(routeId: string) {
		if (routeId.includes('beans')) {
			return { field: 'purchase_date', direction: 'desc' as const };
		} else if (routeId.includes('roast')) {
			return { field: 'roast_date', direction: 'desc' as const };
		} else if (routeId === '/' || routeId === '' || routeId === '/catalog') {
			return { field: 'stocked_date', direction: 'desc' as const };
		} else {
			return { field: null, direction: null } as const;
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
			if (state.routeId.includes('/catalog') || state.routeId === '/') {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (currentState.routeId.includes('/catalog') || currentState.routeId === '/') {
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
			if (state.routeId.includes('/catalog') || state.routeId === '/') {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (currentState.routeId.includes('/catalog') || currentState.routeId === '/') {
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
			state.filters = { ...state.filters, [key]: value };
			// Reset to first page for server-side routes
			if (state.routeId.includes('/catalog') || state.routeId === '/') {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (currentState.routeId.includes('/catalog') || currentState.routeId === '/') {
			fetchServerData();
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
			return state;
		});
		processAndUpdateFilteredData();
	}

	// Clear all filters
	function clearFilters() {
		update((state) => {
			state.filters = {};
			// Reset to first page for server-side routes
			if (state.routeId.includes('/catalog') || state.routeId === '/') {
				state.pagination.page = 1;
			}
			return state;
		});

		const currentState = get({ subscribe });
		if (currentState.routeId.includes('/catalog') || currentState.routeId === '/') {
			fetchServerData();
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

	/**
	 * Helper function to get field value from item, handling joined data structure
	 * @param item - The data item
	 * @param field - The field name to get
	 * @returns The field value
	 */
	function getFieldValue(item: DataItem, field: string): unknown {
		// Fields that might be in coffee_catalog for joined beans data
		const catalogFields = [
			'name',
			'source',
			'score_value',
			'region',
			'country',
			'continent',
			'processing',
			'cultivar_detail',
			'arrival_date',
			'cost_lb',
			'stocked_date',
			'type',
			'grade',
			'appearance'
		];

		// For beans page joined data, check coffee_catalog first for these fields
		const catalog = item.coffee_catalog as DataItem | undefined;
		if (catalogFields.includes(field) && catalog?.[field] !== undefined) {
			return catalog[field];
		}

		// Fallback to direct field access
		return item[field];
	}

	// Filter data based on filters
	function filterData(data: DataItem[], filters: Record<string, FilterValue>): DataItem[] {
		// Skip if no filters
		if (!Object.keys(filters).length) return data;

		//console.log('Filtering data with filters:', filters);

		return data.filter((item) => {
			// Check each filter
			return Object.entries(filters).every(([key, value]) => {
				// Skip empty filters
				if (value === undefined || value === null || value === '') return true;

				// Get item value using helper function
				const itemValue = getFieldValue(item, key);

				// Handle stocked_date "last n days" filter
				if (key === 'stocked_date' && typeof value === 'string' && value !== '') {
					// Skip items with null/undefined stocked_date
					if (!itemValue) return false;

					const daysBack = parseInt(value);
					const cutoffDate = new Date();
					cutoffDate.setDate(cutoffDate.getDate() - daysBack);

					// Parse the stocked_date (format: YYYY-MM-DD)
					const stockedDate = new Date(String(itemValue));
					return stockedDate >= cutoffDate;
				}

				// Handle stocked boolean filter
				if (key === 'stocked') {
					// Skip filtering if value is empty string (All option)
					if (value === '') return true;
					// Convert string to boolean for comparison
					if (value === 'TRUE' || value === 'true') {
						return itemValue === true;
					} else if (value === 'FALSE' || value === 'false') {
						return itemValue === false;
					}
					// For other boolean values, use direct comparison
					return itemValue === value;
				}

				// Handle roast_id text search
				if (key === 'roast_id') {
					// Skip filtering if value is empty string
					if (value === '') return true;
					// Convert roast_id to string and do partial match search
					const roastIdString = String(itemValue || '');
					const searchString = String(value || '').toLowerCase();
					return roastIdString.toLowerCase().includes(searchString);
				}

				// Handle different filter types
				if (typeof value === 'object' && value !== null) {
					// Range filter - check if it's a range object (not an array)
					if (!Array.isArray(value) && 'min' in value && 'max' in value) {
						const numItemValue =
							typeof itemValue === 'number' ? itemValue : parseFloat(String(itemValue));
						return (
							(value.min === '' || numItemValue >= parseFloat(String(value.min))) &&
							(value.max === '' || numItemValue <= parseFloat(String(value.max)))
						);
					}

					// Array filter - special handling for source to include null/undefined values
					if (Array.isArray(value)) {
						// For source filtering, if no specific sources are selected (empty array),
						// show all items including those with null sources
						if (key === 'source' && value.length === 0) {
							return true;
						}
						return value.includes(itemValue as string);
					}
				} else if (typeof itemValue === 'string' && typeof value === 'string') {
					// Case-insensitive string search
					return itemValue.toLowerCase().includes(value.toLowerCase());
				} else {
					// Exact match
					return itemValue === value;
				}

				return true;
			});
		});
	}

	/**
	 * Sorts data based on the specified field and direction
	 * @param data - Array of data items to sort
	 * @param sortField - Field name to sort by
	 * @param sortDirection - Sort direction ('asc' or 'desc')
	 * @returns Sorted array of data items
	 */
	function sortData(
		data: DataItem[],
		sortField: string | null,
		sortDirection: 'asc' | 'desc' | null
	): DataItem[] {
		// Return unsorted data if no sort criteria specified
		if (!sortField || !sortDirection) {
			return data;
		}

		return [...data].sort((a, b) => {
			const aValue = getFieldValue(a, sortField);
			const bValue = getFieldValue(b, sortField);

			// Handle null/undefined values - always sort them to the end
			if (aValue == null && bValue == null) return 0;
			if (aValue == null) return 1;
			if (bValue == null) return -1;

			// Handle date fields specially
			if (
				sortField === 'purchase_date' ||
				sortField === 'arrival_date' ||
				sortField === 'roast_date' ||
				sortField === 'stocked_date'
			) {
				// Custom date parsing function for handling various date formats
				const parseMonthYear = (dateStr: string): Date => {
					if (!dateStr) return new Date(0);

					// Check if it's in the DD-MM-YYYY format
					if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
						const [day, month, year] = dateStr.split('-').map(Number);
						return new Date(year, month - 1, day);
					}

					// Check if it's in the YYYY-MM format
					if (/^\d{4}-\d{2}$/.test(dateStr)) {
						const [year, month] = dateStr.split('-').map(Number);
						return new Date(year, month - 1);
					}

					// If it's a database date/time format
					if (dateStr.includes(' ')) {
						// Convert MySQL datetime to JS Date
						return new Date(dateStr.replace(' ', 'T') + 'Z');
					}

					// Standard date format (YYYY-MM-DD)
					return new Date(dateStr);
				};

				const dateA = parseMonthYear(String(aValue));
				const dateB = parseMonthYear(String(bValue));

				return sortDirection === 'asc'
					? dateA.getTime() - dateB.getTime()
					: dateB.getTime() - dateA.getTime();
			}

			// Handle score_value, roast_id and other numeric fields
			if (sortField === 'score_value' || sortField === 'cost_lb' || sortField === 'roast_id') {
				const numA = parseFloat(String(aValue)) || 0;
				const numB = parseFloat(String(bValue)) || 0;

				return sortDirection === 'asc' ? numA - numB : numB - numA;
			}

			// Handle string fields (processing, cultivar_detail, name, source, region, etc.)
			if (typeof aValue === 'string' && typeof bValue === 'string') {
				return sortDirection === 'asc'
					? aValue.toLowerCase().localeCompare(bValue.toLowerCase())
					: bValue.toLowerCase().localeCompare(aValue.toLowerCase());
			}

			// Fallback for other types - convert to string and compare
			const strA = String(aValue || '').toLowerCase();
			const strB = String(bValue || '').toLowerCase();

			return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
		});
	}

	// Process data with filters and sorting
	function processData(
		data: DataItem[],
		sortField: string | null,
		sortDirection: 'asc' | 'desc' | null,
		filters: Record<string, FilterValue>
	): DataItem[] {
		// Start by filtering
		const filtered = filterData(data, filters);
		//	console.log('After filtering:', filtered.length, 'items');

		// Then sort
		const sorted = sortData(filtered, sortField, sortDirection);
		//console.log('After sorting:', sorted.length, 'items');

		return sorted;
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
					const cacheKey = `${state.sortField}-${state.sortDirection}-${JSON.stringify(state.filters)}`;
					if (cacheKey === state.lastProcessedString && state.filteredData.length > 0) {
						state.processing = false;
						return state;
					}

					// Process the data efficiently
					const processedData = processData(
						state.originalData,
						state.sortField,
						state.sortDirection,
						state.filters
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

	// Efficient array comparison helper
	function arraysEqual(a: unknown[], b: unknown[]): boolean {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) return false;
		}
		return true;
	}

	/**
	 * Returns the list of filterable columns for a specific route
	 * @param routeId - The route identifier
	 * @returns Array of column names that can be filtered
	 */
	function getFilterableColumns(routeId: string): string[] {
		if (routeId.includes('beans')) {
			return [
				'name',
				'source',
				'score_value',
				'purchase_date',
				'arrival_date',
				'type',
				'grade',
				'appearance',
				'continent',
				'country',
				'region',
				'processing',
				'cultivar_detail',
				'stocked'
			];
		} else if (routeId.includes('roast')) {
			return [
				'roast_id',
				'batch_name',
				'coffee_name',
				'roast_date',
				'roast_notes',
				'roast_targets',
				'oz_in',
				'oz_out'
			];
		} else if (routeId === '/' || routeId === '/catalog') {
			return [
				'name',
				'source',
				'continent',
				'country',
				'region',
				'processing',
				'cultivar_detail',
				'type',
				'grade',
				'appearance',
				'score_value',
				'cost_lb',
				'stocked_date'
			];
		}
		return [];
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
