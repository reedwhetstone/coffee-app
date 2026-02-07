<script lang="ts">
	import type { RoastProfilesBlock, BlockAction } from '$lib/types/genui';

	let { block, onAction: _onAction } = $props<{
		block: RoastProfilesBlock;
		onAction?: (action: BlockAction) => void;
	}>();

	function formatTime(seconds: number | null): string {
		if (seconds == null) return '-';
		const mins = Math.floor(seconds / 60);
		const secs = Math.round(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function formatTemp(temp: number | null): string {
		if (temp == null) return '-';
		return `${Math.round(temp)}°`;
	}

	function formatPercent(val: number | null): string {
		if (val == null) return '-';
		return `${val.toFixed(1)}%`;
	}

	function devPercentClass(val: number | null): string {
		if (val == null) return '';
		if (val < 15) return 'text-blue-500';
		if (val > 25) return 'text-red-500';
		return 'text-green-600';
	}

	function weightLossClass(val: number | null): string {
		if (val == null) return '';
		if (val < 11) return 'text-blue-500';
		if (val > 16) return 'text-red-500';
		return 'text-green-600';
	}

	function handleViewChart(roastId: string) {
		window.open(`/roast?id=${roastId}`, '_blank');
	}
</script>

<div class="my-4">
	<h3 class="mb-3 font-semibold text-text-primary-light">
		Roast Profiles ({block.data.length})
	</h3>

	<!-- Profiles table -->
	<div class="overflow-x-auto rounded-lg ring-1 ring-border-light">
		<table class="w-full text-sm">
			<thead>
				<tr
					class="border-b border-border-light bg-background-secondary-light text-left text-xs font-medium text-text-secondary-light"
				>
					<th class="sticky left-0 bg-background-secondary-light px-3 py-2">Batch</th>
					<th class="px-3 py-2">Coffee</th>
					<th class="px-3 py-2">Date</th>
					<th class="px-3 py-2 text-right">Time</th>
					<th class="px-3 py-2 text-right">FC</th>
					<th class="px-3 py-2 text-right">Drop</th>
					<th class="px-3 py-2 text-right">Dev%</th>
					<th class="px-3 py-2 text-right">WL%</th>
					<th class="px-3 py-2 text-right">ROR</th>
					<th class="px-3 py-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each block.data as profile (profile.roast_id)}
					<tr
						class="border-b border-border-light last:border-0 hover:bg-background-secondary-light/50"
					>
						<td
							class="sticky left-0 bg-background-primary-light px-3 py-2 font-medium text-text-primary-light"
						>
							{profile.batch_name || '-'}
						</td>
						<td
							class="max-w-[150px] truncate px-3 py-2 text-text-secondary-light"
							title={profile.coffee_name}
						>
							{profile.coffee_name || '-'}
						</td>
						<td class="px-3 py-2 text-text-secondary-light">
							{profile.roast_date ? new Date(profile.roast_date).toLocaleDateString() : '-'}
						</td>
						<td class="px-3 py-2 text-right text-text-primary-light">
							{formatTime(profile.total_roast_time)}
						</td>
						<td class="px-3 py-2 text-right text-text-primary-light">
							<span class="text-text-primary-light">{formatTime(profile.fc_start_time)}</span>
							{#if profile.fc_start_temp != null}
								<span class="ml-1 text-xs text-text-secondary-light"
									>{formatTemp(profile.fc_start_temp)}</span
								>
							{/if}
						</td>
						<td class="px-3 py-2 text-right text-text-primary-light">
							<span class="text-text-primary-light">{formatTime(profile.drop_time)}</span>
							{#if profile.drop_temp != null}
								<span class="ml-1 text-xs text-text-secondary-light"
									>{formatTemp(profile.drop_temp)}</span
								>
							{/if}
						</td>
						<td class="px-3 py-2 text-right {devPercentClass(profile.development_percent)}">
							{formatPercent(profile.development_percent)}
						</td>
						<td class="px-3 py-2 text-right {weightLossClass(profile.weight_loss_percent)}">
							{formatPercent(profile.weight_loss_percent)}
						</td>
						<td class="px-3 py-2 text-right text-text-primary-light">
							{profile.total_ror != null ? profile.total_ror.toFixed(1) : '-'}
						</td>
						<td class="px-3 py-2">
							<button
								onclick={() => handleViewChart(profile.roast_id)}
								class="text-xs text-background-tertiary-light hover:underline"
							>
								View chart
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Summary stats -->
	{#if block.summary}
		<div
			class="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-background-secondary-light p-3 text-xs sm:grid-cols-4"
		>
			<div>
				<span class="text-text-secondary-light">Avg Time</span>
				<div class="font-medium text-text-primary-light">
					{formatTime(block.summary.avg_total_roast_time)}
				</div>
			</div>
			<div>
				<span class="text-text-secondary-light">Avg FC Temp</span>
				<div class="font-medium text-text-primary-light">
					{formatTemp(block.summary.avg_fc_start_temp)}
				</div>
			</div>
			<div>
				<span class="text-text-secondary-light">Avg Drop Temp</span>
				<div class="font-medium text-text-primary-light">
					{formatTemp(block.summary.avg_drop_temp)}
				</div>
			</div>
			<div>
				<span class="text-text-secondary-light">Avg Dev%</span>
				<div class="font-medium {devPercentClass(block.summary.avg_development_percent)}">
					{formatPercent(block.summary.avg_development_percent)}
				</div>
			</div>
			{#if block.summary.avg_weight_loss_percent != null}
				<div>
					<span class="text-text-secondary-light">Avg Weight Loss</span>
					<div class="font-medium {weightLossClass(block.summary.avg_weight_loss_percent)}">
						{formatPercent(block.summary.avg_weight_loss_percent)}
					</div>
				</div>
			{/if}
			{#if block.summary.avg_total_ror != null}
				<div>
					<span class="text-text-secondary-light">Avg ROR</span>
					<div class="font-medium text-text-primary-light">
						{block.summary.avg_total_ror.toFixed(1)}
					</div>
				</div>
			{/if}
			{#if block.summary.date_range_start && block.summary.date_range_end}
				<div class="col-span-2">
					<span class="text-text-secondary-light">Date Range</span>
					<div class="font-medium text-text-primary-light">
						{new Date(block.summary.date_range_start).toLocaleDateString()} - {new Date(
							block.summary.date_range_end
						).toLocaleDateString()}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
