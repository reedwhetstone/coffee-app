<script lang="ts">
	export let sortedBatchNames: string[];
	export let sortedGroupedProfiles: Record<string, any[]>;
	export let expandedBatches: Set<string>;
	export let currentRoastProfile: any;

	export let onToggleBatch: (batchName: string) => void;
	export let onSelectProfile: (profile: any) => void;
</script>

<div class="roast-history-table m-8 overflow-hidden overflow-x-auto rounded-lg">
	<table class="w-full table-auto bg-zinc-800">
		<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
			<tr>
				<th class="px-6 py-3">Batch</th>
				<th class="px-6 py-3">Roast Date</th>
				<th class="px-6 py-3">Details</th>
			</tr>
		</thead>
		<tbody>
			{#each sortedBatchNames as batchName}
				<!-- Batch Group Header -->
				<tr
					class="cursor-pointer bg-zinc-700 hover:bg-zinc-600"
					on:click={() => onToggleBatch(batchName)}
				>
					<td class="px-6 py-2 text-left text-xs font-semibold text-zinc-300">
						{expandedBatches.has(batchName) ? '▼' : '▶'}
						{batchName}
					</td>
					<td class="px-6 py-2 text-left text-xs font-semibold text-zinc-300">
						{new Date(sortedGroupedProfiles[batchName][0].roast_date).toLocaleDateString()}
					</td>
					<td class="px-6 py-2 text-left text-xs font-semibold text-zinc-300">
						{sortedGroupedProfiles[batchName].length} roasts
					</td>
				</tr>
				<!-- Profiles Under the Current Batch -->
				{#if expandedBatches.has(batchName)}
					{#each sortedGroupedProfiles[batchName] as profile}
						<tr
							class="cursor-pointer border-b border-zinc-700 bg-zinc-800 transition-colors hover:bg-zinc-700 {currentRoastProfile?.id ===
							profile.id
								? 'bg-zinc-700'
								: ''}"
							on:click={() => onSelectProfile(profile)}
						>
							<td class="px-6 py-4 pl-12 text-xs text-zinc-300">{profile.coffee_name}</td>
							<td class="px-6 py-4 text-xs text-zinc-300">
								{new Date(profile.roast_date).toLocaleTimeString()}
							</td>
							<td class="px-6 py-4 text-xs text-zinc-300">{profile.notes}</td>
						</tr>
					{/each}
				{/if}
			{/each}
		</tbody>
	</table>
</div>
