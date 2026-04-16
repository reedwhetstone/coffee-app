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
	let copyLinkStatus = $state<'idle' | 'copied' | 'error'>('idle');
	let copyLinkResetTimeout: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		const currentRoute = page.url.pathname;

		if (data?.data && (!$filterStore.initialized || $filterStore.routeId !== currentRoute)) {
			filterStore.initializeForRoute(currentRoute, data.data, {
				catalogUrlState: data.initialCatalogState,
				pagination: data.pagination,
				serverData: data.data
			});
		}
	});

	let hydratedCatalogState = $derived(
		$filterStore.initialized && $filterStore.routeId === page.url.pathname
	);

	let activePagination = $derived(hydratedCatalogState ? $filterStore.pagination : data.pagination);

	let displayData = $derived((): CoffeeCatalog[] => {
		if (hydratedCatalogState) {
			return $filterStore.serverData as unknown as CoffeeCatalog[];
		}

		if (data?.data) {
			return data.data as unknown as CoffeeCatalog[];
		}

		return ($filteredData as unknown as CoffeeCatalog[]).slice(0, displayLimit);
	});

	let hasInlineFilters = $derived(
		(Array.isArray($filterStore.filters.country) && $filterStore.filters.country.length > 0) ||
			Boolean($filterStore.filters.processing) ||
			Boolean($filterStore.filters.name)
	);

	async function handleScroll() {
		if (!session) {
			return;
		}

		if (page.url.pathname.includes('/catalog') || page.url.pathname === '/') {
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
		return () => {
			window.removeEventListener('scroll', handleScroll);
			if (copyLinkResetTimeout) {
				clearTimeout(copyLinkResetTimeout);
			}
		};
	});

	function updateCopyLinkStatus(status: 'idle' | 'copied' | 'error') {
		copyLinkStatus = status;
		if (copyLinkResetTimeout) {
			clearTimeout(copyLinkResetTimeout);
		}
		if (status !== 'idle') {
			copyLinkResetTimeout = setTimeout(() => {
				copyLinkStatus = 'idle';
			}, 2500);
		}
	}

	async function copyFilteredCatalogLink() {
		const currentUrl = window.location.href;

		try {
			if (navigator.share) {
				await navigator.share({
					title: 'Purveyors Green Coffee Catalog',
					url: currentUrl
				});
				updateCopyLinkStatus('copied');
				return;
			}

			await navigator.clipboard.writeText(currentUrl);
			updateCopyLinkStatus('copied');
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			try {
				await navigator.clipboard.writeText(currentUrl);
				updateCopyLinkStatus('copied');
			} catch {
				updateCopyLinkStatus('error');
			}
		}
	}

	function parseTastingNotes(tastingNotesJson: string | null | object): TastingNotes | null {
		if (!tastingNotesJson) return null;

		try {
			let parsed: Partial<TastingNotes> & Record<string, unknown>;
			if (typeof tastingNotesJson === 'string') {
				parsed = JSON.parse(tastingNotesJson);
			} else if (typeof tastingNotesJson === 'object') {
				parsed = tastingNotesJson as Record<string, unknown>;
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
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h1 class="text-2xl font-bold text-text-primary-light sm:text-3xl">
						Green Coffee Catalog
					</h1>
					<p class="mt-2 max-w-3xl text-sm leading-relaxed text-text-secondary-light sm:text-base">
						Browse stocked green coffees from Purveyors supplier integrations with origin,
						processing, tasting context, and live pricing. Filter by origin, process, and name to
						explore what is currently available.
					</p>
				</div>
				<div class="flex flex-col items-start gap-2 sm:items-end">
					<button
						onclick={copyFilteredCatalogLink}
						class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm font-medium text-text-primary-light shadow-sm transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
					>
						{copyLinkStatus === 'copied'
							? 'Copied filtered link'
							: copyLinkStatus === 'error'
								? 'Copy failed'
								: 'Copy filtered link'}
					</button>
					<p class="text-xs text-text-secondary-light">
						Share the current catalog filters, sort, and page with one link.
					</p>
				</div>
			</div>
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

				{#if hasInlineFilters}
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
							Need more than sourcing snapshots?
						</h3>
						<p class="text-sm text-text-secondary-light">
							Stay in the buyer path here, or step into Mallard Studio when you want saved research,
							inventory, roasting, tasting, and team workflows around the coffees you shortlist.
						</p>
					</div>
					<div class="flex flex-col gap-3 sm:flex-row">
						<button
							onclick={() => goto('/subscription')}
							class="rounded-md bg-background-tertiary-light px-6 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Compare paid products
						</button>
						<button
							onclick={() => goto('/')}
							class="rounded-md border border-background-tertiary-light px-6 py-2 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
						>
							See the product overview
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
						No coffee data available {activePagination.total > 0
							? `(${activePagination.total} total items)`
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

						{#if !session && (activePagination.total > 15 || displayData().length >= 15)}
							<div class="col-span-full mt-2">
								<div
									class="rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 px-8 py-10 text-center shadow-sm ring-1 ring-amber-200"
								>
									<p class="mb-1 text-sm font-medium text-amber-700">
										You're viewing 15 of {activePagination.total || displayData().length} specialty coffees
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

						{#if session && activePagination.totalPages > 1}
							<div class="col-span-full flex items-center justify-center gap-4 p-4">
								<button
									onclick={() => filterStore.loadPrevPage()}
									disabled={!activePagination.hasPrev || $filterStore.isLoading}
									class="rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
								>
									Previous
								</button>

								<span class="text-sm text-text-secondary-light">
									Page {activePagination.page} of {activePagination.totalPages}
									({activePagination.total} total items)
								</span>

								<button
									onclick={() => filterStore.loadNextPage()}
									disabled={!activePagination.hasNext || $filterStore.isLoading}
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
