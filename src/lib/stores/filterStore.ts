import { writable, derived, get } from 'svelte/store';

// Define types
type FilterState = {
	routeId: string;
	sortField: string | null;
	sortDirection: 'asc' | 'desc' | null;
	filters: Record<string, any>;
	uniqueValues: Record<string, any[]>;
	originalData: any[];
	filteredData: any[];
	lastProcessedString: string;
	processing: boolean;
	initialized: boolean; // Flag to track if store is initialized
	initializingRoute: string | null; // Flag to track route being initialized
	lastDebounceId: NodeJS.Timeout | null; // Track the last debounce timer
	lastProcessedCacheKey: string | null; // Track the last processed cache key
	changeCounter: number; // Counter to track filter changes
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
	lastProcessedString: '',
	processing: false,
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
	 * Initializes the filter store for a specific route with data
	 * Sets up default sorting, filters, and processes the initial data
	 * @param routeId - The route identifier (e.g., '/beans', '/roast', '/')
	 * @param data - Array of data items to initialize with
	 */
	function initializeForRoute(routeId: string, data: any[]) {
		// Skip if already initializing this route
		const currentState = get({ subscribe });
		if (currentState.initializingRoute === routeId) {
			console.log(`Already initializing route ${routeId}, skipping duplicate call`);
			return;
		}

		//console.log(`Initializing filter store for route: ${routeId} with ${data.length} items`);

		update((state) => {
			// Mark that we're initializing this route
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

			// Update unique filter values
			updateUniqueFilterValues();

			// Get all sources and set them as selected by default
			// Handle both direct source field and coffee_catalog.source for joined data
			const sources = Array.from(
				new Set(
					data
						.map((item) => {
							// For beans page with joined data, check coffee_catalog.source first
							if (item.coffee_catalog?.source) return item.coffee_catalog.source;
							// Fallback to direct fields
							return item.source || item.vendor;
						})
						.filter(Boolean)
				)
			);
			if (sources.length > 0) {
				state.filters.source = sources;
			}

			// Process the data with initial settings
			state.filteredData = processData(data, state.sortField, state.sortDirection, state.filters);
			state.initialized = true;
			state.initializingRoute = null;

			return state;
		});
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
		} else if (routeId === '/' || routeId === '') {
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
			return state;
		});
		processAndUpdateFilteredData();
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
			return state;
		});
		processAndUpdateFilteredData();
	}

	/**
	 * Sets a filter value for a specific field
	 * @param key - The field name to filter on
	 * @param value - The filter value (can be string, array, object with min/max, etc.)
	 */
	function setFilter(key: string, value: any) {
		update((state) => {
			state.filters = { ...state.filters, [key]: value };
			return state;
		});
		processAndUpdateFilteredData();
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
			return state;
		});
		processAndUpdateFilteredData();
	}

	// Update unique filter values based on original data
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

				// Check if we've already processed this exact data set
				const dataString = JSON.stringify(state.originalData.map((item) => item.id || item._id));
				if (dataString === state.lastProcessedString) {
					state.processing = false;
					return state;
				}

				// Save the string representation of IDs to avoid reprocessing
				state.lastProcessedString = dataString;

				// Now process the unique values
				const uniqueValues: Record<string, any[]> = {};

				// Get unique sources - handle joined data structure
				const sourcesExist = state.originalData.some(
					(item) => item.coffee_catalog?.source || item.source || item.vendor
				);
				if (sourcesExist) {
					uniqueValues.sources = Array.from(
						new Set(
							state.originalData
								.map((item) => {
									// For beans page with joined data, check coffee_catalog.source first
									if (item.coffee_catalog?.source) return item.coffee_catalog.source;
									// Fallback to direct fields
									return item.source || item.vendor;
								})
								.filter(Boolean)
						)
					).sort((a, b) => a.localeCompare(b));
				}

				// Get unique purchase dates
				if (state.originalData.some((item) => item.purchase_date)) {
					uniqueValues.purchaseDates = Array.from(
						new Set(state.originalData.map((item) => item.purchase_date).filter(Boolean))
					).sort((a, b) => a.localeCompare(b));
				}

				// Get unique arrival dates from catalog data
				if (state.originalData.some((item) => getFieldValue(item, 'arrival_date'))) {
					uniqueValues.arrivalDates = Array.from(
						new Set(
							state.originalData.map((item) => getFieldValue(item, 'arrival_date')).filter(Boolean)
						)
					).sort((a, b) => a.localeCompare(b));
				}

				// Get unique roast dates
				if (state.originalData.some((item) => item.roast_date)) {
					uniqueValues.roastDates = Array.from(
						new Set(state.originalData.map((item) => item.roast_date).filter(Boolean))
					).sort((a, b) => a.localeCompare(b));
				}

				// Get unique batch names
				if (state.originalData.some((item) => item.batch_name)) {
					uniqueValues.batchNames = Array.from(
						new Set(state.originalData.map((item) => item.batch_name).filter(Boolean))
					).sort((a, b) => a.localeCompare(b));
				}

				// Only update uniqueValues if they've actually changed
				if (JSON.stringify(uniqueValues) !== JSON.stringify(state.uniqueValues)) {
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
	function getFieldValue(item: any, field: string): any {
		// Fields that might be in coffee_catalog for joined beans data
		const catalogFields = [
			'name',
			'source',
			'score_value',
			'region',
			'processing',
			'cultivar_detail',
			'arrival_date',
			'cost_lb',
			'stocked_date',
			'type'
		];

		// For beans page joined data, check coffee_catalog first for these fields
		if (catalogFields.includes(field) && item.coffee_catalog?.[field] !== undefined) {
			return item.coffee_catalog[field];
		}

		// Fallback to direct field access
		return item[field];
	}

	// Filter data based on filters
	function filterData(data: any[], filters: Record<string, any>): any[] {
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
					const stockedDate = new Date(itemValue);
					return stockedDate >= cutoffDate;
				}

				// Handle different filter types
				if (typeof value === 'object') {
					// Range filter
					if (value.min !== undefined && value.max !== undefined) {
						return (
							(value.min === '' || itemValue >= parseFloat(value.min)) &&
							(value.max === '' || itemValue <= parseFloat(value.max))
						);
					}

					// Array filter
					if (Array.isArray(value)) {
						return value.includes(itemValue);
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
		data: any[],
		sortField: string | null,
		sortDirection: 'asc' | 'desc' | null
	): any[] {
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
				// Custom date parsing function for handling YYYY-MM format
				const parseMonthYear = (dateStr: string): Date => {
					if (!dateStr) return new Date(0);

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

				const dateA = parseMonthYear(aValue);
				const dateB = parseMonthYear(bValue);

				return sortDirection === 'asc'
					? dateA.getTime() - dateB.getTime()
					: dateB.getTime() - dateA.getTime();
			}

			// Handle score_value and other numeric fields
			if (sortField === 'score_value' || sortField === 'cost_lb') {
				const numA = parseFloat(aValue) || 0;
				const numB = parseFloat(bValue) || 0;

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
		data: any[],
		sortField: string | null,
		sortDirection: 'asc' | 'desc' | null,
		filters: Record<string, any>
	): any[] {
		// Start by filtering
		const filtered = filterData(data, filters);
		//	console.log('After filtering:', filtered.length, 'items');

		// Then sort
		const sorted = sortData(filtered, sortField, sortDirection);
		//console.log('After sorting:', sorted.length, 'items');

		return sorted;
	}

	// Process and update filtered data, with debounce to avoid rapid updates
	function processAndUpdateFilteredData() {
		// If a debounce timer exists, clear it
		const currentState = get({ subscribe });
		if (currentState.lastDebounceId) {
			clearTimeout(currentState.lastDebounceId);
		}

		// Set a new debounce timer with a shorter delay for better responsiveness
		const debounceId = setTimeout(() => {
			update((state) => {
				// If already processing, skip this update to prevent race conditions
				if (state.processing) {
					return state;
				}

				state.processing = true;

				try {
					if (!state.originalData || !state.originalData.length) {
						const hadData = state.filteredData.length > 0;
						state.filteredData = [];
						state.processing = false;

						// Only increment counter if data changed
						if (hadData) {
							state.changeCounter++;
						}
						return state;
					}

					// Process the data with current filter settings
					const processedData = processData(
						state.originalData,
						state.sortField,
						state.sortDirection,
						state.filters
					);

					// Check if the data actually changed (order matters for sorting)
					const dataChanged =
						state.filteredData.length !== processedData.length ||
						JSON.stringify(processedData.map((item) => item.id)) !==
							JSON.stringify(state.filteredData.map((item) => item.id));

					// Update the filtered data with the newly processed results
					state.filteredData = processedData;

					// Increment change counter only if data actually changed
					// This triggers reactive updates in components that depend on the change counter
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
		}, 50); // Shorter 50ms debounce for better responsiveness

		// Store the debounce timer ID
		update((state) => {
			state.lastDebounceId = debounceId;
			return state;
		});
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
				'region',
				'processing',
				'cultivar_detail'
			];
		} else if (routeId.includes('roast')) {
			return [
				'batch_name',
				'coffee_name',
				'roast_date',
				'roast_notes',
				'roast_targets',
				'oz_in',
				'oz_out'
			];
		} else if (routeId === '/') {
			return [
				'name',
				'source',
				'region',
				'processing',
				'cultivar_detail',
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
		filteredData
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
