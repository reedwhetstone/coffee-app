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

	function calculateWeightLossPercentage(profile: any): string {
		// Use calculated weight_loss_percent from roast_profiles, fallback to calculation
		if (profile.weight_loss_percent !== null && profile.weight_loss_percent !== undefined) {
			return `${profile.weight_loss_percent.toFixed(1)}%`;
		}
		if (!profile.oz_in || !profile.oz_out) return 'N/A';
		// Calculate weight loss percentage: (oz_in - oz_out) / oz_in * 100
		const weightLoss = ((profile.oz_in - profile.oz_out) / profile.oz_in) * 100;
		return `${weightLoss.toFixed(1)}%`;
	}

	function getDropTempDisplay(profile: any): string {
		// Use calculated drop_temp from roast_profiles, fallback to end_temperature
		if (profile.drop_temp) {
			return `${Math.round(profile.drop_temp)}°F`;
		}
		if (profile.end_temperature) {
			return `${Math.round(profile.end_temperature)}°F`;
		}
		return 'N/A';
	}

	function getRoastLevelColor(profile: any): string {
		// Use drop_temp if available, otherwise end_temperature
		const temp = profile.drop_temp || profile.end_temperature;
		if (!temp) return 'text-text-secondary-light';
		if (temp < 400) return 'text-yellow-600'; // Light roast
		if (temp < 420) return 'text-amber-600'; // Medium roast
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

<div class="w-full max-w-[100vw] overflow-x-hidden">
	{#if !sortedBatchNames || sortedBatchNames.length === 0}
		<div class="bg-background-secondary-light ring-border-light rounded-lg p-8 text-center ring-1">
			<div class="mb-4 text-6xl opacity-50">📊</div>
			<h3 class="text-text-primary-light mb-2 text-lg font-semibold">No Roast Profiles Yet</h3>
			<p class="text-text-secondary-light">
				Start roasting to see your profile history and analytics here
			</p>
		</div>
	{:else}
		<div class="space-y-6">
			{#each sortedBatchNames as batchName}
				{@const profiles = sortedGroupedProfiles[batchName] || []}
				{@const batchSummary = getBatchSummary(profiles)}
				<div class="bg-background-secondary-light ring-border-light rounded-lg ring-1">
					<!-- Batch Header - Following ProfitCards Pattern -->
					<button
						type="button"
						class="hover:bg-background-primary-light focus:ring-background-tertiary-light flex w-full items-center justify-between p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
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
								<h3 class="text-text-primary-light text-lg font-semibold">
									{batchName}
								</h3>
								<p class="text-text-secondary-light text-sm">
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
									<p class="text-text-secondary-light">Avg Loss</p>
									<p class="font-semibold text-red-500">{batchSummary.avgWeightLoss}%</p>
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
							class="border-border-light bg-background-primary-light border-t p-4"
							id="batch-{batchName.replace(/\s+/g, '-').toLowerCase()}"
							role="region"
							aria-label="Roast profiles for {batchName}"
						>
							<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
								{#each profiles as profile}
									{@const completionStatus = getRoastCompletionStatus(profile)}
									<button
										type="button"
										class="bg-background-secondary-light ring-border-light hover:ring-background-tertiary-light focus:ring-background-tertiary-light w-full rounded-lg p-4 text-left ring-1 transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 {currentRoastProfile?.roast_id ===
										profile.roast_id
											? 'ring-background-tertiary-light ring-2'
											: ''}"
										onclick={() => onSelectProfile(profile)}
									>
										<div class="mb-3 flex items-start justify-between">
											<div>
												<h4 class="text-text-primary-light font-semibold">
													{profile.coffee_name}
												</h4>
												<p class="text-text-secondary-light text-sm">
													ID: {profile.roast_id} • {formatDateForDisplay(profile.roast_date)}
												</p>
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
												<p class="text-text-secondary-light">Loss %</p>
												<p class="font-semibold text-red-500">
													{calculateWeightLossPercentage(profile)}
												</p>
											</div>
											<div>
												<p class="text-text-secondary-light">Drop Temp</p>
												<p class="font-semibold {getRoastLevelColor(profile)}">
													{getDropTempDisplay(profile)}
												</p>
											</div>
										</div>

										{#if profile.notes}
											<div class="border-border-light mt-4 border-t pt-4">
												<h5 class="text-text-primary-light mb-2 font-medium">Notes</h5>
												<p class="text-text-secondary-light text-sm">{profile.notes}</p>
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
