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
	class="grid w-full grid-cols-2 gap-4 bg-background-primary-light p-3 sm:flex sm:w-64 sm:flex-row sm:justify-center sm:gap-8 sm:p-4 md:mr-4 md:border-r md:border-border-light lg:mr-4 lg:border-r lg:border-border-light"
>
	<!-- Fan control -->
	<div class="flex min-w-0 flex-col items-center gap-2">
		<span class="text-xs font-semibold tracking-[0.18em] text-text-secondary-light sm:text-sm">
			FAN
		</span>
		<div
			class="flex w-full max-w-[7rem] flex-col items-center overflow-hidden rounded-xl border-2 border-indigo-800"
		>
			<button
				class="flex h-11 w-full items-center justify-center text-lg font-semibold text-text-primary-light transition-colors hover:bg-indigo-900/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Increase fan setting"
				onclick={() => onFanChange(Math.min(10, fanValue + 1))}
				disabled={fanValue >= 10}
			>
				+
			</button>
			<div
				class="flex h-14 w-full items-center justify-center border-y border-indigo-800/60 text-xl font-bold text-text-primary-light sm:h-12"
			>
				{fanValue}
			</div>
			<button
				class="flex h-11 w-full items-center justify-center text-lg font-semibold text-text-primary-light transition-colors hover:bg-indigo-900/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Decrease fan setting"
				onclick={() => onFanChange(Math.max(0, fanValue - 1))}
				disabled={fanValue <= 0}
			>
				-
			</button>
		</div>
	</div>

	<!-- Heat control -->
	<div class="flex min-w-0 flex-col items-center gap-2">
		<span class="text-xs font-semibold tracking-[0.18em] text-text-secondary-light sm:text-sm">
			HEAT
		</span>
		<div
			class="flex w-full max-w-[7rem] flex-col items-center overflow-hidden rounded-xl border-2 border-amber-800"
		>
			<button
				class="flex h-11 w-full items-center justify-center text-lg font-semibold text-text-primary-light transition-colors hover:bg-amber-900/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Increase heat setting"
				onclick={() => onHeatChange(Math.min(10, heatValue + 1))}
				disabled={heatValue >= 10}
			>
				+
			</button>
			<div
				class="flex h-14 w-full items-center justify-center border-y border-amber-800/60 text-xl font-bold text-text-primary-light sm:h-12"
			>
				{heatValue}
			</div>
			<button
				class="flex h-11 w-full items-center justify-center text-lg font-semibold text-text-primary-light transition-colors hover:bg-amber-900/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Decrease heat setting"
				onclick={() => onHeatChange(Math.max(0, heatValue - 1))}
				disabled={heatValue <= 0}
			>
				-
			</button>
		</div>
	</div>
</div>
