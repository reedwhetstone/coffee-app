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
	processing: false
};

// Create the store
function createFilterStore() {
	const { subscribe, set, update } = writable<FilterState>(initialState);

	// Initialize filters for a specific route
	function initializeForRoute(routeId: string, data: any[]) {
		console.log(`Initializing filter store for route: ${routeId} with data:`, data);

		update((state) => {
			// Reset state if route has changed
			if (state.routeId !== routeId) {
				console.log(`Route changed from ${state.routeId} to ${routeId}, resetting state`);
				return {
					...initialState,
					routeId,
					originalData: data,
					filteredData: data
				};
			}

			// If same route but new data
			console.log(`Same route (${routeId}), updating data`);
			return {
				...state,
				originalData: data,
				filteredData: processData(data, state.sortField, state.sortDirection, state.filters)
			};
		});

		// Set default sort for the route
		setDefaultSort(routeId);

		// Initialize unique values for filters
		updateUniqueFilterValues();
	}

	// Set default sort based on route
	function setDefaultSort(routeId: string) {
		const defaultSorts: Record<string, { field: string; direction: 'asc' | 'desc' }> = {
			'/': { field: 'arrival_date', direction: 'desc' },
			'/beans': { field: 'purchase_date', direction: 'desc' },
			'/roast': { field: 'roast_date', direction: 'desc' }
		};

		const defaultSort = defaultSorts[routeId] || null;
		if (defaultSort) {
			console.log(
				`Setting default sort for ${routeId}: ${defaultSort.field} ${defaultSort.direction}`
			);
			setSortField(defaultSort.field);
			setSortDirection(defaultSort.direction);
		}
	}

	// Set sort field
	function setSortField(field: string | null) {
		update((state) => ({
			...state,
			sortField: field
		}));

		// Process data with new sort
		processAndUpdateFilteredData();
	}

	// Set sort direction
	function setSortDirection(direction: 'asc' | 'desc' | null) {
		update((state) => ({
			...state,
			sortDirection: direction
		}));

		// Process data with new direction
		processAndUpdateFilteredData();
	}

	// Set a specific filter value
	function setFilter(key: string, value: any) {
		update((state) => ({
			...state,
			filters: {
				...state.filters,
				[key]: value
			}
		}));

		// Process data with new filter
		processAndUpdateFilteredData();
	}

	// Toggle sort between asc, desc, and null
	function toggleSort(field: string) {
		update((state) => {
			let newDirection: 'asc' | 'desc' | null = null;
			let newField: string | null = null;

			if (state.sortField === field) {
				if (state.sortDirection === 'asc') {
					newDirection = 'desc';
					newField = field;
				} else if (state.sortDirection === 'desc') {
					newDirection = null;
					newField = null;
				}
			} else {
				newDirection = 'asc';
				newField = field;
			}

			return {
				...state,
				sortField: newField,
				sortDirection: newDirection
			};
		});

		// Process data with new sort
		processAndUpdateFilteredData();
	}

	// Clear all filters
	function clearFilters() {
		update((state) => ({
			...state,
			filters: {}
		}));

		// Process data with cleared filters
		processAndUpdateFilteredData();
	}

	// Update unique values for filters based on current data
	function updateUniqueFilterValues() {
		update((state) => {
			const uniqueValues: Record<string, any[]> = {};

			if (!state.originalData?.length) {
				console.log('No original data found for generating unique filter values');
				return { ...state, uniqueValues };
			}

			console.log(`Updating unique filter values for route: ${state.routeId}`);

			switch (state.routeId) {
				case '/':
					uniqueValues.sources = [
						...new Set(state.originalData.map((item: any) => item.source))
					].filter(Boolean);
					break;
				case '/beans':
					uniqueValues.purchaseDates = [
						...new Set(state.originalData.map((item: any) => item.purchase_date))
					]
						.filter(Boolean)
						.sort((a, b) => b.localeCompare(a));
					break;
				case '/roast':
					uniqueValues.roastDates = [
						...new Set(state.originalData.map((item: any) => item.roast_date))
					]
						.filter(Boolean)
						.sort((a, b) => b.localeCompare(a));

					uniqueValues.batchNames = [
						...new Set(state.originalData.map((item: any) => item.batch_name))
					].filter(Boolean);
					break;
			}

			console.log('Generated unique values:', uniqueValues);

			return {
				...state,
				uniqueValues
			};
		});
	}

	// Filter data based on current filters
	function filterData(data: any[], filters: Record<string, any>): any[] {
		if (!data?.length || !filters) return data;

		console.log('Filtering data with filters:', filters);

		return data.filter((item) => {
			return Object.entries(filters).every(([key, value]) => {
				if (!value) return true;
				const itemValue = item[key];

				// Handle special cases for different filter types
				if (key === 'source' && Array.isArray(value)) {
					return value.length === 0 || value.includes(itemValue);
				}

				if (key === 'score_value' && typeof value === 'object') {
					const score = Number(itemValue);
					return (
						(!value.min || score >= Number(value.min)) && (!value.max || score <= Number(value.max))
					);
				}

				// Default string filtering
				if (typeof value === 'string') {
					return String(itemValue || '')
						.toLowerCase()
						.includes(value.toLowerCase());
				}

				return true;
			});
		});
	}

	// Sort data based on current sort settings
	function sortData(
		data: any[],
		sortField: string | null,
		sortDirection: 'asc' | 'desc' | null
	): any[] {
		if (!sortField || !sortDirection || !data?.length) return data;

		console.log(`Sorting data by ${sortField} ${sortDirection}`);

		return [...data].sort((a, b) => {
			const aVal = a[sortField];
			const bVal = b[sortField];

			// Special handling for dates
			if (
				sortField === 'arrival_date' ||
				sortField === 'purchase_date' ||
				sortField === 'roast_date'
			) {
				if (!aVal && !bVal) return 0;
				if (!aVal) return sortDirection === 'asc' ? -1 : 1;
				if (!bVal) return sortDirection === 'asc' ? 1 : -1;

				if (sortField === 'arrival_date') {
					// Parse month/year format
					const parseMonthYear = (dateStr: string): Date => {
						const [month, year] = dateStr.split(' ');
						const monthIndex = new Date(Date.parse(month + ' 1, 2000')).getMonth();
						return new Date(parseInt(year), monthIndex);
					};

					const dateA = parseMonthYear(aVal as string);
					const dateB = parseMonthYear(bVal as string);

					return sortDirection === 'asc'
						? dateA.getTime() - dateB.getTime()
						: dateB.getTime() - dateA.getTime();
				} else {
					const aStr = String(aVal);
					const bStr = String(bVal);

					return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
				}
			}

			// String comparison
			if (typeof aVal === 'string' && typeof bVal === 'string') {
				return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
			}

			// Number comparison
			return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
		});
	}

	// Process data through filtering and sorting
	function processData(
		data: any[],
		sortField: string | null,
		sortDirection: 'asc' | 'desc' | null,
		filters: Record<string, any>
	): any[] {
		if (!data?.length) {
			console.log('No data to process');
			return [];
		}

		console.log(`Processing data: ${data.length} items`);

		const filteredResults = filterData(data, filters);
		console.log(`After filtering: ${filteredResults.length} items`);

		const sortedResults = sortData(filteredResults, sortField, sortDirection);
		console.log(`After sorting: ${sortedResults.length} items`);

		return sortedResults;
	}

	// Process and update filtered data with debounce
	let processTimeout: ReturnType<typeof setTimeout> | null = null;
	function processAndUpdateFilteredData() {
		if (processTimeout) {
			clearTimeout(processTimeout);
		}

		console.log('Scheduling data processing...');

		processTimeout = setTimeout(() => {
			update((state) => {
				if (state.processing) {
					console.log('Already processing, skipping update');
					return state;
				}

				console.log('Starting data processing');
				state.processing = true;

				try {
					const newFilteredData = processData(
						state.originalData,
						state.sortField,
						state.sortDirection,
						state.filters
					);

					// Check if the data has actually changed
					const newDataString = JSON.stringify(newFilteredData);

					if (state.lastProcessedString !== newDataString) {
						console.log(`Data changed, updating filtered data (${newFilteredData.length} items)`);
						return {
							...state,
							filteredData: newFilteredData,
							lastProcessedString: newDataString,
							processing: false
						};
					}

					console.log('Data unchanged, skipping update');
					return {
						...state,
						processing: false
					};
				} catch (error) {
					console.error('Error processing data:', error);
					return {
						...state,
						processing: false
					};
				}
			});

			processTimeout = null;
		}, 50);
	}

	// Get filterable columns based on route
	function getFilterableColumns(routeId: string): string[] {
		switch (routeId) {
			case '/':
				return [
					'source',
					'name',
					'processing',
					'region',
					'cost_lb',
					'score_value',
					'arrival_date',
					'harvest_date',
					'cultivar_detail'
				];
			case '/beans':
				return [
					'name',
					'purchase_date',
					'score_value',
					'rank',
					'cultivar_detail',
					'processing',
					'vendor',
					'price_per_lb',
					'arrival_date'
				];
			case '/roast':
				return ['coffee_name', 'batch_name', 'roast_date', 'notes'];
			default:
				return [];
		}
	}

	return {
		subscribe,
		initializeForRoute,
		setSortField,
		setSortDirection,
		setFilter,
		toggleSort,
		clearFilters,
		getFilterableColumns
	};
}

// Create and export the store instance
export const filterStore = createFilterStore();

// Derived store for filtered data only
export const filteredData = derived(filterStore, ($filterStore) => $filterStore.filteredData);
