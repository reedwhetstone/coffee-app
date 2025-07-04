<script lang="ts">
	import type { PageData } from './$types';
	import { onMount, tick } from 'svelte';
	import { filteredData, filterStore, filterChangeNotifier } from '$lib/stores/filterStore';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

	// Marketing components
	import Hero from '$lib/components/marketing/Hero.svelte';
	import Features from '$lib/components/marketing/Features.svelte';
	import Pricing from '$lib/components/marketing/Pricing.svelte';
	import Testimonials from '$lib/components/marketing/Testimonials.svelte';
	import CTA from '$lib/components/marketing/CTA.svelte';
	import Footer from '$lib/components/marketing/Footer.svelte';

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

<!-- Marketing Landing Page for Non-Authenticated Users -->
{#if !session}
	<div class="min-h-screen">
		<Hero />
		<Features />
		<Testimonials />
		<Pricing />
		<CTA />
		<Footer />

		<!-- Marketplace Preview for Unauthenticated Users -->
		{#if data?.data?.length > 0}
			<div class="bg-background-secondary-light py-16">
				<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div class="mb-12 text-center">
						<h2 class="text-3xl font-bold text-text-primary-light sm:text-4xl">
							Explore Our Coffee Marketplace
						</h2>
						<p class="mt-4 text-lg text-text-secondary-light">
							Browse our curated selection of premium coffee beans from around the world
						</p>
					</div>

					<!-- Authentication Prompt Banner -->
					<div
						class="mb-8 rounded-lg border border-background-tertiary-light/20 bg-background-tertiary-light/10 p-6"
					>
						<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
							<div class="text-center sm:text-left">
								<h3 class="text-lg font-semibold text-text-primary-light">
									Sign up to unlock full features
								</h3>
								<p class="text-sm text-text-secondary-light">
									Get AI recommendations, inventory tracking, and more
								</p>
							</div>
							<div class="flex flex-col gap-3 sm:flex-row">
								<button
									onclick={() => goto('/auth')}
									class="rounded-md bg-background-tertiary-light px-6 py-2 text-white transition-all duration-200 hover:bg-opacity-90"
								>
									Sign Up Free
								</button>
								<button
									onclick={() => goto('/auth')}
									class="rounded-md border border-background-tertiary-light px-6 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
								>
									Sign In
								</button>
							</div>
						</div>
					</div>

					<!-- Coffee Cards Preview (Limited) -->
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						{#each data.data.slice(0, 6) as coffee}
							<div
								class="rounded-lg bg-background-primary-light p-4 opacity-90 shadow-sm ring-1 ring-border-light"
							>
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<h3 class="font-semibold text-text-primary-light">
											{coffee.name}
										</h3>
										<p class="mt-1 text-sm font-medium text-background-tertiary-light">
											{coffee.source}
										</p>
										{#if coffee.ai_description}
											<p class="mt-2 text-xs text-text-secondary-light">{coffee.ai_description}</p>
										{/if}
									</div>
									<div class="text-right">
										<div class="font-bold text-background-tertiary-light">${coffee.cost_lb}/lb</div>
										{#if coffee.score_value}
											<div class="mt-1 text-xs text-text-secondary-light">
												Score: {Math.round(coffee.score_value)}
											</div>
										{/if}
									</div>
								</div>
								<div
									class="mt-3 flex items-center justify-between text-xs text-text-secondary-light"
								>
									<span>{coffee.region || '-'}</span>
									<span>{coffee.processing || '-'}</span>
								</div>
							</div>
						{/each}
					</div>

					<!-- Sign Up Prompt -->
					<div class="py-8 text-center">
						<div
							class="rounded-lg border border-background-tertiary-light/20 bg-background-primary-light p-8"
						>
							<h3 class="mb-2 text-xl font-semibold text-text-primary-light">Want to see more?</h3>
							<p class="mb-4 text-text-secondary-light">
								Sign up to browse our full catalog of {data.data.length}+ premium coffee beans
							</p>
							<button
								onclick={() => goto('/auth')}
								class="rounded-md bg-background-tertiary-light px-8 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
							>
								Sign Up Free - No Credit Card Required
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
{:else}
	<!-- Full App for Authenticated Users -->
	<div class="space-y-4">
		<!-- Upgrade Banner for Viewers -->
		{#if session && !hasRequiredRole('member')}
			<div
				class="rounded-lg border border-background-tertiary-light/20 bg-gradient-to-r from-background-tertiary-light/10 to-harvest-gold/10 p-6"
			>
				<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
					<div class="text-center sm:text-left">
						<h3 class="text-lg font-semibold text-text-primary-light">
							🚀 Unlock Premium Features
						</h3>
						<p class="text-sm text-text-secondary-light">
							Get AI recommendations, roast tracking, profit analytics, and more for just $5/month
						</p>
					</div>
					<div class="flex flex-col gap-3 sm:flex-row">
						<button
							onclick={() => goto('/subscription')}
							class="rounded-md bg-background-tertiary-light px-6 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Start Free Trial
						</button>
						<button
							onclick={() =>
								document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
							class="rounded-md border border-background-tertiary-light px-6 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
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
								<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
									{#each recommendedCoffees as coffee}
										<a
											href={coffee.link}
											target="_blank"
											class="group block rounded-lg bg-background-primary-light p-4 shadow-sm ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light focus:outline-none"
										>
											<div class="flex items-start justify-between">
												<div class="flex-1">
													<h4
														class="font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
													>
														{coffee.name}
													</h4>
													<p class="mt-1 text-sm font-medium text-background-tertiary-light">
														{coffee.source}
													</p>
													{#if coffee.ai_description}
														<p class="mt-2 text-xs text-text-secondary-light">
															{coffee.ai_description}
														</p>
													{/if}
													<p class="mt-2 text-xs italic text-text-secondary-light">
														{coffee.reason}
													</p>
												</div>
												<div class="text-right">
													<div class="font-bold text-background-tertiary-light">
														${coffee.cost_lb}/lb
													</div>
													{#if coffee.score_value}
														<div class="mt-1 text-xs text-text-secondary-light">
															Score: {Math.round(coffee.score_value)}
														</div>
													{/if}
												</div>
											</div>
											<div class="mt-3 flex items-center justify-end">
												<svg
													class="h-4 w-4 text-text-secondary-light transition-transform group-hover:translate-x-1 group-hover:text-background-tertiary-light"
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
					<p class="p-4 text-text-primary-light">
						No coffee data available ({data?.data?.length || 0} items in raw data)
					</p>
				{:else}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
						{#each paginatedData as coffee}
							<button
								type="button"
								class="group rounded-lg bg-background-primary-light p-4 text-left shadow-sm ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light"
								onclick={() => {
									if (coffee.link) window.open(coffee.link, '_blank');
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' && coffee.link) window.open(coffee.link, '_blank');
								}}
							>
								<div class="flex items-start justify-between">
									<div class="flex-1">
										<h3
											class="font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
										>
											{coffee.name}
										</h3>
										<p class="mt-1 text-sm font-medium text-background-tertiary-light">
											{coffee.source}
										</p>
										{#if coffee.ai_description}
											<p class="mt-2 text-xs text-text-secondary-light">
												{coffee.ai_description}
											</p>
										{/if}
									</div>
									<div class="text-right">
										<div class="font-bold text-background-tertiary-light">${coffee.cost_lb}/lb</div>
										{#if coffee.score_value}
											<div class="mt-1 text-xs text-text-secondary-light">
												Score: {Math.round(coffee.score_value)}
											</div>
										{/if}
									</div>
								</div>

								<div class="mt-3 grid grid-cols-2 gap-2 text-xs text-text-secondary-light">
									<div class="space-y-1">
										<div><span class="font-medium">Region:</span> {coffee.region || '-'}</div>
										<div>
											<span class="font-medium">Processing:</span>
											{coffee.processing || '-'}
										</div>
									</div>
									<div class="space-y-1">
										<div>
											<span class="font-medium">Cultivar:</span>
											{coffee.cultivar_detail || '-'}
										</div>
										<div>
											<span class="font-medium">Roast Recs:</span>
											{coffee.roast_recs || '-'}
										</div>
									</div>
								</div>

								{#if coffee.arrival_date || coffee.stocked_date}
									<div class="mt-2 flex justify-between text-xs text-text-secondary-light">
										{#if coffee.arrival_date}
											<span>Arrival: {coffee.arrival_date}</span>
										{/if}
										{#if coffee.stocked_date}
											<span>Stocked: {coffee.stocked_date}</span>
										{/if}
									</div>
								{/if}

								<div class="mt-3 flex items-center justify-end">
									<svg
										class="h-4 w-4 text-text-secondary-light transition-transform group-hover:translate-x-1 group-hover:text-background-tertiary-light"
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
{/if}
