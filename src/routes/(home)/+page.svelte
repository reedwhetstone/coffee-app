<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, tick } from 'svelte';

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
						recommendations.map(async (rec: { id: string | number; reason: string }) => {
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
		'Recommend the most distinctive coffee from each source (bodhi_leaf, sweet_maria, captain_coffee), highlighting what makes it special to the supplier.';

	// Add initial load function
	async function loadInitialRecommendations() {
		if (!isLoading && !chatResponse) {
			searchQuery = DEFAULT_QUERY;
			// Trigger resize after a small delay to ensure the DOM has updated
			await tick();
			const textarea = document.querySelector('textarea');
			if (textarea) {
				textarea.style.height = 'auto';
				textarea.style.height = textarea.scrollHeight + 'px';
			}
			await handleSearch();
		}
	}

	// Add unique sources state
	$: uniqueSources = [...new Set(data?.data?.map((coffee) => coffee.source) || [])];

	// Modify filters initialization to handle source as array
	let filters: Record<string, any> = {
		score_value: { min: '', max: '' },
		source: [] as string[]
	};
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

			// Special handling for source
			if (key === 'source') {
				return value.length === 0 || value.includes(itemValue);
			}

			// Special handling for score_value
			if (key === 'score_value') {
				const score = Number(itemValue);
				return (
					(!value.min || score >= Number(value.min)) && (!value.max || score <= Number(value.max))
				);
			}

			// Default string filtering
			if (typeof value === 'string') {
				return String(itemValue).toLowerCase().includes(value.toLowerCase());
			}
			return true;
		});
	});

	// Add pagination state
	let displayLimit = 15;
	let isLoadingMore = false;

	// Update filtered and sorted data to include pagination
	$: paginatedData = filteredAndSortedData.slice(0, displayLimit);

	// Update infinite scroll handler
	async function handleScroll() {
		const scrollPosition = window.innerHeight + window.scrollY;
		const bottomOfPage = document.documentElement.offsetHeight - 200; // Trigger 200px before bottom

		if (
			scrollPosition >= bottomOfPage &&
			!isLoadingMore &&
			displayLimit < filteredAndSortedData.length
		) {
			isLoadingMore = true;
			await new Promise((resolve) => setTimeout(resolve, 300)); // Debounce
			displayLimit += 15;
			isLoadingMore = false;
		}
	}

	onMount(() => {
		loadInitialRecommendations();
		// Add scroll event listener to the window
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});
</script>

