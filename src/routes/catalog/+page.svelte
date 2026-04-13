<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { filteredData, filterStore } from '$lib/stores/filterStore';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { checkRole } from '$lib/types/auth.types';

	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import CatalogPageSkeleton from '$lib/components/CatalogPageSkeleton.svelte';

	import type { TastingNotes } from '$lib/types/coffee.types';
	import type { CoffeeCatalog } from '$lib/types/component.types';

	let { data } = $props<{ data: PageData }>();

	let { session, role = 'viewer' } = $derived(data);

	import type { UserRole } from '$lib/types/auth.types';
	let userRole: UserRole = $derived(role as UserRole);

	function hasRequiredRole(requiredRole: UserRole): boolean {
		const hasRole = checkRole(userRole, requiredRole);
		return hasRole;
	}

	let displayLimit = $state(15);
	let isLoadingMore = $state(false);

	$effect(() => {
		const currentRoute = page.url.pathname;

		if (
			data?.data?.length > 0 &&
			(!$filterStore.initialized || $filterStore.routeId !== currentRoute)
		) {
			filterStore.initializeForRoute(currentRoute, data.data);
		}
	});

	let displayData = $derived((): CoffeeCatalog[] => {
		if ($filterStore.serverData?.length > 0) {
			return $filterStore.serverData as unknown as CoffeeCatalog[];
		}
		return ($filteredData as unknown as CoffeeCatalog[]).slice(0, displayLimit);
	});

	async function handleScroll() {
		if (!session) {
			return;
		}

		if ($filterStore.routeId.includes('/catalog') || $filterStore.routeId === '/') {
			return;
		}

		const scrollPosition = window.innerHeight + window.scrollY;
		const bottomOfPage = document.documentElement.offsetHeight - 200;

		if (scrollPosition >= bottomOfPage && !isLoadingMore && displayLimit < $filteredData.length) {
			isLoadingMore = true;
			await new Promise((resolve) => setTimeout(resolve, 300));
			displayLimit += 15;
			isLoadingMore = false;
		}
	}

	onMount(() => {
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			let parsed: Partial<TastingNotes> & Record<string, unknown>;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson;
			} else {
				return null;
			}

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

{#if $filterStore.isLoading}
	<CatalogPageSkeleton />
{:else}
	<div class="space-y-4">
		<div class="rounded-lg border border-border-light bg-background-secondary-light px-5 py-4">
			<h1 class="text-2xl font-bold text-text-primary-light sm:text-3xl">Green Coffee Catalog</h1>
			<p class="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary-light sm:text-base">
				Browse stocked green coffees from Purveyors supplier integrations with origin, processing,
				tasting context, and live pricing. This is the public buyer path: compare what is available
				now, then decide whether you need workflow software, market intelligence, or API access.
			</p>
		</div>
		{#if !session}
			<div
				class="flex flex-wrap items-center gap-2 rounded-lg border border-border-light bg-background-secondary-light px-4 py-3"
			>
				<select
					value={Array.isArray($filterStore.filters.country)
						? ($filterStore.filters.country[0] ?? '')
						: ($filterStore.filters.country ?? '')}
					onchange={(e) => {
						const val = e.currentTarget.value;
						filterStore.setFilter('country', val ? [val] : []);
					}}
					class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
				>
					<option value="">Origin</option>
					{#each $filterStore.uniqueValues.countries ?? [] as country}
						<option value={country}>{country}</option>
					{/each}
				</select>

				<select
					value={$filterStore.filters.processing ?? ''}
					onchange={(e) => filterStore.setFilter('processing', e.currentTarget.value)}
					class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
				>
					<option value="">Process</option>
					{#each $filterStore.uniqueValues.processing ?? [] as process}
						<option value={process}>{process}</option>
					{/each}
				</select>

				<input
					type="search"
					value={$filterStore.filters.name ?? ''}
					oninput={(e) => filterStore.setFilter('name', e.currentTarget.value)}
					placeholder="Search coffees..."
					class="min-w-[160px] flex-1 rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
				/>

				{#if $filterStore.filters.country || $filterStore.filters.processing || $filterStore.filters.name}
					<button
						onclick={filterStore.clearFilters}
						class="rounded-md border border-border-light px-3 py-1.5 text-sm text-text-secondary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
					>
						Clear
					</button>
				{/if}
			</div>
		{/if}

		{#if session && !hasRequiredRole('member')}
			<div
				class="rounded-lg border border-background-tertiary-light/20 bg-gradient-to-r from-background-tertiary-light/10 to-harvest-gold/10 p-6"
			>
				<div class="flex flex-col items-center justify-between gap-4 sm:flex-row">
					<div class="text-center sm:text-left">
						<h3 class="text-lg font-semibold text-text-primary-light">
							Make the jump from sourcing to workflow
						</h3>
						<p class="text-sm text-text-secondary-light">
							Mallard Studio adds saved research, inventory, roasting, tasting, and operating tools
							after you find coffees here.
						</p>
					</div>
					<div class="flex flex-col gap-3 sm:flex-row">
						<button
							onclick={() => goto('/subscription')}
							class="rounded-md bg-background-tertiary-light px-6 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							See Mallard Studio
						</button>
						<button
							onclick={() => goto('/dashboard')}
							class="rounded-md border border-background-tertiary-light px-6 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							Open dashboard
						</button>
					</div>
				</div>
			</div>
		{/if}

		<div class="space-y-4">
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
						{#each session ? displayData() : displayData().slice(0, 15) as coffee}
							<CoffeeCard {coffee} {parseTastingNotes} />
						{/each}

						{#if isLoadingMore}
							<div class="flex justify-center p-4">
								<div
									class="h-8 w-8 animate-spin rounded-full border-4 border-background-primary-dark border-t-background-tertiary-light"
								></div>
							</div>
						{/if}

						{#if !session && ($filterStore.pagination.total > 15 || displayData().length >= 15)}
							<div class="col-span-full mt-2">
								<div
									class="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 px-8 py-10 text-center shadow-sm ring-1 ring-amber-200"
								>
									<p class="mb-1 text-sm font-medium text-amber-700">
										You're viewing 15 of {$filterStore.pagination.total || displayData().length} specialty
										coffees
									</p>
									<h3 class="mb-2 text-xl font-semibold text-text-primary-light">
										Keep going with a free account
									</h3>
									<p class="mb-6 text-sm text-text-secondary-light">
										Create a free account to browse the full catalog, save sourcing research, and
										unlock the next step after public market discovery.
									</p>
									<div class="flex flex-col items-center justify-center gap-3 sm:flex-row">
										<button
											onclick={() => goto('/auth')}
											class="rounded-md bg-background-tertiary-light px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-opacity-90"
										>
											Create free account
										</button>
										<button
											onclick={() => goto('/subscription')}
											class="rounded-md border border-background-tertiary-light px-6 py-2.5 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
										>
											See products
										</button>
									</div>
								</div>
							</div>
						{/if}

						{#if session && $filterStore.pagination.totalPages > 1}
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

						{#if session && !$filterStore.pagination.totalPages && !isLoadingMore && displayLimit < $filteredData.length}
							<div class="flex justify-center p-4">
								<p class="text-primary-light text-sm">Scroll for more coffees...</p>
							</div>
						{/if}

						{#if session && !$filterStore.pagination.totalPages && displayLimit >= $filteredData.length && $filteredData.length > 0}
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
