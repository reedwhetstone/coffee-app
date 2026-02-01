<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { filteredData, filterStore } from '$lib/stores/filterStore';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

	// Import components
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import CatalogPageSkeleton from '$lib/components/CatalogPageSkeleton.svelte';

	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { CoffeeCatalog } from '$lib/types/component.types';

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

	// Pagination state management
	let displayLimit = $state(15);
	let isLoadingMore = $state(false);

	/**
	 * Initialize filter store when page loads
	 */
	$effect(() => {
		const currentRoute = page.url.pathname;

		// Simple initialization: only run if we have data and store isn't initialized for this route
		if (
			data?.data?.length > 0 &&
			(!$filterStore.initialized || $filterStore.routeId !== currentRoute)
		) {
			filterStore.initializeForRoute(currentRoute, data.data);
		}
	});

	/**
	 * Data source - use server data for catalog route, fallback to filtered data
	 */
	let displayData = $derived((): CoffeeCatalog[] => {
		// Use server data if available (for paginated catalog)
		if ($filterStore.serverData?.length > 0) {
			return $filterStore.serverData as unknown as CoffeeCatalog[];
		}
		// Fallback to filtered data with pagination for non-server routes
		return ($filteredData as unknown as CoffeeCatalog[]).slice(0, displayLimit);
	});

	/**
	 * Handles pagination for server-side or infinite scroll for client-side
	 */
	async function handleScroll() {
		// For server-side routes, don't use infinite scroll - use proper pagination
		if ($filterStore.routeId.includes('/catalog') || $filterStore.routeId === '/') {
			return;
		}

		// Infinite scroll for client-side routes
		const scrollPosition = window.innerHeight + window.scrollY;
		const bottomOfPage = document.documentElement.offsetHeight - 200;

		if (scrollPosition >= bottomOfPage && !isLoadingMore && displayLimit < $filteredData.length) {
			isLoadingMore = true;
			await new Promise((resolve) => setTimeout(resolve, 300));
			displayLimit += 15;
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
	 * Parses AI tasting notes JSON data safely
	 * @param tastingNotesJson - JSON string from database
	 * @returns Parsed tasting notes or null if invalid
	 */
	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			// Handle both string and object formats (Supabase jsonb can return either)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

<!-- Show skeleton during FilterStore loading -->
{#if $filterStore.isLoading}
	<CatalogPageSkeleton />
{:else}
	<!-- Coffee Catalog App for Authenticated Users -->
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
			<!-- Coffee Cards -->
			<div class="flex-1">
				{#if $filterStore.isLoading}
					<div class="flex justify-center p-8">
						<div
							class="h-8 w-8 animate-spin rounded-full border-4 border-background-primary-dark border-t-background-tertiary-light"
						></div>
					</div>
				{:else if !displayData() || displayData().length === 0}
					<p class="p-4 text-text-primary-light">
						No coffee data available {$filterStore.pagination.total > 0
							? `(${$filterStore.pagination.total} total items)`
							: ''}
					</p>
				{:else}
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						{#each displayData() as coffee}
							<CoffeeCard {coffee} {parseTastingNotes} />
						{/each}

						{#if isLoadingMore}
							<div class="flex justify-center p-4">
								<div
									class="h-8 w-8 animate-spin rounded-full border-4 border-background-primary-dark border-t-background-tertiary-light"
								></div>
							</div>
						{/if}

						<!-- Server-side pagination controls -->
						{#if $filterStore.pagination.totalPages > 1}
							<div class="col-span-full flex items-center justify-center gap-4 p-4">
								<button
									onclick={() => filterStore.loadPrevPage()}
									disabled={!$filterStore.pagination.hasPrev || $filterStore.isLoading}
									class="rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
								>
									Previous
								</button>

								<span class="text-sm text-text-secondary-light">
									Page {$filterStore.pagination.page} of {$filterStore.pagination.totalPages}
									({$filterStore.pagination.total} total items)
								</span>

								<button
									onclick={() => filterStore.loadNextPage()}
									disabled={!$filterStore.pagination.hasNext || $filterStore.isLoading}
									class="rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
								>
									Next
								</button>
							</div>
						{/if}

						<!-- Client-side infinite scroll indicators -->
						{#if !$filterStore.pagination.totalPages && !isLoadingMore && displayLimit < $filteredData.length}
							<div class="flex justify-center p-4">
								<p class="text-primary-light text-sm">Scroll for more coffees...</p>
							</div>
						{/if}

						{#if !$filterStore.pagination.totalPages && displayLimit >= $filteredData.length && $filteredData.length > 0}
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
