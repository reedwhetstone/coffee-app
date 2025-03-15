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
</script>

<div class="flex flex-col gap-4">
	{#if !sortedBatchNames || sortedBatchNames.length === 0}
		<p class="p-4 text-text-primary-light">No roast profiles available</p>
	{:else}
		<div class="space-y-4">
			{#each sortedBatchNames as batchName}
				<div class="rounded-lg border border-border-light bg-background-secondary-light shadow-md">
					<!-- Batch Header - Consistent padding -->
					<button
						type="button"
						class="flex w-full items-center justify-between p-4"
						onclick={() => onToggleBatch(batchName)}
					>
						<h3 class="text-primary-light flex items-center gap-2 text-lg font-semibold">
							<span class="w-4">{isBatchExpanded(batchName) ? '▼' : '▶'}</span>
							{batchName}
						</h3>
						<span class="text-primary-light text-sm">
							{(sortedGroupedProfiles[batchName] || []).length} roasts
						</span>
					</button>

					{#if isBatchExpanded(batchName) && sortedGroupedProfiles[batchName]}
						<div class="border-t border-border-light">
							{#each sortedGroupedProfiles[batchName] as profile}
								<button
									type="button"
									class="w-full cursor-pointer p-4 text-left transition-colors hover:bg-background-tertiary-light/10 {currentRoastProfile?.roast_id ===
									profile.roast_id
										? 'bg-background-tertiary-light opacity-80'
										: ''} border-b border-border-light last:border-b-0"
									onclick={() => onSelectProfile(profile)}
								>
									<div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
										<div>
											<h4 class="text-primary-light text-base font-semibold">
												{profile.coffee_name}
											</h4>
											<p class="text-primary-light text-sm">
												{formatDateForDisplay(profile.roast_date)}
											</p>
										</div>
										{#if profile.notes}
											<div class="text-left text-sm text-text-primary-light sm:text-right">
												{profile.notes}
											</div>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
