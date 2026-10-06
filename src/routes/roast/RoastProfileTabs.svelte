<script lang="ts" module>
	/** What an action on the open roast did. `note` is a next step, not a confirmation. */
	export interface RoastActionNotice {
		message: string;
		tone?: 'status' | 'note';
		link?: { href: string; label: string };
	}
</script>

<script lang="ts">
	import RoastHistoryTable from './RoastHistoryTable.svelte';
	import RoastProfileDisplay from './RoastProfileDisplay.svelte';
	import RoastActionBar from './RoastActionBar.svelte';
	import RoastSegments from './RoastSegments.svelte';
	import RoastListControls from './RoastListControls.svelte';
	import ArtisanImportDialog from '$lib/components/roast/ArtisanImportDialog.svelte';
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import { compareHref } from '$lib/roast/compare-sides';
	import { hasRecordedRoast } from '$lib/roast/profile-picker-model';
	import { planHref } from '$lib/roast/roast-plan';
	import {
		parseBatchId,
		roastListHref,
		roastSaleHref,
		type RoastBatchGroup
	} from '$lib/roast/roast-batches';
	import type { RoastCoffeeOption } from '$lib/roast/roast-coffee-options';
	import { NO_ROAST_LIST_FILTERS, type RoastListFilters } from '$lib/roast/roast-list-filters';
	import { hasRecordedCurve, roastDetailLine, roastMilestones } from '$lib/roast/roast-summary';
	import type { RoastProfile } from '$lib/types/component.types';
	import type { ComponentType } from 'svelte';
	import type { RoastTimer } from '$lib/roast';

	let {
		batches,
		openBatchRoasts = [],
		collapsedBatches,
		currentRoastProfile,
		currentProfileIndex,
		chartComponentLoading,
		RoastChartInterface,
		countLine,
		filters = NO_ROAST_LIST_FILTERS,
		coffeeOptions = [],
		onFiltersChange = undefined,
		emptyDetail = '',
		loadedRoasts = 0,
		matchingRoasts = 0,
		hasMore = false,
		isRefreshing = false,
		isLoadingMore = false,
		loadMoreFailed = false,
		listFailed = false,
		searchInvalid = false,
		onLoadMore = undefined,
		onRetryList = undefined,
		canCreateRoast,
		actionNotice = null,
		actionInProgress = false,
		onSaveReference,
		onDownloadArtisan = undefined,
		onToggleBatch,
		onSelectProfile,
		onProfileUpdate,
		onProfileDelete,
		onDeleteBatch,
		onClearProfile,
		onClearFilters,
		coffeeFilter = null,
		onClearCoffeeFilter = undefined,
		batchFilter = null,
		onClearBatchFilter = undefined,
		onProfileRefresh,
		selectedBean,
		timer,
		fanValue = $bindable(),
		heatValue = $bindable(),
		selectedEvent = $bindable(),
		updateFan,
		updateHeat,
		saveRoastProfile,
		clearRoastData
	} = $props<{
		/** The batches the list shows, newest first, keyed by batch ID. */
		batches: RoastBatchGroup<RoastProfile>[];
		/** Every roast in the open roast's batch, the open roast included. */
		openBatchRoasts?: RoastProfile[];
		collapsedBatches: Set<string>;
		currentRoastProfile: RoastProfile | null;
		currentProfileIndex: number;
		chartComponentLoading: boolean;
		RoastChartInterface: ComponentType | null;
		/** Roasts, batches, and average loss for everything the filters match. Empty when nothing does. */
		countLine: string;
		/** The filters in the address, shown in the list's controls. */
		filters?: RoastListFilters;
		/** The member's portfolio coffees, for the coffee control. */
		coffeeOptions?: RoastCoffeeOption[];
		onFiltersChange?: (filters: RoastListFilters) => void;
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
		onLoadMore?: () => void;
		onRetryList?: () => void;
		canCreateRoast: boolean;
		/** What an action from the More menu did, shown under the actions. */
		actionNotice?: RoastActionNotice | null;
		actionInProgress?: boolean;
		onSaveReference: () => void;
		/** Downloads the Artisan file the open roast was imported from. */
		onDownloadArtisan?: () => void;
		onToggleBatch: (batchKey: string) => void;
		onSelectProfile: (profile: RoastProfile) => void;
		onProfileUpdate: (profile: RoastProfile) => void;
		onProfileDelete: () => void;
		/** Deletes one batch, by its key, once the member confirms. */
		onDeleteBatch: (batchKey: string) => void;
		onClearProfile: () => Promise<boolean>;
		onClearFilters: () => void;
		/** The portfolio coffee the list is narrowed to by `?coffee=`. */
		coffeeFilter?: { id: number; name: string | null } | null;
		onClearCoffeeFilter?: () => void;
		/** The batch the list is narrowed to by `?batch=`, named date first when it is known. */
		batchFilter?: { id: string; label: string | null } | null;
		onClearBatchFilter?: () => void;
		onProfileRefresh: (roastId: number) => Promise<void>;
		selectedBean: { id?: number; name: string };
		timer: RoastTimer;
		fanValue: number;
		heatValue: number;
		selectedEvent: string | null;
		updateFan: (value: number) => void;
		updateHeat: (value: number) => void;
		saveRoastProfile: () => Promise<void>;
		clearRoastData: () => void;
	}>();

	// "← Roasts" returns to the list with every filter it was narrowed by.
	let listHref = $derived(roastListHref(filters));

	let detailPanel = $state<RoastProfileDisplay>();
	let detailSection = $state<HTMLDivElement>();
	let artisanImportDialog = $state<ArtisanImportDialog>();

	function editDetails() {
		detailPanel?.startEditing();
		detailSection?.scrollIntoView?.({ block: 'center' });
	}

	function clearRecordedData() {
		if (confirm('Are you sure you want to clear this roast data? This action cannot be undone.')) {
			clearRoastData();
		}
	}

	// The link is a real one for the keyboard and for opening in a new tab; a plain click
	// closes the roast in place so the page holding the timer is not reloaded. The page
	// asks first while a roast is recording, and keeps the roast open if the member stays.
	function handleBackToRoasts(event: MouseEvent) {
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		void onClearProfile();
	}
