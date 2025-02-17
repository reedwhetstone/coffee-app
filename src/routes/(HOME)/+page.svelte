<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';

	export let data: PageData;

	// Add search functionality
	let searchQuery = '';
	let chatResponse = '';
	let isLoading = false;

	// Add sorting functionality
	let sortField: string | null = 'arrival_date';
	let sortDirection: 'asc' | 'desc' | null = 'desc';

	// Sorting function
	function toggleSort(field: string) {
		if (sortField === field) {
			if (sortDirection === 'asc') sortDirection = 'desc';
			else if (sortDirection === 'desc') {
				sortField = null;
				sortDirection = null;
			}
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	// Add helper function for date parsing
	function parseMonthYear(dateStr: string | null): Date {
		if (!dateStr) return new Date(0); // Return earliest possible date if null
		const [month, year] = dateStr.split(' ');
		const monthIndex = new Date(Date.parse(month + ' 1, 2000')).getMonth();
		return new Date(parseInt(year), monthIndex);
	}

	// Update sorted data (removed search filtering)
	$: sortedData = data?.data
		? [...data.data].sort((a, b) => {
				if (!sortField || !sortDirection) return 0;

				const aVal = a[sortField as keyof typeof a];
				const bVal = b[sortField as keyof typeof b];

				// Special handling for arrival_date
				if (sortField === 'arrival_date') {
					// Handle null values in sorting
					if (!aVal && !bVal) return 0;
					if (!aVal) return sortDirection === 'asc' ? -1 : 1;
					if (!bVal) return sortDirection === 'asc' ? 1 : -1;

					const dateA = parseMonthYear(aVal as string);
					const dateB = parseMonthYear(bVal as string);
					return sortDirection === 'asc'
						? dateA.getTime() - dateB.getTime()
						: dateB.getTime() - dateA.getTime();
				}

				if (typeof aVal === 'string' && typeof bVal === 'string') {
					return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
				}

				return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
			})
		: [];

	// Add function to get ordered keys
	function getOrderedKeys(obj: any): string[] {
		if (!obj) return [];
		return [
			'id',
			'source',
			'name',
			'processing',
			'region',
			'cost_lb',
			'score_value',
			'arrival_date',
			'harvest_date',
			'cultivar_detail',
			'description_short',
			'cupping_notes',
			'last_updated'
		];
	}

	// Add recommendation state
	let recommendedCoffees: any[] = [];
	let isLoadingRecommendations = false;

	// Remove the separate handleChat function and modify handleSearch to only use getRecommendations
	async function handleSearch() {
		if (!searchQuery.trim()) return;

		isLoading = true;
		isLoadingRecommendations = true;
		try {
			const result = await getRecommendations(searchQuery);
			//console.log('Raw AI response:', result.response);
			const responseText = result.response.text();
			//console.log('Response text:', responseText);

			// Find JSON content between ```json and ``` markers
			const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
			//console.log('JSON match:', jsonMatch);

			// Everything before the JSON is the natural language response
			chatResponse = responseText.split('```json')[0].trim();

			if (jsonMatch && jsonMatch[1]) {
				try {
					const parsedJson = JSON.parse(jsonMatch[1].trim());
					//	console.log('Parsed JSON:', parsedJson);
					const { recommendations } = parsedJson;
					//	console.log('Recommendations:', recommendations);

					// Fetch coffee details from the database for each recommended ID
					const coffeeDetails = await Promise.all(
						recommendations.map(async (rec) => {
							// Convert both IDs to strings for comparison
							const coffee = data.data.find((c) => String(c.id) === String(rec.id));
							console.log('Found coffee for ID:', rec.id, coffee);
							return coffee ? { ...coffee, reason: rec.reason } : null;
						})
					);
					recommendedCoffees = coffeeDetails.filter(Boolean);
					console.log('Final recommended coffees:', recommendedCoffees);
				} catch (jsonError) {
					console.error('JSON parsing error:', jsonError);
					recommendedCoffees = [];
				}
			} else {
				console.log('No JSON match found in response');
				recommendedCoffees = [];
			}
		} catch (error) {
			console.error('Search error:', error);
			chatResponse = 'An error occurred while processing your request.';
			recommendedCoffees = [];
		} finally {
			isLoading = false;
			isLoadingRecommendations = false;
			searchQuery = '';
		}
	}

	// Update getRecommendations to return the result instead of processing it
	async function getRecommendations(query: string) {
		const response = await fetch('/api/LLM', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				prompt: query,
				coffeeData: data.data
			})
		});

		if (!response.ok) {
			throw new Error('Failed to get recommendations');
		}

		const result = await response.json();
		return { response: { text: () => result.text } };
	}

	// Add default query constant
	const DEFAULT_QUERY =
		'Provide a coffee reccomendation from each source - bodhi leaf, captains coffee, and sweet marias';

	// Add initial load function
	async function loadInitialRecommendations() {
		if (!isLoading && !chatResponse) {
			searchQuery = DEFAULT_QUERY;
			await handleSearch();
		}
	}

	onMount(() => {
		loadInitialRecommendations();
	});

	// Add filter state
	let filters: Record<string, any> = {};
	let expandedFilters = false;

	// Helper to get filterable columns (excluding long-form text fields)
	function getFilterableColumns(): string[] {
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
	}

	// Update the sorted data to include filtering
	$: filteredAndSortedData = sortedData.filter((item) => {
		return Object.entries(filters).every(([key, value]) => {
			if (!value) return true;
			const itemValue = item[key as keyof typeof item];
			if (typeof value === 'string') {
				return String(itemValue).toLowerCase().includes(value.toLowerCase());
			}
			return true;
		});
	});
