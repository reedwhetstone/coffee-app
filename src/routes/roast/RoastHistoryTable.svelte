<script lang="ts">
	let {
		sortedBatchNames,
		sortedGroupedProfiles,
		expandedBatches,
		currentRoastProfile,
		onToggleBatch,
		onSelectProfile
	} = $props<{
		sortedBatchNames: string[];
		sortedGroupedProfiles: Record<string, any[]>;
		expandedBatches: Set<string>;
		currentRoastProfile: any;
		onToggleBatch: (batchName: string) => void;
		onSelectProfile: (profile: any) => void;
	}>();

	// Set defaults after destructuring
	sortedBatchNames = sortedBatchNames ?? [];
	sortedGroupedProfiles = sortedGroupedProfiles ?? {};

	import { formatDateForDisplay } from '$lib/utils/dates';

	let isBatchExpanded = $derived((batchName: string) => expandedBatches.has(batchName));

	// Helper functions for data calculations
	function calculateRoastDuration(profile: any): string {
		if (!profile.roast_duration_minutes) return 'N/A';
		const minutes = Math.floor(profile.roast_duration_minutes);
		const seconds = Math.round((profile.roast_duration_minutes - minutes) * 60);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function calculateYieldPercentage(profile: any): string {
		if (!profile.oz_in || !profile.oz_out) return 'N/A';
		return `${Math.round((profile.oz_out / profile.oz_in) * 100)}%`;
	}

	function getRoastLevelColor(endTemp: number | null): string {
		if (!endTemp) return 'text-text-secondary-light';
		if (endTemp < 400) return 'text-yellow-600'; // Light roast
		if (endTemp < 420) return 'text-amber-600'; // Medium roast
		return 'text-orange-700'; // Dark roast
	}

	function getRoastCompletionStatus(profile: any): {
		status: string;
		color: string;
		bgColor: string;
	} {
		if (profile.oz_out && profile.oz_in) {
			return { status: 'Complete', color: 'text-green-700', bgColor: 'bg-green-100' };
		}
		if (profile.roast_duration_minutes > 0) {
			return { status: 'In Progress', color: 'text-blue-700', bgColor: 'bg-blue-100' };
		}
		return { status: 'Started', color: 'text-gray-700', bgColor: 'bg-gray-100' };
	}

	function getBatchSummary(profiles: any[]) {
		const totalWeight = profiles.reduce((sum, p) => sum + (p.oz_in || 0), 0);
		const avgYield =
			profiles.reduce((sum, p) => {
				if (p.oz_in && p.oz_out) {
					return sum + p.oz_out / p.oz_in;
				}
				return sum;
			}, 0) / profiles.length;

		return {
			totalWeight: totalWeight.toFixed(1),
			avgYield: avgYield ? Math.round(avgYield * 100) : 0,
			count: profiles.length
		};
	}
</script>

<div class="w-full max-w-[100vw] overflow-x-hidden">
	{#if !sortedBatchNames || sortedBatchNames.length === 0}
		<div class="rounded-lg bg-background-secondary-light p-8 text-center ring-1 ring-border-light">
			<div class="mb-4 text-6xl opacity-50">📊</div>
			<h3 class="mb-2 text-lg font-semibold text-text-primary-light">No Roast Profiles Yet</h3>
			<p class="text-text-secondary-light">
				Start roasting to see your profile history and analytics here
			</p>
		</div>
	{:else}
		<div class="space-y-6">
			{#each sortedBatchNames as batchName}
				{@const profiles = sortedGroupedProfiles[batchName] || []}
				{@const batchSummary = getBatchSummary(profiles)}
				<div class="rounded-lg bg-background-secondary-light shadow-sm ring-1 ring-border-light">
					<!-- Enhanced Batch Header -->
					<button
						type="button"
						class="flex w-full items-center justify-between p-4 transition-colors hover:bg-background-tertiary-light/5 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
						onclick={() => onToggleBatch(batchName)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onToggleBatch(batchName);
							}
						}}
						aria-expanded={isBatchExpanded(batchName)}
						aria-controls="batch-{batchName.replace(/\s+/g, '-').toLowerCase()}"
						aria-label="Toggle {batchName} batch ({batchSummary.count} roasts)"
					>
						<div class="flex items-center gap-3">
							<span
								class="text-background-tertiary-light transition-transform duration-200 {isBatchExpanded(
									batchName
								)
									? 'rotate-90'
									: ''}"
							>
								▶
							</span>
							<div class="text-left">
								<h3 class="break-words text-lg font-semibold text-text-primary-light">
									{batchName}
								</h3>
								<div class="flex flex-wrap items-center gap-4 text-sm text-text-secondary-light">
									<span>{batchSummary.count} roast{batchSummary.count !== 1 ? 's' : ''}</span>
									<span>•</span>
									<span>{batchSummary.totalWeight} oz total</span>
									{#if batchSummary.avgYield > 0}
										<span>•</span>
										<span class="text-green-600">{batchSummary.avgYield}% avg yield</span>
									{/if}
								</div>
							</div>
						</div>
						<div class="text-sm text-text-secondary-light">
							{formatDateForDisplay(profiles[0]?.roast_date)}
						</div>
					</button>

					<!-- Roast Profile Cards -->
					{#if isBatchExpanded(batchName) && profiles.length > 0}
						<div
							class="border-t border-border-light p-4"
							id="batch-{batchName.replace(/\s+/g, '-').toLowerCase()}"
							role="region"
							aria-label="Roast profiles for {batchName}"
						>
							<div class="grid gap-3 sm:grid-cols-2">
								{#each profiles as profile}
									{@const completionStatus = getRoastCompletionStatus(profile)}
									<div
										class="group relative rounded-lg bg-background-primary-light ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light {currentRoastProfile?.roast_id ===
										profile.roast_id
											? 'bg-background-tertiary-light/5 ring-2 ring-background-tertiary-light'
											: ''}"
									>
										<!-- Main clickable area -->
										<button
											type="button"
											class="w-full p-4 text-left focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-1"
											onclick={() => onSelectProfile(profile)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													onSelectProfile(profile);
												}
											}}
											aria-label="View roast profile for {profile.coffee_name} from {formatDateForDisplay(
												profile.roast_date
											)}"
											aria-pressed={currentRoastProfile?.roast_id === profile.roast_id}
										>
											<div class="mb-3 flex items-start justify-between">
												<div class="flex-1">
													<h4
														class="line-clamp-2 font-semibold text-text-primary-light group-hover:text-background-tertiary-light"
													>
														{profile.coffee_name}
													</h4>
													<div class="mt-1 flex items-center gap-2">
														<p class="text-sm text-text-secondary-light">
															{formatDateForDisplay(profile.roast_date)}
														</p>
														<span
															class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium {completionStatus.bgColor} {completionStatus.color}"
														>
															{completionStatus.status}
														</span>
													</div>
												</div>
												<div class="ml-2 flex flex-col gap-1">
													{#if profile.notes}
														<div class="rounded bg-amber-100 px-2 py-1">
															<span class="text-xs text-amber-800" title="Has notes">📝</span>
														</div>
													{/if}
													{#if currentRoastProfile?.roast_id === profile.roast_id}
														<div class="rounded bg-background-tertiary-light px-2 py-1">
															<span class="text-xs text-white" title="Currently selected">👁️</span>
														</div>
													{/if}
												</div>
											</div>

											<!-- Key Metrics Grid -->
											<div class="grid grid-cols-2 gap-3 text-xs">
												<div class="space-y-1">
													<div class="text-text-secondary-light">Weight</div>
													<div class="font-medium text-blue-600">
														{profile.oz_in ? `${profile.oz_in} oz` : 'N/A'}
													</div>
												</div>
												<div class="space-y-1">
													<div class="text-text-secondary-light">Duration</div>
													<div class="font-medium text-indigo-600">
														{calculateRoastDuration(profile)}
													</div>
												</div>
												<div class="space-y-1">
													<div class="text-text-secondary-light">Yield</div>
													<div class="font-medium text-green-600">
														{calculateYieldPercentage(profile)}
													</div>
												</div>
												<div class="space-y-1">
													<div class="text-text-secondary-light">End Temp</div>
													<div class="font-medium {getRoastLevelColor(profile.end_temperature)}">
														{profile.end_temperature
															? `${Math.round(profile.end_temperature)}°F`
															: 'N/A'}
													</div>
												</div>
											</div>

											<!-- Notes Preview -->
											{#if profile.notes}
												<div class="mt-3 border-t border-border-light pt-3">
													<p class="line-clamp-2 text-xs text-text-secondary-light">
														{profile.notes}
													</p>
												</div>
											{/if}

											<!-- Selection indicator -->
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
														d="M9 5l7 7-7 7"
													/>
												</svg>
											</div>
										</button>

										<!-- Quick Actions - positioned absolutely -->
										<div
											class="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-background-primary-light/90 p-1 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100"
										>
											<button
												type="button"
												class="rounded p-1 text-text-secondary-light hover:bg-background-tertiary-light/10 hover:text-background-tertiary-light focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
												onclick={(e) => {
													e.stopPropagation();
													// TODO: Implement edit functionality
													console.log('Edit profile:', profile.roast_id);
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														e.stopPropagation();
														console.log('Edit profile:', profile.roast_id);
													}
												}}
												aria-label="Edit roast profile for {profile.coffee_name}"
												title="Edit roast profile"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
													/>
												</svg>
											</button>
											<button
												type="button"
												class="rounded p-1 text-text-secondary-light hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
												onclick={(e) => {
													e.stopPropagation();
													// TODO: Implement duplicate functionality
													console.log('Duplicate profile:', profile.roast_id);
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														e.stopPropagation();
														console.log('Duplicate profile:', profile.roast_id);
													}
												}}
												aria-label="Duplicate roast profile for {profile.coffee_name}"
												title="Duplicate roast profile"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
													/>
												</svg>
											</button>
											<button
												type="button"
												class="rounded p-1 text-text-secondary-light hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500"
												onclick={(e) => {
													e.stopPropagation();
													if (confirm(`Delete roast profile for ${profile.coffee_name}?`)) {
														// TODO: Implement delete functionality
														console.log('Delete profile:', profile.roast_id);
													}
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														e.stopPropagation();
														if (confirm(`Delete roast profile for ${profile.coffee_name}?`)) {
															console.log('Delete profile:', profile.roast_id);
														}
													}
												}}
												aria-label="Delete roast profile for {profile.coffee_name}"
												title="Delete roast profile"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
											</button>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
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

	/* Custom hover effects */
	.group:hover .group-hover\:scale-\[1\.02\] {
		transform: scale(1.02);
	}

	/* Smooth transitions for interactive elements */
	button {
		transition: all 0.15s ease-in-out;
	}

	/* Ensure quick action buttons maintain opacity on focus */
	.group:focus-within .opacity-0 {
		opacity: 1;
	}
</style>
