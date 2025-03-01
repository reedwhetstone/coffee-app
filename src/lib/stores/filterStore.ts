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
	lastDebounceId: null
};

// Create the store
function createFilterStore() {
	const { subscribe, set, update } = writable<FilterState>(initialState);

	// Initialize the filter store for a specific route
	function initializeForRoute(routeId: string, data: any[]) {
		update((state) => {
			// If we're already initialized for this route and the data is the same length,
			// don't reinitialize unless forced
			if (
				state.initialized &&
				state.routeId === routeId &&
				state.originalData.length === data.length &&
				state.initializingRoute !== routeId
			) {
				return state;
			}

			// If we're in the process of initializing this route, prevent duplicates
			if (state.initializingRoute === routeId) {
				return state;
			}

			// Mark that we're initializing this route
			state.initializingRoute = routeId;
			state.processing = true;

			// If the route changed, reset filters and sorting
			if (state.routeId !== routeId) {
				state.filters = {};
				state.sortField = null;
				state.sortDirection = null;

				// Set default sort for the new route if available
				const defaultSort = getDefaultSortSettings(routeId);
				if (defaultSort) {
					state.sortField = defaultSort.field;
					state.sortDirection = defaultSort.direction;
				}
			}

			// Update the route and data
			state.routeId = routeId;

			// Only update originalData if it's different to avoid unnecessary processing
			const dataString = JSON.stringify(data.map((item) => item.id || item._id));
			if (dataString !== state.lastProcessedString) {
				state.originalData = [...data];
				state.lastProcessedString = dataString;

				// Process the data to update filteredData
				state.filteredData = processData(
					state.originalData,
					state.sortField,
					state.sortDirection,
					state.filters
				);

				// Update unique values
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

				state.uniqueValues = uniqueValues;
			}

			state.initialized = true;
			state.processing = false;
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
		update((state) => {
			state.sortField = field;
			return state;
		});
		processAndUpdateFilteredData();
	}

	// Set sort direction
	function setSortDirection(direction: 'asc' | 'desc' | null) {
		update((state) => {
			state.sortDirection = direction;
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

		console.log('Filtering data with filters:', filters);

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
		if (!sortField || !sortDirection) return data;

		console.log('Sorting data by', sortField, sortDirection);

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
		console.log('After filtering:', filtered.length, 'items');

		// Then sort
		const sorted = sortData(filtered, sortField, sortDirection);
		console.log('After sorting:', sorted.length, 'items');

		return sorted;
	}

	// Process and update filtered data, with debounce to avoid rapid updates
	function processAndUpdateFilteredData() {
		// If a debounce timer exists, clear it
		const currentState = get({ subscribe });
		if (currentState.lastDebounceId) {
			clearTimeout(currentState.lastDebounceId);
		}

		// Set a new debounce timer
		const debounceId = setTimeout(() => {
			update((state) => {
				// If already processing, skip this update
				if (state.processing) {
					return state;
				}

				state.processing = true;

				try {
					if (!state.originalData || !state.originalData.length) {
						state.filteredData = [];
						state.processing = false;
						return state;
					}

					// Process the data with current filter settings
					const processedData = processData(
						state.originalData,
						state.sortField,
						state.sortDirection,
						state.filters
					);

					// Only update if the result is different
					if (
						JSON.stringify(processedData.map((item) => item.id)) !==
						JSON.stringify(state.filteredData.map((item) => item.id))
					) {
						state.filteredData = processedData;
					}
				} catch (err) {
					console.error('Error processing data:', err);
				} finally {
					state.processing = false;
					state.lastDebounceId = null;
				}

				return state;
			});
		}, 100); // 100ms debounce

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
				'vendor',
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
		setSortField,
		setSortDirection,
		setFilter,
		toggleSort,
		clearFilters,
		setDefaultSort,
		getFilterableColumns,
		filteredData
	};
}

// Export the created store
export const filterStore = createFilterStore();
export const filteredData = filterStore.filteredData;
