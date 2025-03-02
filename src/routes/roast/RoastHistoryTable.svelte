<script lang="ts">
	import { formatDateForDisplay } from '$lib/utils/dates';

	export let sortedBatchNames: string[] = [];
	export let sortedGroupedProfiles: Record<string, any[]> = {};
	export let expandedBatches: Set<string>;
	export let currentRoastProfile: any;
	export let onToggleBatch: (batchName: string) => void;
	export let onSelectProfile: (profile: any) => void;

	import { createEventDispatcher } from 'svelte';
	const dispatch = createEventDispatcher();

	// Helper function to check if a batch is expanded
	function isBatchExpanded(batchName: string): boolean {
		return expandedBatches.has(batchName);
	}
</script>

<div class="mx-2 mt-4 flex flex-col gap-4 md:mx-8 md:mt-8">
	{#if !sortedBatchNames || sortedBatchNames.length === 0}
		<p class="p-4 text-zinc-300">No roast profiles available</p>
	{:else}
		<div class="space-y-4">
			{#each sortedBatchNames as batchName}
				<!-- Batch Header -->
				<div class="rounded-lg bg-background-tertiary-light p-4">
					<button
						type="button"
						class="flex w-full items-center justify-between"
						on:click={() => onToggleBatch(batchName)}
					>
						<h3 class="text-secondary-light text-lg font-semibold">
							{isBatchExpanded(batchName) ? '▼' : '▶'}
							{batchName}
						</h3>
						<span class="text-primary-light text-sm">
							{(sortedGroupedProfiles[batchName] || []).length} roasts
						</span>
					</button>

					{#if isBatchExpanded(batchName) && sortedGroupedProfiles[batchName]}
						<div class="mt-4 space-y-2">
							{#each sortedGroupedProfiles[batchName] as profile}
								<button
									type="button"
									class="w-full cursor-pointer rounded-lg bg-background-secondary-light p-3 text-left transition-colors hover:bg-background-tertiary-light {currentRoastProfile?.roast_id ===
									profile.roast_id
										? 'bg-background-tertiary-light'
										: ''}"
									on:click={() => onSelectProfile(profile)}
								>
									<div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
										<div>
											<h4 class="text-secondary-light text-base font-semibold">
												{profile.coffee_name}
											</h4>
											<p class="text-primary-light text-sm">
												{formatDateForDisplay(profile.roast_date)}
											</p>
										</div>
										{#if profile.notes}
											<div class="text-left text-sm text-zinc-300 sm:text-right">
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
