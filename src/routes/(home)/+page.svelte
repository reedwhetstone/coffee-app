<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, tick } from 'svelte';
	import Settingsbar from '../Settingsbar.svelte';

	let { data } = $props<{ data: PageData }>();

	// Add search functionality
	let searchQuery = $state('');
	let chatResponse = $state('');
	let isLoading = $state(false);

	// State for filtered data
	let filteredData = $state<any[]>([]);

	// Pagination state
	let displayLimit = $state(15);
	let isLoadingMore = $state(false);

	// Add recommendation state
	let recommendedCoffees = $state<any[]>([]);
	let isLoadingRecommendations = $state(false);

	// Handle receiving filtered data from Settingsbar
	function handleFilteredData(newFilteredData: any[]) {
		filteredData = newFilteredData;
	}

	// Pagination computation
	let paginatedData = $derived(filteredData.slice(0, displayLimit));

	// Update infinite scroll handler
	async function handleScroll() {
		const scrollPosition = window.innerHeight + window.scrollY;
		const bottomOfPage = document.documentElement.offsetHeight - 200;

		if (scrollPosition >= bottomOfPage && !isLoadingMore && displayLimit < filteredData.length) {
			isLoadingMore = true;
			await new Promise((resolve) => setTimeout(resolve, 300));
			displayLimit += 15;
			isLoadingMore = false;
		}
	}

	// Add default query constant
	const DEFAULT_QUERY =
		'Recommend the most distinctive coffee from each source (bodhi_leaf, sweet_maria, captain_coffee), highlighting what makes it special to the supplier.';

	// Initialize data when component mounts
	$effect(() => {
		if (data?.data && filteredData.length === 0) {
			filteredData = data.data;
		}
	});

	// Load initial recommendations only once
	onMount(() => {
		// Initialize recommendations
		if (!isLoading && !chatResponse && searchQuery === '') {
			(async () => {
				searchQuery = DEFAULT_QUERY;
				await tick();
				await handleSearch();
			})();
		}

		// Setup scroll handler
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	async function handleSearch() {
		if (!searchQuery.trim()) return;

		isLoading = true;
		isLoadingRecommendations = true;
		try {
			const result = await getRecommendations(searchQuery);
			const responseText = result.response.text();

			// Find JSON content between ```json and ``` markers
			const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
			chatResponse = responseText.split('```json')[0].trim();

			if (jsonMatch && jsonMatch[1]) {
				try {
					const parsedJson = JSON.parse(jsonMatch[1].trim());
					const { recommendations } = parsedJson;

					// Fetch coffee details from the database for each recommended ID
					const coffeeDetails = await Promise.all(
						recommendations.map(async (rec: { id: string | number; reason: string }) => {
							const coffee = data.data.find(
								(c: { id: string | number }) => String(c.id) === String(rec.id)
							);
							return coffee ? { ...coffee, reason: rec.reason } : null;
						})
					);
					recommendedCoffees = coffeeDetails.filter(Boolean);
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
		}
	}

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
</script>

<div class="mx-2 mt-4 space-y-4 md:mx-8 md:mt-8">
	<div class="space-y-4">
		<!-- Integrated chat interface -->
		<div class="bg-background-tertiary-light rounded-2xl">
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSearch();
				}}
				class="space-y-4"
			>
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
								onfocus={(e) => (e.target as HTMLTextAreaElement).select()}
								oninput={(e) => {
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

		<!-- Coffee Cards -->
		<div class="flex-1">
			{#if !filteredData || filteredData.length === 0}
				<p class="p-4 text-zinc-300">No coffee data available</p>
			{:else}
				<div class="space-y-2 md:space-y-4">
					{#each paginatedData as coffee}
						<button
							type="button"
							class="bg-background-secondary-light hover:bg-background-tertiary-light w-full cursor-pointer rounded-lg p-3 text-left transition-colors md:p-4"
							onclick={() => {
								if (coffee.link) window.open(coffee.link, '_blank');
							}}
							onkeydown={(e) => {
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
							<div
								class="mt-2 grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2 sm:gap-4"
							>
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

					{#if !isLoadingMore && displayLimit < filteredData.length}
						<div class="flex justify-center p-4">
							<p class="text-primary-light text-sm">Scroll for more coffees...</p>
						</div>
					{/if}

					{#if displayLimit >= filteredData.length}
						<div class="flex justify-center p-4">
							<p class="text-primary-light text-sm">No more coffees to load</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
