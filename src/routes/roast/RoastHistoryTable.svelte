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
				<div class="rounded-lg bg-background-secondary-light ring-1 ring-border-light">
					<!-- Batch Header - Following ProfitCards Pattern -->
					<button
						type="button"
						class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-background-primary-light focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2"
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
							<div class="text-text-primary-light">
								{isBatchExpanded(batchName) ? '▼' : '▶'}
							</div>
							<div>
								<h3 class="text-lg font-semibold text-text-primary-light">
									{batchName}
								</h3>
								<p class="text-sm text-text-secondary-light">
									{batchSummary.count} roast{batchSummary.count !== 1 ? 's' : ''} • {formatDateForDisplay(
										profiles[0]?.roast_date
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
									<p class="text-text-secondary-light">Avg Yield</p>
									<p class="font-semibold text-green-500">{batchSummary.avgYield}%</p>
								</div>
								<div>
									<p class="text-text-secondary-light">Roasts</p>
									<p class="font-semibold text-purple-500">{batchSummary.count}</p>
								</div>
							</div>
						</div>
					</button>

					<!-- Roast Profile Cards -->
					{#if isBatchExpanded(batchName) && profiles.length > 0}
						<div
							class="border-t border-border-light bg-background-primary-light p-4"
							id="batch-{batchName.replace(/\s+/g, '-').toLowerCase()}"
							role="region"
							aria-label="Roast profiles for {batchName}"
						>
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
								{#each profiles as profile}
									{@const completionStatus = getRoastCompletionStatus(profile)}
									<button
										type="button"
										class="w-full rounded-lg bg-background-secondary-light p-4 text-left ring-1 ring-border-light transition-all hover:scale-[1.02] hover:ring-background-tertiary-light focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2 {currentRoastProfile?.roast_id ===
										profile.roast_id
											? 'ring-2 ring-background-tertiary-light'
											: ''}"
										onclick={() => onSelectProfile(profile)}
									>
										<div class="mb-3 flex items-start justify-between">
											<div>
												<h4 class="font-semibold text-text-primary-light">
													{profile.coffee_name}
												</h4>
												<p class="text-sm text-text-secondary-light">
													{formatDateForDisplay(profile.roast_date)}
													{#if currentRoastProfile?.roast_id === profile.roast_id}
														• Currently Selected
													{/if}
												</p>
											</div>
											<div class="text-right text-sm text-text-secondary-light">
												{currentRoastProfile?.roast_id === profile.roast_id
													? 'Currently selected'
													: 'Click to select'}
											</div>
										</div>

										<!-- Roast Metrics Grid - Following ProfitCards Pattern -->
										<div class="grid grid-cols-2 gap-3 text-sm">
											<div>
												<p class="text-text-secondary-light">Weight In</p>
												<p class="font-semibold text-blue-500">
													{profile.oz_in ? `${profile.oz_in} oz` : 'N/A'}
												</p>
											</div>
											<div>
												<p class="text-text-secondary-light">Duration</p>
												<p class="font-semibold text-indigo-500">
													{calculateRoastDuration(profile)}
												</p>
											</div>
											<div>
												<p class="text-text-secondary-light">Yield</p>
												<p class="font-semibold text-green-500">
													{calculateYieldPercentage(profile)}
												</p>
											</div>
											<div>
												<p class="text-text-secondary-light">End Temp</p>
												<p class="font-semibold {getRoastLevelColor(profile.end_temperature)}">
													{profile.end_temperature
														? `${Math.round(profile.end_temperature)}°F`
														: 'N/A'}
												</p>
											</div>
										</div>

										{#if profile.notes}
											<div class="mt-4 border-t border-border-light pt-4">
												<h5 class="mb-2 font-medium text-text-primary-light">Notes</h5>
												<p class="text-sm text-text-secondary-light">{profile.notes}</p>
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