<div class="mx-2 mt-4 space-y-4 md:mx-8 md:mt-8">
	<div class="space-y-4">
		<!-- Integrated chat interface -->
		<div class="bg-background-tertiary-light rounded-2xl">
			<form on:submit|preventDefault={handleSearch} class="space-y-4">
				<!-- Query/Input area with wrapping textarea -->
				<div class="bg-background-secondary-light relative rounded-2xl p-4">
					<span class="text-primary-light text-sm">Query:</span>
					<div>
						<div class="flex items-center gap-2">
							<textarea
								bind:value={searchQuery}
								placeholder={'Search coffees or ask a question'}
								class="text-secondary-light flex-1 resize-none border-none bg-transparent font-medium placeholder-zinc-400 focus:border-none focus:outline-none focus:ring-0"
								disabled={isLoading}
								on:focus={(e) => (e.target as HTMLTextAreaElement).select()}
								on:input={(e) => {
									const textarea = e.target as HTMLTextAreaElement;
									textarea.style.height = 'auto';
									textarea.style.height = textarea.scrollHeight + 'px';
								}}
								style=" overflow-y: hidden;"
							></textarea>
							<button
								type="submit"
								class="flex h-8 w-8 items-center justify-center rounded-full border-none bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
								disabled={isLoading || !searchQuery.trim()}
							>
								{#if isLoading}
									<div
										class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
									></div>
								{:else}
									<svg
										xmlns="http://www.w3.org/2000/svg"
										class="h-4 w-4"
										viewBox="0 0 20 20"
										fill="currentColor"
									>
										<path
											fill-rule="evenodd"
											d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z"
											clip-rule="evenodd"
										/>
									</svg>
								{/if}
							</button>
						</div>
					</div>
				</div>

				<!-- Chat response -->
				{#if chatResponse}
					<div class="px-4 pb-1">
						<span class="text-primary-light text-sm">Response:</span>
						<p class="text-secondary-light mx-4 mt-1 whitespace-pre-wrap">{chatResponse}</p>
					</div>
				{/if}
				<!-- Recommendations-->
				{#if recommendedCoffees.length > 0}
					<div class="px-4 pb-4">
						<!-- Add divider here -->
						<div class="flex items-center gap-2 py-2">
							<hr class="border-background-primary-light flex-1" />
						</div>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each recommendedCoffees as coffee}
								<a
									href={coffee.link}
									target="_blank"
									class="hover:bg-background-secondary-light bg-background-tertiary-light group block rounded-lg p-4 transition-all hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<div class="flex items-center justify-between">
										<h4 class="text-secondary-light font-semibold">{coffee.name}</h4>
										<svg
											class="text-primary-light h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:text-blue-400"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
											/>
										</svg>
									</div>
									<div class="mb-2">
										<h3 class="text-secondary-light">{coffee.source}</h3>
										<span class="text-secondary-light text-sm">Score: {coffee.score_value}</span>
										<span class="text-secondary-light ml-4 text-sm">${coffee.cost_lb}/lb</span>
									</div>
									<p class="text-secondary-light mt-2 text-sm">{coffee.reason}</p>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</form>
		</div>
	</div>
</div>

<!-- Update main content layout -->
<div class="mx-2 mt-4 flex flex-col gap-4 md:mx-8 md:mt-8 md:flex-row">
	<!-- Filter Panel - Make collapsible on mobile -->
	<div class="bg-background-secondary-light rounded-lg p-4 md:w-64 md:flex-shrink-0">
		<div class="flex items-center justify-between">
			<h3 class="text-secondary-light text-lg font-semibold">Filters</h3>
			<button
				class="text-primary-light hover:text-secondary-light text-sm md:hidden"
				on:click={() => (expandedFilters = !expandedFilters)}
			>
				{expandedFilters ? 'Hide Filters' : 'Show Filters'}
			</button>
		</div>

		<!-- Wrap filter controls in a conditional display div -->
		<div class={`space-y-4 ${expandedFilters ? 'block' : 'hidden'} md:block`}>
			<!-- Sort Controls -->
			<div class="space-y-2">
				<label for="sort-field" class="text-primary-light block text-sm">Sort by</label>
				<select
					id="sort-field"
					bind:value={sortField}
					class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
				>
					<option value={null}>None</option>
					{#each getFilterableColumns() as column}
						<option value={column}>
							{column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
						</option>
					{/each}
				</select>

				{#if sortField}
					<label for="sort-direction" class="text-primary-light block text-sm">Sort Direction</label
					>
					<select
						id="sort-direction"
						bind:value={sortDirection}
						class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
					>
						<option value="asc">Ascending</option>
						<option value="desc">Descending</option>
					</select>
				{/if}
			</div>

			<!-- Filter Controls -->
			<div class="space-y-2">
				<h4 class="text-primary-light block text-sm">Filters</h4>
				{#each getFilterableColumns() as column}
					<div class="space-y-1">
						<label for={column} class="text-primary-light block text-xs">
							{column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
						</label>
						{#if column === 'source'}
							<div class="space-y-2">
								{#each uniqueSources as source}
									<label class="flex items-center gap-2">
										<input
											type="checkbox"
											bind:group={filters.source}
											value={source}
											class="border-background-primary-light bg-background-tertiary-light rounded text-blue-600"
										/>
										<span class="text-secondary-light text-sm">{source}</span>
									</label>
								{/each}
							</div>
						{:else if column === 'score_value'}
							<div class="flex gap-2">
								<input
									id={`${column}_min`}
									type="number"
									bind:value={filters[column].min}
									class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
									placeholder="Min"
									min="0"
									max="100"
									step="0.1"
								/>
								<input
									id={`${column}_max`}
									type="number"
									bind:value={filters[column].max}
									class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
									placeholder="Max"
									min="0"
									max="100"
									step="0.1"
								/>
							</div>
						{:else}
							<input
								id={column}
								type="text"
								bind:value={filters[column]}
								class="bg-background-tertiary-light text-secondary-light w-full rounded p-2 text-sm"
								placeholder={`Filter by ${column}`}
							/>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Coffee Cards - Update grid layout -->
	<div class="flex-1">
		{#if !data?.data || data.data.length === 0}
			<p class="p-4 text-zinc-300">No coffee data available</p>
		{:else}
			<div class="space-y-2 md:space-y-4">
				{#each paginatedData as coffee}
					<button
						type="button"
						class="bg-background-secondary-light hover:bg-background-tertiary-light w-full cursor-pointer rounded-lg p-3 text-left transition-colors md:p-4"
						on:click={() => {
							if (coffee.link) window.open(coffee.link, '_blank');
						}}
						on:keydown={(e) => {
							if (e.key === 'Enter' && coffee.link) window.open(coffee.link, '_blank');
						}}
					>
						<div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
							<div>
								<h3 class="text-secondary-light text-base font-semibold md:text-lg">
									{coffee.name}
								</h3>
								<p class="text-primary-light text-sm">{coffee.source}</p>
							</div>
							<div class="text-left sm:text-right">
								<p class="text-secondary-light text-base font-bold md:text-lg">
									${coffee.cost_lb}/lb
								</p>
								<p class="text-primary-light text-sm">Score: {coffee.score_value}</p>
							</div>
						</div>
						<div class="mt-2 grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2 sm:gap-4">
							<div>
								<span class="text-primary-light">Region:</span>
								{coffee.region || '-'}
							</div>
							<div>
								<span class="text-primary-light">Processing:</span>
								{coffee.processing || '-'}
							</div>
							<div>
								<span class="text-primary-light">Arrival:</span>
								{coffee.arrival_date || '-'}
							</div>
							<div>
								<span class="text-primary-light">Cultivar:</span>
								{coffee.cultivar_detail || '-'}
							</div>
						</div>
					</button>
				{/each}

				{#if isLoadingMore}
					<div class="flex justify-center p-4">
						<div
							class="h-8 w-8 animate-spin rounded-full border-4 border-zinc-400 border-t-blue-500"
						></div>
					</div>
				{/if}

				{#if !isLoadingMore && displayLimit < filteredAndSortedData.length}
					<div class="flex justify-center p-4">
						<p class="text-primary-light text-sm">Scroll for more coffees...</p>
					</div>
				{/if}

				{#if displayLimit >= filteredAndSortedData.length}
					<div class="flex justify-center p-4">
						<p class="text-primary-light text-sm">No more coffees to load</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
