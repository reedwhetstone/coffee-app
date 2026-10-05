<script lang="ts">
	import RoastHistoryTable from './RoastHistoryTable.svelte';
	import RoastProfileDisplay from './RoastProfileDisplay.svelte';
	import RoastActionBar from './RoastActionBar.svelte';
	import ArtisanImportDialog from '$lib/components/roast/ArtisanImportDialog.svelte';
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import { compareHref } from '$lib/roast/compare-sides';
	import { hasRecordedRoast } from '$lib/roast/profile-picker-model';
	import { hasRecordedCurve, roastDetailLine, roastMilestones } from '$lib/roast/roast-summary';
	import type { RoastProfile } from '$lib/types/component.types';
	import type { ComponentType } from 'svelte';
	import type { RoastTimer } from '$lib/roast';

	let {
		sortedBatchNames,
		sortedGroupedProfiles,
		collapsedBatches,
		currentRoastProfile,
		currentProfileIndex,
		chartComponentLoading,
		RoastChartInterface,
		countLine,
		totalRoasts,
		canCreateRoast,
		referenceNotice = null,
		actionInProgress = false,
		onSaveReference,
		onToggleBatch,
		onSelectProfile,
		onProfileUpdate,
		onProfileDelete,
		onBatchDelete,
		onClearProfile,
		onClearFilters,
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
		sortedBatchNames: string[];
		sortedGroupedProfiles: Record<string, RoastProfile[]>;
		collapsedBatches: Set<string>;
		currentRoastProfile: RoastProfile | null;
		currentProfileIndex: number;
		chartComponentLoading: boolean;
		RoastChartInterface: ComponentType | null;
		countLine: string;
		totalRoasts: number;
		canCreateRoast: boolean;
		/** Confirmation shown under the actions after a roast is saved as a reference. */
		referenceNotice?: string | null;
		actionInProgress?: boolean;
		onSaveReference: () => void;
		onToggleBatch: (batchName: string) => void;
		onSelectProfile: (profile: RoastProfile) => void;
		onProfileUpdate: (profile: RoastProfile) => void;
		onProfileDelete: () => void;
		onBatchDelete: () => void;
		onClearProfile: () => Promise<boolean>;
		onClearFilters: () => void;
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

<div class="mx-auto w-full max-w-[100vw] overflow-x-hidden">
	{#if currentRoastProfile}
		{@const batchKey =
			Object.keys(sortedGroupedProfiles).find((key) =>
				sortedGroupedProfiles[key]?.some(
					(p: RoastProfile) => p.roast_id === currentRoastProfile.roast_id
				)
			) || ''}
		{@const otherBatchRoasts = (sortedGroupedProfiles[batchKey] || []).filter(
			(p: RoastProfile) => p.roast_id !== currentRoastProfile.roast_id
		)}
		<div class="mb-4">
			<a href="/roast" class="text-sm text-link hover:text-accent" onclick={handleBackToRoasts}>
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
				{onSaveReference}
				onEditDetails={editDetails}
				onImportArtisan={() => artisanImportDialog?.open()}
				onClearRecorded={clearRecordedData}
				onDeleteRoast={() => detailPanel?.deleteProfile()}
				onDeleteBatch={() => detailPanel?.deleteBatch()}
			/>
			{#if referenceNotice}
				<p role="status" class="mt-3 rounded-lg bg-success-subtle p-3 text-sm text-success-strong">
					{referenceNotice}
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
				onBatchDeleted={onBatchDelete}
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
				{#if sortedBatchNames.length > 0}
					<p class="mt-1 text-muted">{countLine}</p>
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
					href="#profile-studio"
					class="inline-flex items-center justify-center rounded-md border border-line bg-surface-canvas px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-ink"
				>
					Saved references and plans
				</a>
			</div>
		</div>

		<RoastHistoryTable
			{sortedBatchNames}
			{sortedGroupedProfiles}
			{collapsedBatches}
			{currentRoastProfile}
			{totalRoasts}
			{onToggleBatch}
			{onSelectProfile}
			{onClearFilters}
		/>
	{/if}
</div>
