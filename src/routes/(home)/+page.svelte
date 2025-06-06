<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, tick } from 'svelte';
	import { filteredData, filterStore, filterChangeNotifier } from '$lib/stores/filterStore';
	import { page } from '$app/stores';
	import { checkRole } from '$lib/types/auth.types';

	let { data } = $props<{ data: PageData }>();

	// Destructure with default values to prevent undefined errors
	let { supabase, session, role = 'viewer' } = $derived(data);

	// Add type checking for role
	type UserRole = 'viewer' | 'member' | 'admin';
	let userRole: UserRole = $derived(role as UserRole);

	// Use the imported checkRole function
	function hasRequiredRole(requiredRole: UserRole): boolean {
		const hasRole = checkRole(userRole, requiredRole);
		return hasRole;
	}

	// Search and AI recommendation functionality
	let searchQuery = $state('');
	let chatResponse = $state('');
	let isLoading = $state(false);

	// Pagination state management
	let displayLimit = $state(15);
	let isLoadingMore = $state(false);

	// AI recommendation state
	let recommendedCoffees = $state<any[]>([]);
	let isLoadingRecommendations = $state(false);

	// Initialization tracking to prevent duplicate filter store setup
	let initializing = $state(false);

	/**
	 * Initialize filter store when page loads
	 * Ensures the filter store is properly set up for the home route
	 */
	$effect(() => {
		const currentRoute = $page.url.pathname;

		// Initialize filter store if we have data and it's not already initialized for this route
		if (
			data?.data?.length > 0 &&
			(!$filterStore.initialized || $filterStore.routeId !== currentRoute) &&
			!initializing
		) {
			initializing = true;
			setTimeout(() => {
				filterStore.initializeForRoute(currentRoute, data.data);
				initializing = false;
			}, 0);
		}
	});

	/**
	 * Pagination state and reactive updates
	 * Manages the subset of filtered data to display based on current limit
	 * Reacts to changes in filtered data, display limit, and filter/sort operations
	 */
	let paginatedData = $state<any[]>([]);
	let updatingPagination = $state(false);
	let lastFilteredDataLength = $state(0);
	let lastDisplayLimit = $state(15);
	let lastChangeCounter = $state(0);

	$effect(() => {
		// Update pagination when filtered data changes, display limit changes, or filter/sort changes
		if (
			lastFilteredDataLength !== $filteredData.length ||
			lastDisplayLimit !== displayLimit ||
			lastChangeCounter !== $filterChangeNotifier
		) {
			// Update tracking variables to prevent unnecessary re-renders
			lastFilteredDataLength = $filteredData.length;
			lastDisplayLimit = displayLimit;
			lastChangeCounter = $filterChangeNotifier;

			// Update paginated data slice with debouncing to prevent rapid updates
			if (!updatingPagination) {
				updatingPagination = true;
				setTimeout(() => {
					try {
						paginatedData = $filteredData.slice(0, displayLimit);
					} finally {
						updatingPagination = false;
					}
				}, 0);
			}
		}
	});

	/**
	 * Handles infinite scroll functionality
	 * Loads more items when user scrolls near the bottom of the page
	 */
	async function handleScroll() {
		const scrollPosition = window.innerHeight + window.scrollY;
		const bottomOfPage = document.documentElement.offsetHeight - 200;

		if (scrollPosition >= bottomOfPage && !isLoadingMore && displayLimit < $filteredData.length) {
			isLoadingMore = true;
			await new Promise((resolve) => setTimeout(resolve, 300));
			displayLimit += 15;
			paginatedData = $filteredData.slice(0, displayLimit); // Immediately update paginated data
			isLoadingMore = false;
		}
	}

	/**
	 * Component initialization
	 * Sets up scroll event listeners
	 */
	onMount(() => {
		// Setup scroll handler
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	/**
	 * Handles AI-powered search and recommendation generation
	 * Processes user queries and returns relevant coffee recommendations or analysis
	 */
	async function handleSearch() {
		if (!searchQuery.trim()) return;

		isLoading = true;
		isLoadingRecommendations = true;
		try {
			const result = await getRecommendations(searchQuery);
			const responseText = result.response.text();
			const queryType = result.metadata?.queryType || 'recommendation';

			// Find JSON content between ```json and ``` markers
			const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
			chatResponse = responseText.split('```json')[0].trim();

			// Only process recommendations if this is a recommendation query and JSON is found
			if (queryType === 'recommendation' && jsonMatch && jsonMatch[1]) {
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
				// For analysis queries or when no JSON is found, don't show recommendations
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

	/**
	 * Makes API call to get AI recommendations or analysis
	 * @param query - The user's search query
	 * @returns Promise with AI response and metadata
	 */
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
		return {
			response: { text: () => result.text },
			metadata: result.metadata
		};
	}

	/**
	 * Helper functions for coffee score visualization
	 * These functions handle the visual representation of coffee quality scores
	 */

	/**
	 * Calculates percentage for score visualization
	 * @param score - Coffee quality score
	 * @param min - Minimum score value
	 * @param max - Maximum score value
	 * @returns Percentage value for visual representation
	 */
	function getScorePercentage(score: number, min = 80, max = 100) {
		return Math.min(100, Math.max(0, ((score - min) / (max - min)) * 100));
	}

	/**
	 * Returns appropriate color for score arc based on quality
	 * @param score - Coffee quality score
	 * @returns Hex color code
	 */
	function getStrokeColor(score: number) {
		if (score >= 90) return '#16a34a'; // green-600
		if (score >= 85) return '#65a30d'; // lime-600
		if (score >= 80) return '#ca8a04'; // yellow-600
		return '#dc2626'; // red-600
	}

	/**
	 * Returns appropriate CSS class for score text color
	 * @param score - Coffee quality score
	 * @returns Tailwind CSS class name
	 */
	function getScoreColorClass(score: number) {
		if (score >= 90) return 'text-green-600';
		if (score >= 85) return 'text-lime-600';
		if (score >= 80) return 'text-yellow-600';
		return 'text-red-600';
	}
</script>

<div class="space-y-4">
	<div class="space-y-4">
		{#if hasRequiredRole('member')}
			<!-- Integrated chat interface -->
			<div class="rounded-2xl bg-background-tertiary-light shadow-md">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSearch();
					}}
					class="space-y-4"
				>
					<!-- Query/Input area with wrapping textarea -->
					<div class="relative rounded-2xl bg-background-secondary-light p-4 shadow-md">
						<span class="text-primary-light text-sm">Query:</span>
						<div>
							<div class="flex items-center gap-2">
								<textarea
									bind:value={searchQuery}
									placeholder={'Ask for coffee recommendations or request data analysis (e.g., "analyze price trends over time")'}
									class="text-primary-light flex-1 resize-none border-none bg-transparent font-medium placeholder-text-secondary-light focus:border-none focus:outline-none focus:ring-0"
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
									class="flex h-8 w-8 items-center justify-center rounded-full border-none bg-background-tertiary-light text-text-primary-light hover:opacity-80 disabled:opacity-50"
									disabled={isLoading || !searchQuery.trim()}
								>
									{#if isLoading}
										<div
											class="h-4 w-4 animate-spin rounded-full border-2 border-text-primary-light border-t-transparent"
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
							<span class="text-primary-light text-sm">
								{recommendedCoffees.length > 0 ? 'Recommendations:' : 'Analysis:'}
							</span>
							<p class="text-primary-light mx-4 mt-1 whitespace-pre-wrap">{chatResponse}</p>
						</div>
					{/if}
					<!-- Recommendations-->
					{#if recommendedCoffees.length > 0}
						<div class="px-4 pb-4">
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{#each recommendedCoffees as coffee}
									<a
										href={coffee.link}
										target="_blank"
										class="group block rounded-lg bg-background-secondary-light p-4 shadow-md transition-all hover:scale-[1.02] hover:border hover:border-background-tertiary-light hover:bg-background-secondary-light focus:outline-none"
									>
										<div class="flex items-center justify-between">
											<h4 class="text-primary-light font-semibold">{coffee.name}</h4>
											<svg
												class="text-primary-light h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:text-background-tertiary-light"
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
											<h3 class="text-primary-light">{coffee.source}</h3>
											<span class="text-primary-light text-sm">Score: {coffee.score_value}</span>
											<span class="text-primary-light ml-4 text-sm">${coffee.cost_lb}/lb</span>
										</div>
										<p class="text-primary-light mt-2 text-sm">{coffee.reason}</p>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				</form>
			</div>
		{/if}

		<!-- Coffee Cards -->
		<div class="flex-1">
			{#if !$filteredData || $filteredData.length === 0}
				<p class="p-4 text-text-primary-light">
					No coffee data available ({data?.data?.length || 0} items in raw data)
				</p>
			{:else}
				<div class="space-y-2 md:space-y-4">
					{#each paginatedData as coffee}
						<button
							type="button"
							class="w-full cursor-pointer rounded-lg border border-border-light bg-background-secondary-light p-3 text-left shadow-md transition-colors hover:border hover:border-background-tertiary-light md:p-4"
							onclick={() => {
								if (coffee.link) window.open(coffee.link, '_blank');
							}}
							onkeydown={(e) => {
								if (e.key === 'Enter' && coffee.link) window.open(coffee.link, '_blank');
							}}
						>
							<div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
								<div>
									<h3 class="text-primary-light text-base font-semibold md:text-lg">
										{coffee.name}
									</h3>
									<p class="text-primary-light text-sm">{coffee.source}</p>
								</div>
								<div class="text-left sm:text-right">
									<p class="text-primary-light text-base font-bold md:text-lg">
										${coffee.cost_lb}/lb
									</p>
								</div>
							</div>
							<div
								class="mt-2 grid grid-cols-1 gap-2 text-sm text-text-primary-light sm:grid-cols-3 sm:gap-4"
							>
								<div class="flex flex-col gap-2">
									<div>
										<span class="text-primary-light">Region:</span>
										{coffee.region || '-'}
									</div>
									<div>
										<span class="text-primary-light">Arrival:</span>
										{coffee.arrival_date || '-'}
									</div>
								</div>
								<div class="flex flex-col gap-2">
									<div>
										<span class="text-primary-light">Processing:</span>
										{coffee.processing || '-'}
									</div>
									<div>
										<span class="text-primary-light">Cultivar:</span>
										{coffee.cultivar_detail || '-'}
									</div>
								</div>
								{#if coffee.score_value}
									<div class="mt-1 flex justify-end">
										<div class="flex flex-col items-center">
											<div class="relative h-8 w-8 sm:h-10 sm:w-10">
												<!-- Background arc -->
												<svg class="absolute inset-0" viewBox="0 0 100 100">
													<path
														d="M10,50 A40,40 0 1,1 90,50"
														fill="none"
														stroke="#e5e7eb"
														stroke-width="8"
														stroke-linecap="round"
													/>
													<!-- Foreground arc (dynamic based on score) -->
													<path
														d="M10,50 A40,40 0 1,1 90,50"
														fill="none"
														stroke={getStrokeColor(coffee.score_value)}
														stroke-width="8"
														stroke-linecap="round"
														stroke-dasharray="126"
														stroke-dashoffset={126 -
															(126 * getScorePercentage(coffee.score_value, 0, 100)) / 100}
													/>
												</svg>
												<!-- Score value in the center -->
												<div class="absolute inset-0 flex items-center justify-center">
													<span
														class="text-xs font-bold sm:text-sm {getScoreColorClass(
															coffee.score_value
														)}"
													>
														{coffee.score_value}
													</span>
												</div>

												<span
													class="text-primary-light absolute bottom-0 left-0 right-0 top-7 text-center text-xs"
													>SCORE</span
												>
											</div>
										</div>
									</div>
								{:else}
									<div class="mt-1 flex justify-end">
										<p class="text-primary-light text-sm">Score: -</p>
									</div>
								{/if}
							</div>
						</button>
					{/each}

					{#if isLoadingMore}
						<div class="flex justify-center p-4">
							<div
								class="h-8 w-8 animate-spin rounded-full border-4 border-background-primary-dark border-t-background-tertiary-light"
							></div>
						</div>
					{/if}

					{#if !isLoadingMore && displayLimit < $filteredData.length}
						<div class="flex justify-center p-4">
							<p class="text-primary-light text-sm">Scroll for more coffees...</p>
						</div>
					{/if}

					{#if displayLimit >= $filteredData.length}
						<div class="flex justify-center p-4">
							<p class="text-primary-light text-sm">No more coffees to load</p>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
