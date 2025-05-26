import { writable, derived, get } from 'svelte/store';

// Define types
type RouteFilters = Record<string, any>;
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
	const { subscribe, set, update } = writable<FilterState>(initialState);

	// Initialize the filter store for a specific route
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
			const sources = Array.from(
				new Set(data.map((item) => item.source || item.vendor).filter(Boolean))
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

	// Get default sort settings for each route
	function getDefaultSortSettings(routeId: string) {
		if (routeId.includes('beans')) {
			return { field: 'purchase_date', direction: 'desc' as const };
		} else if (routeId.includes('roast')) {
			return { field: 'roast_date', direction: 'desc' as const };
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

	// Set sort field
	function setSortField(field: string | null) {
		// Convert empty string to null for consistency
		const normalizedField = field === '' ? null : field;
		console.log('Setting sort field to:', normalizedField);
		update((state) => {
			state.sortField = normalizedField;
			// Reset sort direction if field is cleared
			if (!normalizedField) {
				state.sortDirection = null;
			}
			return state;
		});
		processAndUpdateFilteredData();
	}

	// Set sort direction
	function setSortDirection(direction: 'asc' | 'desc' | null | string) {
		// Convert empty string to null for consistency
		const normalizedDirection =
			direction === '' || direction === null ? null : (direction as 'asc' | 'desc');
		console.log('Setting sort direction to:', normalizedDirection);
		update((state) => {
			state.sortDirection = normalizedDirection;
			return state;
		});
		processAndUpdateFilteredData();
	}

	// Set filter value
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

				// Get unique sources
				if (state.originalData.some((item) => item.source || item.vendor)) {
					uniqueValues.sources = Array.from(
						new Set(state.originalData.map((item) => item.source || item.vendor).filter(Boolean))
					).sort((a, b) => a.localeCompare(b));
				}

				// Get unique purchase dates
				if (state.originalData.some((item) => item.purchase_date)) {
					uniqueValues.purchaseDates = Array.from(
						new Set(state.originalData.map((item) => item.purchase_date).filter(Boolean))
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

				// Get item value
				const itemValue = item[key];

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

	// Sort data based on sortField and sortDirection
	function sortData(
		data: any[],
		sortField: string | null,
		sortDirection: 'asc' | 'desc' | null
	): any[] {
		// Skip if no sort field or direction
		if (!sortField || !sortDirection) {
			console.log('Skipping sort - no field or direction:', { sortField, sortDirection });
			return data;
		}

		console.log('Sorting data by', sortField, sortDirection, 'with', data.length, 'items');

		return [...data].sort((a, b) => {
			const aValue = a[sortField];
			const bValue = b[sortField];

			// Handle date fields specially
			if (
				sortField === 'purchase_date' ||
				sortField === 'arrival_date' ||
				sortField === 'roast_date'
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

					// Standard date format
					return new Date(dateStr);
				};

				const dateA = parseMonthYear(aValue);
				const dateB = parseMonthYear(bValue);

				return sortDirection === 'asc'
					? dateA.getTime() - dateB.getTime()
					: dateB.getTime() - dateA.getTime();
			}

			// Handle string fields
			if (typeof aValue === 'string' && typeof bValue === 'string') {
				return sortDirection === 'asc'
					? aValue.localeCompare(bValue)
					: bValue.localeCompare(aValue);
			}

			// Handle numeric fields
			return sortDirection === 'asc'
				? (aValue || 0) - (bValue || 0)
				: (bValue || 0) - (aValue || 0);
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
				// If already processing, skip this update
				if (state.processing) {
					console.log('Already processing in timeout, skipping update');
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
							console.log('Filtered data cleared, change counter:', state.changeCounter);
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

					console.log('Data change check:', {
						lengthChanged: state.filteredData.length !== processedData.length,
						orderChanged:
							JSON.stringify(processedData.map((item) => item.id)) !==
							JSON.stringify(state.filteredData.map((item) => item.id)),
						dataChanged
					});

					// Update the filtered data
					state.filteredData = processedData;

					// Only increment the change counter if data actually changed
					if (dataChanged) {
						state.changeCounter++;
						console.log('Filtered data updated, change counter:', state.changeCounter);
					} else {
						console.log('No data change detected, not updating counter');
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

	// Get filterable columns based on route
	function getFilterableColumns(routeId: string): string[] {
		if (routeId.includes('beans')) {
			return [
				'name',
				'source',
				'score_value',
				'purchase_date',
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
			return ['name', 'source', 'region', 'processing', 'score_value', 'cost_lb'];
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
