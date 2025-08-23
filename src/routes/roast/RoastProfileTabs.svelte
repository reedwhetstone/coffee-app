<script lang="ts">
	import RoastHistoryTable from './RoastHistoryTable.svelte';
	import RoastProfileDisplay from './RoastProfileDisplay.svelte';
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import type { RoastProfile } from '$lib/types/component.types';
	import type { ComponentType } from 'svelte';

	let {
		sortedBatchNames,
		sortedGroupedProfiles,
		expandedBatches,
		currentRoastProfile,
		currentProfileIndex,
		chartComponentLoading,
		RoastChartInterface,
		onToggleBatch,
		onSelectProfile,
		onProfileUpdate,
		onProfileDelete,
		onBatchDelete,
		onClearProfile,
		selectedBean,
		isPaused = $bindable(),
		fanValue = $bindable(),
		heatValue = $bindable(),
		isRoasting = $bindable(),
		selectedEvent = $bindable(),
		updateFan,
		updateHeat,
		saveRoastProfile,
		clearRoastData
	} = $props<{
		sortedBatchNames: string[];
		sortedGroupedProfiles: Record<string, any[]>;
		expandedBatches: Set<string>;
		currentRoastProfile: RoastProfile | null;
		currentProfileIndex: number;
		chartComponentLoading: boolean;
		RoastChartInterface: ComponentType | null;
		onToggleBatch: (batchName: string) => void;
		onSelectProfile: (profile: RoastProfile) => void;
		onProfileUpdate: (profile: RoastProfile) => void;
		onProfileDelete: () => void;
		onBatchDelete: () => void;
		onClearProfile: () => void;
		selectedBean: { id?: number; name: string };
		isPaused: boolean;
		fanValue: number;
		heatValue: number;
		isRoasting: boolean;
		selectedEvent: string | null;
		updateFan: (value: number) => void;
		updateHeat: (value: number) => void;
		saveRoastProfile: () => void;
		clearRoastData: () => void;
	}>();

	// Tab state management
	let viewMode = $state<'browser' | 'active'>('browser');

	// Helper function to check if element is in viewport
	function isInViewport(element: Element): boolean {
		const rect = element.getBoundingClientRect();
		return (
			rect.top >= 0 &&
			rect.left >= 0 &&
			rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
			rect.right <= (window.innerWidth || document.documentElement.clientWidth)
		);
	}

	// Auto-switch to active tab when profile is selected (but allow manual override)
	$effect(() => {
		if (currentRoastProfile && viewMode === 'browser') {
			// Only auto-switch if user hasn't manually chosen browser mode
			viewMode = 'active';
			
			// Only scroll if user is not already near the tabs
			setTimeout(() => {
				const tabsElement = document.querySelector('.tab-navigation');
				if (tabsElement && !isInViewport(tabsElement)) {
					tabsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, 100);
		}
	});

	// Reset to browser mode when no profile selected
	$effect(() => {
		if (!currentRoastProfile) {
			viewMode = 'browser';
		}
	});

	// Profile selection handler that auto-switches tab
	function handleProfileSelect(profile: RoastProfile) {
		onSelectProfile(profile);
		// Tab switching handled by effect above
	}

	// Handle Browse Profiles tab click - clear current profile and reset URL
	function handleBrowseProfilesClick() {
		viewMode = 'browser';
		
		// Clear URL profileId parameter
		const currentUrl = new URL(window.location.href);
		currentUrl.searchParams.delete('profileId');
		if (typeof window !== 'undefined') {
			window.history.replaceState({}, '', currentUrl.pathname + (currentUrl.search || ''));
		}
		
		// Clear current profile state in parent
		onClearProfile();
	}
</script>

<div class="mx-auto w-full max-w-[100vw] overflow-x-hidden">
	<!-- Tab Navigation -->
	<div class="tab-navigation border-b border-border-light bg-background-primary-light">
		<div class="flex space-x-8">
			<!-- Browse Profiles Tab -->
			<button
				class="flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium transition-colors duration-200 {viewMode ===
				'browser'
					? 'border-background-tertiary-light text-background-tertiary-light'
					: 'border-transparent text-text-secondary-light hover:border-border-light hover:text-text-primary-light'}"
				onclick={handleBrowseProfilesClick}
			>
				<span>📋</span>
				Browse Profiles
			</button>
			
			<!-- Individual Profile Tabs -->
			{#if currentRoastProfile}
				{@const batchProfiles = sortedGroupedProfiles[currentRoastProfile.batch_name] || []}
				{#each batchProfiles as profile, index}
					<button
						class="flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium transition-colors duration-200 {currentRoastProfile.roast_id === profile.roast_id
							? 'border-background-tertiary-light text-background-tertiary-light'
							: 'border-transparent text-text-secondary-light hover:border-border-light hover:text-text-primary-light'}"
						onclick={() => {
							viewMode = 'active';
							handleProfileSelect(profile);
						}}
					>
						<span>📊</span>
						#{profile.roast_id}
					</button>
				{/each}
			{/if}
		</div>
	</div>

	<!-- Tab Content -->
	<div class="min-h-[600px]">
		{#if viewMode === 'browser'}
			<!-- Browse Profiles Tab Content -->
			<div class="mt-6">
				<RoastHistoryTable
					{sortedBatchNames}
					{sortedGroupedProfiles}
					{expandedBatches}
					{currentRoastProfile}
					onToggleBatch={onToggleBatch}
					onSelectProfile={handleProfileSelect}
				/>
			</div>
		{:else if viewMode === 'active' && currentRoastProfile}
			<!-- Active Profile Tab Content -->
			<div class="mt-6 space-y-6">
				<!-- Profile Info Section -->
				<div
					class="w-full overflow-x-hidden rounded-lg border border-border-light bg-background-secondary-light p-3 shadow-md"
				>
					<RoastProfileDisplay
						profile={currentRoastProfile}
						profiles={currentRoastProfile
							? sortedGroupedProfiles[currentRoastProfile.batch_name] || []
							: []}
						currentIndex={currentProfileIndex}
						onUpdate={onProfileUpdate}
						onDelete={onProfileDelete}
						on:profileDeleted={onProfileDelete}
						on:batchDeleted={onBatchDelete}
					/>
				</div>

				<!-- Chart Interface Section -->
				<div class="rounded-lg bg-background-secondary-light p-4">
					{#if chartComponentLoading}
						<ChartSkeleton height="500px" title="Loading roasting interface..." />
					{:else if RoastChartInterface}
						<RoastChartInterface
							bind:isPaused
							{currentRoastProfile}
							bind:fanValue
							bind:heatValue
							bind:isRoasting
							bind:selectedEvent
							{updateFan}
							{updateHeat}
							{saveRoastProfile}
							{selectedBean}
							clearRoastData={clearRoastData}
						/>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>