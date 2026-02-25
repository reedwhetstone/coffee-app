<script lang="ts">
	let {
		fanValue = $bindable(),
		heatValue = $bindable(),
		onFanChange,
		onHeatChange
	}: {
		fanValue: number;
		heatValue: number;
		onFanChange: (value: number) => void;
		onHeatChange: (value: number) => void;
	} = $props();
</script>

<div
	class="flex w-full flex-row justify-center gap-8 bg-background-primary-light p-3 sm:w-64 sm:p-4 md:mr-4 md:border-r md:border-border-light lg:mr-4 lg:border-r lg:border-border-light"
>
	<!-- Fan control -->
	<div class="flex flex-col items-center gap-2">
		<span class="text-sm font-medium text-text-secondary-light">FAN</span>
		<div class="flex flex-col items-center rounded-lg border-2 border-indigo-800">
			<button
				class="flex h-8 w-full items-center justify-center text-text-primary-light hover:bg-indigo-900/80 hover:text-white"
				onclick={() => onFanChange(Math.min(10, fanValue + 1))}
				disabled={fanValue >= 10}
			>
				+
			</button>
			<div
				class="flex h-10 w-10 items-center justify-center text-lg font-bold text-text-primary-light sm:h-12 sm:w-12 sm:text-xl"
			>
				{fanValue}
			</div>
			<button
				class="flex h-8 w-full items-center justify-center text-text-primary-light hover:bg-indigo-900/80 hover:text-white"
				onclick={() => onFanChange(Math.max(0, fanValue - 1))}
				disabled={fanValue <= 0}
			>
				-
			</button>
		</div>
	</div>

	<!-- Heat control -->
	<div class="flex flex-col items-center gap-2">
		<span class="text-sm font-medium text-text-secondary-light">HEAT</span>
		<div class="flex flex-col items-center rounded-lg border-2 border-amber-800">
			<button
				class="flex h-8 w-full items-center justify-center text-text-primary-light hover:bg-amber-900/80 hover:text-white"
				onclick={() => onHeatChange(Math.min(10, heatValue + 1))}
				disabled={heatValue >= 10}
			>
				+
			</button>
			<div
				class="flex h-10 w-10 items-center justify-center text-lg font-bold text-text-primary-light sm:h-12 sm:w-12 sm:text-xl"
			>
				{heatValue}
			</div>
			<button
				class="flex h-8 w-full items-center justify-center text-text-primary-light hover:bg-amber-900/80 hover:text-white"
				onclick={() => onHeatChange(Math.max(0, heatValue - 1))}
				disabled={heatValue <= 0}
			>
				-
			</button>
		</div>
	</div>
</div>
