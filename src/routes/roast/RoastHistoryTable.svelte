<script lang="ts">
	import { formatDateForDisplay } from '$lib/utils/dates';
	export let sortedBatchNames: string[];
	export let sortedGroupedProfiles: Record<string, any[]>;
	export let expandedBatches: Set<string>;
	export let currentRoastProfile: any;
	export let onToggleBatch: (batchName: string) => void;
	export let onSelectProfile: (profile: any) => void;

	// Add filter state
	let expandedFilters = false;
	let filters: Record<string, any> = {
		coffee_name: '',
		batch_name: '',
		roast_date: '',
		notes: ''
	};

	// Get filterable columns
	function getFilterableColumns(): string[] {
		return ['coffee_name', 'batch_name', 'roast_date', 'notes'];
	}

	// Compute filtered data
	$: filteredProfiles = Object.entries(sortedGroupedProfiles).reduce(
		(acc: Record<string, any[]>, [batchName, profiles]) => {
			const filteredBatchProfiles = profiles.filter((profile) => {
				return Object.entries(filters).every(([key, value]) => {
					if (!value) return true;
					const itemValue = profile[key];
					if (typeof value === 'string') {
						return String(itemValue).toLowerCase().includes(value.toLowerCase());
					}
					return true;
				});
			});

			if (filteredBatchProfiles.length > 0) {
				acc[batchName] = filteredBatchProfiles;
			}
			return acc;
		},
		{}
	);

	$: filteredBatchNames = Object.keys(filteredProfiles);
</script>

<div class="mx-2 mt-4 flex flex-col gap-4 md:mx-8 md:mt-8 md:flex-row">
	<!-- Filter Panel -->
	<div class="rounded-lg bg-zinc-800 p-4 md:w-64 md:flex-shrink-0">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-zinc-100">Filters</h3>
			<button
				class="text-sm text-zinc-400 hover:text-zinc-100 md:hidden"
				on:click={() => (expandedFilters = !expandedFilters)}
			>
				{expandedFilters ? 'Hide Filters' : 'Show Filters'}
			</button>
		</div>

		<!-- Filter controls -->
		<div class={`space-y-4 ${expandedFilters ? 'block' : 'hidden'} md:block`}>
			<div class="space-y-2">
				<h4 class="block text-sm text-zinc-400">Filters</h4>
				{#each getFilterableColumns() as column}
					<div class="space-y-1">
						<label for={column} class="block text-xs text-zinc-400">
							{column.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
						</label>
						<input
							type="text"
							bind:value={filters[column]}
							class="w-full rounded bg-zinc-700 p-2 text-sm text-zinc-100"
							placeholder={`Filter by ${column.replace(/_/g, ' ')}`}
						/>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Roast Cards -->
	<div class="flex-1">
		{#if filteredBatchNames.length === 0}
			<p class="p-4 text-zinc-300">No roast profiles available</p>
		{:else}
			<div class="space-y-4">
				{#each filteredBatchNames as batchName}
					<!-- Batch Header -->
					<div class="rounded-lg bg-zinc-700 p-4">
						<button
							type="button"
							class="flex w-full items-center justify-between"
							on:click={() => onToggleBatch(batchName)}
						>
							<h3 class="text-lg font-semibold text-zinc-100">
								{expandedBatches.has(batchName) ? '▼' : '▶'}
								{batchName}
							</h3>
							<span class="text-sm text-zinc-400">
								{filteredProfiles[batchName].length} roasts
							</span>
						</button>

						{#if expandedBatches.has(batchName)}
							<div class="mt-4 space-y-2">
								<!-- Display profiles in the order they appear in filteredProfiles -->
								{#each filteredProfiles[batchName] as profile}
									<button
										type="button"
										class="w-full cursor-pointer rounded-lg bg-zinc-800 p-3 text-left transition-colors hover:bg-zinc-700 {currentRoastProfile?.roast_id ===
										profile.roast_id
											? 'bg-zinc-700'
											: ''}"
										on:click={() => onSelectProfile(profile)}
									>
										<div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
											<div>
												<h4 class="text-base font-semibold text-zinc-100">
													{profile.coffee_name}
												</h4>
												<p class="text-sm text-zinc-400">
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
</div>