</script>

{#snippet filterChip(label: string, removeLabel: string, onRemove: (() => void) | undefined)}
	<span
		class="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-panel py-1 pl-3 pr-1 text-sm font-medium text-ink ring-1 ring-line"
	>
		<span class="truncate">{label}</span>
		<button
			type="button"
			class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			aria-label={removeLabel}
			onclick={() => onRemove?.()}
		>
			<span aria-hidden="true">×</span>
		</button>
	</span>
{/snippet}

<div class="mx-auto w-full max-w-[100vw] overflow-x-hidden">
	{#if currentRoastProfile}
		{@const openBatchId = parseBatchId(currentRoastProfile.batch_id)}
		{@const otherBatchRoasts = openBatchRoasts.filter(
			(p: RoastProfile) => p.roast_id !== currentRoastProfile.roast_id
		)}
		<div class="mb-4">
			<a href={listHref} class="text-sm text-link hover:text-accent" onclick={handleBackToRoasts}>
				← Roasts
			</a>
			<h1 class="mt-2 break-words text-xl font-bold text-ink sm:text-2xl">
				{currentRoastProfile.coffee_name?.trim() || `Roast #${currentRoastProfile.roast_id}`}
			</h1>
			<p class="mt-1 text-sm text-muted">{roastDetailLine(currentRoastProfile)}</p>

			<RoastActionBar
				roastId={currentRoastProfile.roast_id}
				hasRecording={hasRecordedRoast(currentRoastProfile)}
				busy={actionInProgress}
				saleLink={roastSaleHref(currentRoastProfile)}
				{onSaveReference}
				onEditDetails={editDetails}
				onImportArtisan={() => artisanImportDialog?.open()}
				onDownloadArtisan={currentRoastProfile.artisan_file_available
					? onDownloadArtisan
					: undefined}
				onClearRecorded={clearRecordedData}
				onDeleteRoast={() => detailPanel?.deleteProfile()}
				onDeleteBatch={openBatchId ? () => onDeleteBatch(openBatchId) : undefined}
			/>
			{#if actionNotice}
				<p
					role="status"
					class="mt-3 rounded-lg p-3 text-sm {actionNotice.tone === 'note'
						? 'bg-surface-panel text-muted ring-1 ring-line'
						: 'bg-success-subtle text-success-strong'}"
				>
					{actionNotice.message}
					{#if actionNotice.link}
						<a href={actionNotice.link.href} class="font-semibold underline hover:no-underline"
							>{actionNotice.link.label}</a
						>
					{/if}
				</p>
			{/if}

			{#if hasRecordedCurve(currentRoastProfile)}
				{@const milestones = roastMilestones(currentRoastProfile)}
				<ul
					class="mt-3 grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:flex sm:flex-wrap sm:gap-x-0 sm:gap-y-1"
					aria-label="Milestones"
				>
					{#each milestones as milestone, index (milestone.key)}
						<li class="flex flex-col sm:flex-row sm:items-baseline sm:gap-1">
							<span class="text-xs text-muted sm:text-sm">{milestone.label}</span>
							<span
								class="tabular-nums {milestone.value
									? 'font-semibold text-ink'
									: 'font-medium text-muted'}"
							>
								{milestone.value ?? 'not marked'}
							</span>
							{#if index < milestones.length - 1}
								<span class="mx-2 hidden text-muted sm:inline" aria-hidden="true">·</span>
							{/if}
						</li>
					{/each}
				</ul>
			{:else if timer.isIdle}
				<p class="mt-3 text-sm text-muted">
					<span class="font-semibold text-ink">Nothing recorded for this roast yet.</span>
					Start the timer to log it live, or import the Artisan file from this roast.
				</p>
			{/if}
		</div>

		<!-- The roast is titled above, so the chart panel's own copy of the title is not drawn. -->
		<div class="rounded-lg bg-surface-panel p-4 [&_h1]:hidden">
			{#if chartComponentLoading}
				<ChartSkeleton height="500px" title="Loading roasting interface..." />
			{:else if RoastChartInterface}
				<RoastChartInterface
					{timer}
					{currentRoastProfile}
					bind:fanValue
					bind:heatValue
					bind:selectedEvent
					{updateFan}
					{updateHeat}
					{saveRoastProfile}
					{selectedBean}
					{onProfileRefresh}
					{clearRoastData}
				/>
			{/if}
		</div>

		{#if otherBatchRoasts.length > 0}
			<div class="mt-6 flex flex-wrap items-center gap-2">
				<span class="text-sm text-muted">Also in this batch:</span>
				{#each otherBatchRoasts as profile (profile.roast_id)}
					<button
						type="button"
						class="rounded-md bg-surface-panel px-3 py-2 text-sm font-medium text-muted ring-1 ring-line transition-colors duration-200 hover:text-ink hover:ring-accent focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
						onclick={() => onSelectProfile(profile)}
					>
						{profile.coffee_name} #{profile.roast_id}
					</button>
				{/each}
			</div>
		{/if}

		<div
			bind:this={detailSection}
			class="mt-6 w-full overflow-x-hidden rounded-lg border border-line bg-surface-panel p-3 shadow-md"
		>
			<RoastProfileDisplay
				bind:this={detailPanel}
				profile={currentRoastProfile}
				currentIndex={currentProfileIndex}
				onUpdate={onProfileUpdate}
				onProfileDeleted={onProfileDelete}
			/>
		</div>

		<!-- Opened from More. A file imported while this roast is recording replaces what is on screen. -->
		<ArtisanImportDialog
			bind:this={artisanImportDialog}
			roastId={currentRoastProfile.roast_id}
			lastUpdated={currentRoastProfile.last_updated}
			hasExistingData={hasRecordedCurve(currentRoastProfile) || !timer.isIdle}
			onImportComplete={() => onProfileRefresh(currentRoastProfile.roast_id)}
		/>
	{:else}
		<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-ink">Roasts</h1>
				{#if countLine}
					<p class="mt-1 text-muted" aria-live="polite">{countLine}</p>
				{/if}
				{#if coffeeFilter || batchFilter}
					<p class="mt-3 flex flex-wrap gap-2">
						{#if coffeeFilter}
							{@render filterChip(
								coffeeFilter.name ?? 'This coffee',
								'Show roasts of every coffee',
								onClearCoffeeFilter
							)}
						{/if}
						{#if batchFilter}
							{@render filterChip(
								batchFilter.label ?? 'One batch',
								'Show every batch',
								onClearBatchFilter
							)}
						{/if}
					</p>
				{/if}
			</div>
			<div class="flex flex-wrap gap-2">
				{#if canCreateRoast}
					<a
						href="/roast?modal=new"
						class="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/85"
					>
						New roast
					</a>
				{/if}
				<a
					href={compareHref()}
					class="inline-flex items-center justify-center rounded-md border border-line bg-surface-canvas px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-ink"
				>
					Compare roasts
				</a>
				<a
					href={planHref()}
					class="inline-flex items-center justify-center rounded-md border border-line bg-surface-canvas px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-ink"
				>
					Plan next roast
				</a>
			</div>
		</div>

		<RoastSegments current="roasts" />

		{#if onFiltersChange}
			<RoastListControls
				{filters}
				{coffeeOptions}
				coffeeName={coffeeFilter?.name ?? null}
				onChange={onFiltersChange}
			/>
		{/if}

		<RoastHistoryTable
			{batches}
			{collapsedBatches}
			{currentRoastProfile}
			{filters}
			{emptyDetail}
			{loadedRoasts}
			{matchingRoasts}
			{hasMore}
			{isRefreshing}
			{isLoadingMore}
			{loadMoreFailed}
			{listFailed}
			{searchInvalid}
			showLogSale={canCreateRoast}
			{onToggleBatch}
			{onSelectProfile}
			{onClearFilters}
			onClearSearch={onFiltersChange ? () => onFiltersChange({ ...filters, q: '' }) : undefined}
			{onLoadMore}
			{onRetryList}
		/>
	{/if}
</div>
