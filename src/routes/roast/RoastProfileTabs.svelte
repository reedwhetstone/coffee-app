<script lang="ts">
	import RoastHistoryTable from './RoastHistoryTable.svelte';
	import RoastProfileDisplay from './RoastProfileDisplay.svelte';
	import ChartSkeleton from '$lib/components/ChartSkeleton.svelte';
	import { formatDateForDisplay } from '$lib/utils/dates';
	import type { RoastProfile } from '$lib/types/component.types';
	import type { ComponentType } from 'svelte';
	import { replaceState } from '$app/navigation';

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
		saveRoastProfile: () => Promise<void>;
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

		// Clear URL profileId parameter using SvelteKit's replaceState
		const currentUrl = new URL(window.location.href);
		currentUrl.searchParams.delete('profileId');
		replaceState(currentUrl.pathname + (currentUrl.search || ''), {});

		// Clear current profile state in parent
		onClearProfile();
	}

	// Helper function for batch summary (from RoastHistoryTable)
	function getBatchSummary(profiles: any[]) {
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
					{onToggleBatch}
					onSelectProfile={handleProfileSelect}
				/>
			</div>
		{:else if viewMode === 'active' && currentRoastProfile}
			<!-- Tiered Active Profile Content -->
			{@const batchProfiles = sortedGroupedProfiles[currentRoastProfile.batch_name] || []}
			{@const batchSummary = getBatchSummary(batchProfiles)}
			<div class="mt-6">
				<!-- Tier 1: Batch Header -->
				<div class="mb-0 rounded-lg bg-background-secondary-light ring-1 ring-border-light">
					<div class="flex w-full items-center justify-between p-4">
						<div class="flex items-center gap-3">
							<div>
								<h3 class="text-lg font-semibold text-text-primary-light">
									{currentRoastProfile.batch_name}
								</h3>
								<p class="text-sm text-text-secondary-light">
									{batchSummary.count} roast{batchSummary.count !== 1 ? 's' : ''} • {formatDateForDisplay(
										batchProfiles[0]?.roast_date
									)}
								</p>
							</div>
						</div>
						<div class="hidden text-right sm:block">
							<div class="grid grid-cols-3 gap-6 text-sm">
								<div>
									<p class="text-text-secondary-light">Total Weight</p>
									<p class="font-semibold text-blue-500">{batchSummary.totalWeight} oz</p>
								</div>
								<div>
									<p class="text-text-secondary-light">Avg Loss</p>
									<p class="font-semibold text-red-500">{batchSummary.avgWeightLoss}%</p>
								</div>
								<div>
									<p class="text-text-secondary-light">Roasts</p>
									<p class="font-semibold text-purple-500">{batchSummary.count}</p>
								</div>
							</div>
						</div>
					</div>

					<!-- Tier 2: Bean Profile Sub-tabs -->
					<div class="border-t border-border-light bg-background-primary-light">
						<div class="flex space-x-1 overflow-x-auto p-2">
							{#each batchProfiles as profile}
								<button
									class="flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200 {currentRoastProfile.roast_id ===
									profile.roast_id
										? 'bg-background-tertiary-light text-white'
										: 'bg-background-secondary-light text-text-secondary-light hover:bg-background-tertiary-light hover:bg-opacity-10 hover:text-text-primary-light'}"
									onclick={() => handleProfileSelect(profile)}
								>
									{profile.coffee_name} #{profile.roast_id}
								</button>
							{/each}
						</div>
					</div>
				</div>

				<!-- Content Area: Profile Details + Chart -->
				<div class="mt-6 space-y-6">
					<!-- Profile Info Section -->
					<div
						class="w-full overflow-x-hidden rounded-lg border border-border-light bg-background-secondary-light p-3 shadow-md"
					>
						<RoastProfileDisplay
							profile={currentRoastProfile}
							profiles={batchProfiles}
							currentIndex={currentProfileIndex}
							onUpdate={onProfileUpdate}
							onProfileDeleted={onProfileDelete}
							onBatchDeleted={onBatchDelete}
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
								{clearRoastData}
							/>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
