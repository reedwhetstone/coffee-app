<script lang="ts">
	import type { RoastProfile } from '$lib/types/component.types';

	// Local type to handle potential legacy fields not in the DB schema
	interface TableRoastProfile extends RoastProfile {
		roast_duration_minutes?: number;
		end_temperature?: number;
		notes?: string | null;
	}

	let {
		batches,
		collapsedBatches,
		currentRoastProfile,
		filters = NO_ROAST_LIST_FILTERS,
		emptyDetail = '',
		loadedRoasts = 0,
		matchingRoasts = 0,
		hasMore = false,
		isRefreshing = false,
		isLoadingMore = false,
		loadMoreFailed = false,
		listFailed = false,
		searchInvalid = false,
		showLogSale = false,
		onToggleBatch,
		onSelectProfile,
		onClearFilters,
		onClearSearch = undefined,
		onLoadMore = undefined,
		onRetryList = undefined
	} = $props<{
		/** The batches to list, newest first, each with the roasts to show under it. */
		batches: RoastBatchGroup<TableRoastProfile>[];
		/** Batches are open unless the roaster closed them. */
		collapsedBatches: Set<string>;
		currentRoastProfile: TableRoastProfile | null | undefined;
		/** The filters in force, to tell "none yet" from "none match". */
		filters?: RoastListFilters;
		/** What the filters in force left out, said under "No roasts match." */
		emptyDetail?: string;
		/** Roasts on screen, and roasts the filters match. */
		loadedRoasts?: number;
		matchingRoasts?: number;
		/** Whether the filters match more roasts than are loaded. */
		hasMore?: boolean;
		/** A change of filters is loading; the roasts on screen stay until it arrives. */
		isRefreshing?: boolean;
		isLoadingMore?: boolean;
		loadMoreFailed?: boolean;
		/** The list could not be loaded. */
		listFailed?: boolean;
		/** The search term cannot be used. */
		searchInvalid?: boolean;
		/** Whether a batch header offers "Log sale". */
		showLogSale?: boolean;
		onToggleBatch: (batchKey: string) => void;
		onSelectProfile: (profile: TableRoastProfile) => void;
		onClearFilters?: () => void;
		onClearSearch?: () => void;
		onLoadMore?: () => void;
		onRetryList?: () => void;
	}>();

	let safeBatches = $derived<RoastBatchGroup<TableRoastProfile>[]>(batches ?? []);

	let filtered = $derived(hasRoastListFilters(filters));

	import { formatDay } from '$lib/roast/profile-picker-model';
	import {
		batchLabel,
		batchSaleHref,
		batchSpanLabel,
		type RoastBatchGroup
	} from '$lib/roast/roast-batches';
	import {
		hasRoastListFilters,
		MAX_ROAST_SEARCH_LENGTH,
		NO_ROAST_LIST_FILTERS,
		type RoastListFilters
	} from '$lib/roast/roast-list-filters';

	let isBatchExpanded = $derived((batchKey: string) => !collapsedBatches.has(batchKey));

	// Helper functions for data calculations
	function calculateRoastDuration(profile: TableRoastProfile): string {
		// Use calculated total_roast_time from roast_profiles, fallback to roast_duration_minutes
		if (profile.total_roast_time) {
			const totalSeconds = Math.round(profile.total_roast_time);
			const minutes = Math.floor(totalSeconds / 60);
			const seconds = totalSeconds % 60;
			return `${minutes}:${seconds.toString().padStart(2, '0')}`;
		}
		if (!profile.roast_duration_minutes) return 'N/A';
		const minutes = Math.floor(profile.roast_duration_minutes);
		const seconds = Math.round((profile.roast_duration_minutes - minutes) * 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function calculateWeightLossPercentage(profile: TableRoastProfile): string {
		// Use calculated weight_loss_percent from roast_profiles, fallback to calculation
		if (profile.weight_loss_percent !== null && profile.weight_loss_percent !== undefined) {
			return `${profile.weight_loss_percent.toFixed(1)}%`;
		}
		if (!profile.oz_in || !profile.oz_out) return 'N/A';
		// Calculate weight loss percentage: (oz_in - oz_out) / oz_in * 100
		const weightLoss = ((profile.oz_in - profile.oz_out) / profile.oz_in) * 100;
		return `${weightLoss.toFixed(1)}%`;
	}

	function getDropTempDisplay(profile: TableRoastProfile): string {
		// Use calculated drop_temp from roast_profiles, fallback to end_temperature
		if (profile.drop_temp) {
			return `${Math.round(profile.drop_temp)}°F`;
		}
		if (profile.end_temperature) {
			return `${Math.round(profile.end_temperature)}°F`;
		}
		return 'N/A';
	}

	function getRoastLevelColor(profile: TableRoastProfile): string {
		// Use drop_temp if available, otherwise end_temperature
		const temp = profile.drop_temp || profile.end_temperature;
		if (!temp) return 'text-muted';
		if (temp < 400) return 'text-chart-gold'; // Light roast
		if (temp < 420) return 'text-warning'; // Medium roast
		return 'text-organic-rust'; // Dark roast
	}

	function getBatchSummary(profiles: TableRoastProfile[]) {
		const totalWeight = profiles.reduce((sum, p) => sum + (p.oz_in || 0), 0);

		// Calculate average weight loss percentage for batch summary
		const validProfiles = profiles.filter(
			(p) =>
				(p.weight_loss_percent !== null && p.weight_loss_percent !== undefined) ||
				(p.oz_in && p.oz_out)
		);
		const avgWeightLoss =
			validProfiles.length > 0
				? validProfiles.reduce((sum, p) => {
						if (p.weight_loss_percent !== null && p.weight_loss_percent !== undefined) {
							return sum + p.weight_loss_percent;
						}
						if (p.oz_in && p.oz_out) {
							return sum + ((p.oz_in - p.oz_out) / p.oz_in) * 100;
						}
						return sum;
					}, 0) / validProfiles.length
				: 0;

		return {
			totalWeight: totalWeight.toFixed(1),
			avgWeightLoss: avgWeightLoss.toFixed(1),
			count: profiles.length
		};
	}
</script>

<!-- On a phone the list ends with room under it, so its last button can be scrolled clear of
     the chat button fixed to the bottom of the screen. -->
<div
	class="w-full max-w-[100vw] overflow-x-hidden pb-24 transition-opacity duration-200 sm:pb-0"
	class:opacity-60={isRefreshing}
	aria-busy={isRefreshing}
>
	{#if searchInvalid}
		<div class="rounded-lg bg-surface-panel p-8 text-center ring-1 ring-line">
			<h3 class="text-lg font-semibold text-ink">That search cannot be used.</h3>
			<p class="mt-2 text-muted">
				Search for a coffee, a batch, or a roast number, in {MAX_ROAST_SEARCH_LENGTH} characters or fewer.
			</p>
			{#if onClearSearch}
				<button
					type="button"
					class="mt-4 rounded-md border border-accent px-4 py-2 text-accent transition-colors duration-200 hover:bg-accent hover:text-ink"
					onclick={onClearSearch}
				>
					Clear search
				</button>
			{/if}
		</div>
	{:else if listFailed}
		<div class="rounded-lg bg-danger-subtle p-8 text-center ring-1 ring-danger/30" role="alert">
			<h3 class="text-lg font-semibold text-danger-strong">Roasts could not be loaded.</h3>
			{#if onRetryList}
				<button
					type="button"
					class="mt-4 rounded-md bg-danger px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-danger-strong focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2"
					onclick={onRetryList}
				>
					Try again
				</button>
			{/if}
		</div>
	{:else if safeBatches.length === 0}
		<div class="rounded-lg bg-surface-panel p-8 text-center ring-1 ring-line">
			<svg
				class="mx-auto mb-4 h-12 w-12 text-muted opacity-60"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				aria-hidden="true"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
				/>
			</svg>
			{#if filtered}
				<h3 class="text-lg font-semibold text-ink">No roasts match.</h3>
				{#if emptyDetail}
					<p class="mt-2 text-muted">{emptyDetail}</p>
				{/if}
				{#if onClearFilters}
					<button
						type="button"
						class="mt-4 rounded-md border border-accent px-4 py-2 text-accent transition-colors duration-200 hover:bg-accent hover:text-ink"
						onclick={onClearFilters}
					>
						Clear filters
					</button>
				{/if}
			{:else}
				<h3 class="mb-2 text-lg font-semibold text-ink">No roasts yet.</h3>
				<p class="text-muted">
					Log a roast live or import one from Artisan, and it will appear here.
				</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-6">
			{#each safeBatches as batch (batch.key)}
				{@const batchKey = batch.key}
				{@const profiles = batch.roasts}
				{@const label = batchLabel(batch)}
				{@const span = batchSpanLabel(batch)}
				{@const batchSummary = getBatchSummary(profiles)}
				{@const hasWholesale = profiles.some((p: TableRoastProfile) => p.is_wholesale)}
				{@const saleLink = showLogSale ? batchSaleHref(batch) : null}
				<div class="rounded-lg bg-surface-panel ring-1 ring-line">
					<!-- Batch header: the date leads, because a name can repeat from week to week. -->
					<div class="flex items-center">
						<button
							type="button"
							class="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg p-4 text-left transition-colors hover:bg-surface-canvas focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
							onclick={() => onToggleBatch(batchKey)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									onToggleBatch(batchKey);
								}
							}}
							aria-expanded={isBatchExpanded(batchKey)}
							aria-controls="batch-{batchKey.replace(/\s+/g, '-').toLowerCase()}"
							aria-label="Toggle {batch.name} batch, {formatDay(batch.date) ??
								'no date'} ({batchSummary.count} roast{batchSummary.count !== 1 ? 's' : ''})"
						>
							<div class="flex min-w-0 items-center gap-3">
								<div class="text-ink">
									{isBatchExpanded(batchKey) ? '▼' : '▶'}
								</div>
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-1.5">
										<h3 class="break-words text-lg font-semibold text-ink">
											{label}
										</h3>
										{#if hasWholesale}
											<span class="rounded bg-info-subtle px-1 text-xs font-medium text-info-strong"
												>Wholesale</span
											>
										{/if}
									</div>
									<p class="text-sm text-muted">
										{batchSummary.count} roast{batchSummary.count !== 1 ? 's' : ''}{span
											? ` · ${span}`
											: ''}
									</p>
								</div>
							</div>
							<div class="hidden shrink-0 text-right sm:block">
								<div class="grid grid-cols-3 gap-6 text-sm">
									<div>
										<p class="text-muted">Total weight</p>
										<p class="font-semibold tabular-nums text-ink">{batchSummary.totalWeight} oz</p>
									</div>
									<div>
										<p class="text-muted">Avg loss</p>
										<p class="font-semibold tabular-nums text-ink">{batchSummary.avgWeightLoss}%</p>
									</div>
									<div>
										<p class="text-muted">Roasts</p>
										<p class="font-semibold tabular-nums text-ink">{batchSummary.count}</p>
									</div>
								</div>
							</div>
						</button>
						{#if saleLink}
							<div class="shrink-0 pl-2 pr-4">
								<a
									href={saleLink}
									class="inline-flex items-center justify-center whitespace-nowrap rounded-md border border-line bg-surface-canvas px-3 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
									aria-label="Log sale from {label}"
								>
									Log sale
								</a>
							</div>
						{/if}
					</div>

					<!-- Roast Profile Cards -->
					{#if isBatchExpanded(batchKey) && profiles.length > 0}
						<div
							class="border-t border-line bg-surface-canvas p-4"
							id="batch-{batchKey.replace(/\s+/g, '-').toLowerCase()}"
							role="region"
							aria-label="Roasts in {label}"
						>
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
								{#each profiles as profile}
									<button
										type="button"
										class="w-full rounded-lg bg-surface-panel p-4 text-left ring-1 ring-line transition-all hover:scale-[1.02] hover:ring-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 {currentRoastProfile?.roast_id ===
										profile.roast_id
											? 'ring-2 ring-accent'
											: ''}"
										onclick={() => onSelectProfile(profile)}
									>
										<div class="mb-3 flex items-start justify-between">
											<div>
												<div class="flex items-center gap-1.5">
													<h4 class="font-semibold text-ink">
														{profile.coffee_name}
													</h4>
													{#if profile.is_wholesale}
														<span
															class="rounded bg-info-subtle px-1 text-xs font-medium text-info-strong"
															>Wholesale</span
														>
													{/if}
												</div>
												<p class="text-sm text-muted">
													ID: {profile.roast_id} • {formatDay(profile.roast_date) ?? ''}
												</p>
											</div>
										</div>

										<!-- Roast Metrics Grid - Following ProfitCards Pattern -->
										<div class="grid grid-cols-2 gap-3 text-sm">
											<div>
												<p class="text-muted">Weight in</p>
												<p class="font-semibold tabular-nums text-ink">
													{profile.oz_in ? `${profile.oz_in} oz` : 'N/A'}
												</p>
											</div>
											<div>
												<p class="text-muted">Duration</p>
												<p class="font-semibold tabular-nums text-ink">
													{calculateRoastDuration(profile)}
												</p>
											</div>
											<div>
												<p class="text-muted">Loss %</p>
												<p class="font-semibold tabular-nums text-ink">
													{calculateWeightLossPercentage(profile)}
												</p>
											</div>
											<div>
												<p class="text-muted">Drop temp</p>
												<p class="font-semibold {getRoastLevelColor(profile)}">
													{getDropTempDisplay(profile)}
												</p>
											</div>
										</div>

										{#if profile.notes}
											<div class="mt-4 border-t border-line pt-4">
												<h5 class="mb-2 font-medium text-ink">Notes</h5>
												<p class="text-sm text-muted">{profile.notes}</p>
											</div>
										{/if}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if hasMore || loadMoreFailed}
			<div class="mt-6 flex flex-col items-center gap-2">
				{#if loadMoreFailed}
					<p class="text-sm text-danger" role="alert">More roasts could not be loaded.</p>
				{/if}
				<button
					type="button"
					class="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition-all duration-200 hover:bg-accent hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
					disabled={isLoadingMore || isRefreshing}
					onclick={() => onLoadMore?.()}
				>
					{isLoadingMore ? 'Loading…' : loadMoreFailed ? 'Try again' : 'Load more'}
				</button>
				<p class="text-sm text-muted">
					Showing {loadedRoasts.toLocaleString()} of {matchingRoasts.toLocaleString()} roasts
				</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		line-clamp: 2; /* Standard property for compatibility */
	}

	/* Smooth expand/collapse animation */
	.transition-transform {
		transition: transform 0.2s ease-in-out;
	}

	/* Smooth transitions for interactive elements */
	button {
		transition: all 0.15s ease-in-out;
	}
</style>