</script>

<div class="mx-8 mt-8 space-y-4">
	<!-- Add search and chat interface -->
	<div class="mx-8 mt-8 space-y-4">
		<div class="flex gap-4">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search coffees or ask a question..."
				class="flex-1 rounded-lg bg-zinc-700 px-4 py-2 text-zinc-100 placeholder-zinc-400"
			/>
			<button
				on:click={handleSearch}
				class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
				disabled={isLoading}
			>
				{isLoading ? 'Processing...' : 'YOLO!'}
			</button>
		</div>

		{#if chatResponse}
			<div class="rounded-lg bg-zinc-700 p-4 text-zinc-100">
				<p class="whitespace-pre-wrap">{chatResponse}</p>
			</div>
		{/if}
	</div>

	<!-- Add recommendations UI -->
	{#if recommendedCoffees.length > 0}
		<div class="mt-8">
			<h3 class="mb-4 text-xl font-semibold text-zinc-100">Recommended Coffees</h3>
			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				{#each recommendedCoffees as coffee}
					<a
						href={coffee.link}
						target="_blank"
						class="block rounded-lg bg-zinc-700 p-4 transition-colors hover:bg-zinc-800 hover:shadow-md"
					>
						<h4 class="font-semibold text-zinc-100">{coffee.name}</h4>
						<h3 class="text-zinc-100">{coffee.source}</h3>
						<p class="mt-2 text-sm text-zinc-100">{coffee.reason}</p>
						<div class="mt-4">
							<span class="text-sm text-zinc-100">Score: {coffee.score_value}</span>
							<span class="ml-4 text-sm text-zinc-100">${coffee.cost_lb}/lb</span>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>

<div class="my-8 mt-8 flex gap-4">
	<!-- Filter Panel -->
	<div class="w-64 flex-shrink-0 space-y-4 rounded-lg bg-zinc-800 p-4">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-zinc-100">Filters</h3>
			<button
				class="text-sm text-zinc-400 hover:text-zinc-100"
				on:click={() => (expandedFilters = !expandedFilters)}
			>
				{expandedFilters ? 'Collapse' : 'Expand'}
			</button>
		</div>

		<!-- Sort Controls -->
		<div class="space-y-2">
			<label class="block text-sm text-zinc-400">Sort by</label>
			<select bind:value={sortField} class="w-full rounded bg-zinc-700 p-2 text-sm text-zinc-100">
				<option value={null}>None</option>
				{#each getFilterableColumns() as column}
					<option value={column}>
						{column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
					</option>
				{/each}
			</select>

			{#if sortField}
				<select
					bind:value={sortDirection}
					class="w-full rounded bg-zinc-700 p-2 text-sm text-zinc-100"
				>
					<option value="asc">Ascending</option>
					<option value="desc">Descending</option>
				</select>
			{/if}
		</div>

		<!-- Filter Controls -->
		<div class="space-y-2">
			<label class="block text-sm text-zinc-400">Filters</label>
			{#each getFilterableColumns() as column}
				<div class="space-y-1">
					<label class="block text-xs text-zinc-400">
						{column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
					</label>
					<input
						type="text"
						bind:value={filters[column]}
						class="w-full rounded bg-zinc-700 p-2 text-sm text-zinc-100"
						placeholder={`Filter by ${column}`}
					/>
				</div>
			{/each}
		</div>
	</div>

	<!-- Coffee Cards -->
	<div class="flex-1">
		{#if !data?.data || data.data.length === 0}
			<p class="p-4 text-zinc-300">No coffee data available</p>
		{:else}
			<div class="space-y-4">
				{#each filteredAndSortedData as coffee}
					<div
						class="cursor-pointer rounded-lg bg-zinc-800 p-4 transition-colors hover:bg-zinc-700"
						on:click={() => {
							if (coffee.link) window.open(coffee.link, '_blank');
						}}
					>
						<div class="flex justify-between">
							<div>
								<h3 class="text-lg font-semibold text-zinc-100">{coffee.name}</h3>
								<p class="text-sm text-zinc-400">{coffee.source}</p>
							</div>
							<div class="text-right">
								<p class="text-lg font-bold text-zinc-100">${coffee.cost_lb}/lb</p>
								<p class="text-sm text-zinc-400">Score: {coffee.score_value}</p>
							</div>
						</div>
						<div class="mt-2 grid grid-cols-2 gap-4 text-sm text-zinc-300">
							<div>
								<span class="text-zinc-400">Region:</span>
								{coffee.region || '-'}
							</div>
							<div>
								<span class="text-zinc-400">Processing:</span>
								{coffee.processing || '-'}
							</div>
							<div>
								<span class="text-zinc-400">Arrival:</span>
								{coffee.arrival_date || '-'}
							</div>
							<div>
								<span class="text-zinc-400">Harvest:</span>
								{coffee.harvest_date || '-'}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
