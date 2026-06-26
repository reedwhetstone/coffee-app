<script lang="ts">
	import type { InventoryWithCatalog, RoastProfile } from '$lib/types/component.types';

	let { selectedBean, role, onStartNewRoast } = $props<{
		selectedBean: InventoryWithCatalog;
		role?: 'viewer' | 'member' | 'admin';
		onStartNewRoast: () => void;
	}>();
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold text-text-primary-light">Roasting History</h3>
		{#if role === 'admin' || role === 'member'}
			<button
				onclick={onStartNewRoast}
				class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
			>
				Start New Roast
			</button>
		{/if}
	</div>

	{#if selectedBean.roast_profiles && selectedBean.roast_profiles.length > 0}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each selectedBean.roast_profiles as profile, index}
				<button
					class="w-full cursor-pointer rounded-lg bg-background-primary-light p-4 text-left ring-1 ring-border-light transition-all duration-200 hover:bg-background-secondary-light hover:ring-2 hover:ring-background-tertiary-light"
					onclick={() => {
						if (profile.roast_id) {
							window.location.href = `/roast?profileId=${profile.roast_id}`;
						}
					}}
					disabled={!profile.roast_id}
				>
					<div class="mb-2 flex items-center justify-between">
						<h4 class="font-medium text-text-primary-light">
							{profile.batch_name || `Roast #${index + 1}`}
						</h4>
						<div class="text-right">
							<div class="text-xs text-text-secondary-light">
								{profile.oz_in || 0} oz → {profile.oz_out || 0} oz
							</div>
							{#if profile.roast_id}
								<div class="text-xs text-text-secondary-light">
									ID: {profile.roast_id}
								</div>
							{/if}
						</div>
					</div>
					<div class="mb-2 text-sm text-text-secondary-light">
						Loss: {profile.weight_loss_percent !== null && profile.weight_loss_percent !== undefined
							? profile.weight_loss_percent.toFixed(1)
							: 'N/A'}%
					</div>
					{#if profile.roast_date}
						<div class="mt-1 text-xs text-text-secondary-light">
							{new Date(profile.roast_date).toLocaleDateString()}
						</div>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Summary Stats -->
		{@const totalOzIn = selectedBean.roast_profiles.reduce(
			(sum: number, p: RoastProfile) => sum + (p.oz_in || 0),
			0
		)}
		{@const totalOzOut = selectedBean.roast_profiles.reduce(
			(sum: number, p: RoastProfile) => sum + (p.oz_out || 0),
			0
		)}
		{@const validRoastsForLoss = selectedBean.roast_profiles.filter(
			(p: RoastProfile) => p.weight_loss_percent !== null && p.weight_loss_percent !== undefined
		)}
		{@const avgLoss =
			validRoastsForLoss.length > 0
				? validRoastsForLoss.reduce(
						(sum: number, p: RoastProfile) => sum + (p.weight_loss_percent || 0),
						0
					) / validRoastsForLoss.length
				: 0}

		<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h4 class="text-sm font-medium text-text-primary-light">Total Roasted</h4>
				<p class="text-2xl font-bold text-blue-500">{totalOzIn.toFixed(1)} oz</p>
			</div>
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h4 class="text-sm font-medium text-text-primary-light">Total Output</h4>
				<p class="text-2xl font-bold text-green-500">{totalOzOut.toFixed(1)} oz</p>
			</div>
			<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
				<h4 class="text-sm font-medium text-text-primary-light">Avg Loss Rate</h4>
				<p class="text-2xl font-bold text-orange-500">
					{validRoastsForLoss.length > 0 ? avgLoss.toFixed(1) : 'N/A'}%
				</p>
				<p class="text-xs text-text-secondary-light">
					{validRoastsForLoss.length > 0
						? `Average from ${validRoastsForLoss.length} roast${validRoastsForLoss.length === 1 ? '' : 's'} with calculated loss data`
						: 'No roasts with weight loss data available'}
				</p>
			</div>
		</div>
	{:else}
		<div class="rounded-lg bg-background-primary-light p-8 text-center ring-1 ring-border-light">
			<div class="mb-4 text-4xl opacity-50">🔥</div>
			<h4 class="mb-2 text-lg font-semibold text-text-primary-light">No Roasts Yet</h4>
			<p class="mb-4 text-text-secondary-light">
				Start your first roast with this coffee to see roasting history and analytics.
			</p>
			{#if role === 'admin' || role === 'member'}
				<button
					onclick={onStartNewRoast}
					class="rounded-md bg-background-tertiary-light px-4 py-2 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				>
					Start First Roast
				</button>
			{/if}
		</div>
	{/if}
</div>
