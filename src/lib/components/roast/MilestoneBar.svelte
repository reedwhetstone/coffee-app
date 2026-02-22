<script lang="ts">
	import type { MilestoneCalculations } from '$lib/roast/roast-types';
	import { formatTimeDisplay } from '$lib/roast/roast-math';

	let {
		calculations
	}: {
		calculations: MilestoneCalculations;
	} = $props();

	let dryingDisplay = $derived(
		calculations.dryingPercent > 0 ? `${calculations.dryingPercent.toFixed(1)}%` : '--'
	);
	let tpDisplay = $derived(formatTimeDisplay(calculations.tpTime));
	let maillardDisplay = $derived(
		calculations.maillardPercent > 0 ? `${calculations.maillardPercent.toFixed(1)}%` : '--'
	);
	let fcDisplay = $derived(formatTimeDisplay(calculations.fcTime));
	let devDisplay = $derived(
		calculations.devPercent > 0 ? `${calculations.devPercent.toFixed(1)}%` : '--'
	);
</script>

<!-- Roast milestone timestamps -->
<div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
	<div
		class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
	>
		<span class="text-xs text-text-secondary-light">DRYING %</span>
		<div class="text-base font-bold text-text-primary-light sm:text-lg">{dryingDisplay}</div>
	</div>
	<div
		class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
	>
		<span class="text-xs text-text-secondary-light">DRY END</span>
		<div class="text-base font-bold text-text-primary-light sm:text-lg">{tpDisplay}</div>
	</div>
	<div
		class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
	>
		<span class="text-xs text-text-secondary-light">MAILLARD %</span>
		<div class="text-base font-bold text-text-primary-light sm:text-lg">{maillardDisplay}</div>
	</div>
	<div
		class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
	>
		<span class="text-xs text-text-secondary-light">FIRST CRACK</span>
		<div class="text-base font-bold text-text-primary-light sm:text-lg">{fcDisplay}</div>
	</div>
	<div
		class="rounded border border-border-light bg-background-primary-light p-1 text-center sm:p-2"
	>
		<span class="text-xs text-text-secondary-light">DEV %</span>
		<div class="text-base font-bold text-text-primary-light sm:text-lg">{devDisplay}</div>
	</div>
</div>
