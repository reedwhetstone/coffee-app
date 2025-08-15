<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { filteredData, filterStore, filterChangeNotifier } from '$lib/stores/filterStore';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

	// Import components
	import TastingNotesRadar from '$lib/components/TastingNotesRadar.svelte';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import type { TastingNotes } from '$lib/types/coffee.types';

	let { data } = $props<{ data: PageData }>();

	// Destructure with default values to prevent undefined errors
	let { session, role = 'viewer' } = $derived(data);

	// Import global UserRole type
	import type { UserRole } from '$lib/types/auth.types';
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
	 * Ensures the filter store is properly set up for the catalog route
	 */
	$effect(() => {
		const currentRoute = page.url.pathname;

		// Initialize filter store if we have data and it's not already initialized for this route
		if (
			data?.data?.length > 0 &&
			(!$filterStore.initialized || $filterStore.routeId !== currentRoute) &&
			!initializing
		) {
			initializing = true;
			// Use requestIdleCallback for better performance if available
			if (typeof requestIdleCallback !== 'undefined') {
				requestIdleCallback(() => {
					filterStore.initializeForRoute(currentRoute, data.data);
					initializing = false;
				});
			} else {
				// Fallback for older browsers
				setTimeout(() => {
					filterStore.initializeForRoute(currentRoute, data.data);
					initializing = false;
				}, 0);
			}
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
	 * Parses AI tasting notes JSON data safely
	 * @param tastingNotesJson - JSON string from database
	 * @returns Parsed tasting notes or null if invalid
	 */
	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			// Handle both string and object formats (Supabase jsonb can return either)
			let parsed: any;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson;
			} else {
				return null;
			}

			// Validate that required properties exist
			if (
				parsed.body &&
				parsed.flavor &&
				parsed.acidity &&
				parsed.sweetness &&
				parsed.fragrance_aroma
			) {
				return parsed as TastingNotes;
			}
		} catch (error) {
			console.warn('Failed to parse tasting notes:', error, 'Input:', tastingNotesJson);
		}
		return null;
	}
</script>

<!-- Coffee Catalog App for Authenticated Users -->
<div class="space-y-4">
	<!-- Upgrade Banner for Viewers -->
	{#if session && !hasRequiredRole('member')}
		<div
			class="border-background-tertiary-light/20 from-background-tertiary-light/10 to-harvest-gold/10 rounded-lg border bg-gradient-to-r p-6"
		>
			<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
				<div class="text-center sm:text-left">
					<h3 class="text-text-primary-light text-lg font-semibold">🚀 Unlock Premium Features</h3>
					<p class="text-text-secondary-light text-sm">
						Get AI recommendations, roast tracking, profit analytics, and more for just $5/month
					</p>
				</div>
				<div class="flex flex-col gap-3 sm:flex-row">
					<button
						onclick={() => goto('/subscription')}
						class="bg-background-tertiary-light rounded-md px-6 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
					>
						Start Free Trial
					</button>
					<button
						onclick={() =>
							document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
						class="border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light rounded-md border px-6 py-2 transition-all duration-200 hover:text-white"
					>
						Learn More
					</button>
				</div>
			</div>
		</div>
	{/if}

	<div class="space-y-4">
		{#if hasRequiredRole('member')}
			<!-- Integrated chat interface -->
			<div class="bg-background-tertiary-light rounded-2xl shadow-md">
				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSearch();
					}}
					class="space-y-4"
				>
					<!-- Query/Input area with wrapping textarea -->
					<div class="bg-background-secondary-light relative rounded-2xl p-4 shadow-md">
						<span class="text-primary-light text-sm">Query:</span>
						<div>
							<div class="flex items-center gap-2">
								<textarea
									bind:value={searchQuery}
									placeholder={'Ask for coffee recommendations or request data analysis (e.g., "analyze price trends over time")'}
									class="text-primary-light placeholder-text-secondary-light flex-1 resize-none border-none bg-transparent font-medium focus:border-none focus:outline-none focus:ring-0"
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
									class="bg-background-tertiary-light text-text-primary-light flex h-8 w-8 items-center justify-center rounded-full border-none hover:opacity-80 disabled:opacity-50"
									disabled={isLoading || !searchQuery.trim()}
								>
									{#if isLoading}
										<div
											class="border-text-primary-light h-4 w-4 animate-spin rounded-full border-2 border-t-transparent"
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
							<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
								{#each recommendedCoffees as coffee}
									<a
										href={coffee.link}
										target="_blank"
										class="bg-background-primary-light ring-border-light hover:ring-background-tertiary-light group block rounded-lg p-4 shadow-sm ring-1 transition-all hover:scale-[1.02] focus:outline-none"
									>
										<div class="flex items-start justify-between">
											<div class="flex-1">
												<h4
													class="text-text-primary-light group-hover:text-background-tertiary-light font-semibold"
												>
													{coffee.name}
												</h4>
												<p class="text-background-tertiary-light mt-1 text-sm font-medium">
													{coffee.source}
												</p>
												{#if coffee.ai_description}
													<p class="text-text-secondary-light mt-2 text-xs">
														{coffee.ai_description}
													</p>
												{/if}
												<p class="text-text-secondary-light mt-2 text-xs italic">
													{coffee.reason}
												</p>
											</div>
											<div class="flex flex-col items-end space-y-2">
												<div class="text-right">
													<div class="text-background-tertiary-light font-bold">
														${coffee.cost_lb}/lb
													</div>
													{#if coffee.score_value}
														<div class="text-text-secondary-light mt-1 text-xs">
															Score: {Math.round(coffee.score_value)}
														</div>
													{/if}
												</div>
												{#if coffee.ai_tasting_notes}
													<TastingNotesRadar
														tastingNotes={parseTastingNotes(coffee.ai_tasting_notes)}
														size={80}
														lazy={true}
													/>
												{/if}
											</div>
										</div>
										<div class="mt-3 flex items-center justify-end">
											<svg
												class="text-text-secondary-light group-hover:text-background-tertiary-light h-4 w-4 transition-transform group-hover:translate-x-1"
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
				<p class="text-text-primary-light p-4">
					No coffee data available ({data?.data?.length || 0} items in raw data)
				</p>
			{:else}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					{#each paginatedData as coffee}
						<CoffeeCard {coffee} {parseTastingNotes} />
					{/each}

					{#if isLoadingMore}
						<div class="flex justify-center p-4">
							<div
								class="border-background-primary-dark border-t-background-tertiary-light h-8 w-8 animate-spin rounded-full border-4"
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
