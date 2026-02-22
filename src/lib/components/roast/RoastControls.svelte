<script lang="ts">
	let {
		fanValue = $bindable(),
		heatValue = $bindable(),
		isRoasting,
		selectedEvent = $bindable(null),
		onFanChange,
		onHeatChange,
		onEventLog
	}: {
		fanValue: number;
		heatValue: number;
		isRoasting: boolean;
		selectedEvent?: string | null;
		onFanChange: (value: number) => void;
		onHeatChange: (value: number) => void;
		onEventLog: (event: string) => void;
	} = $props();

	const ROAST_EVENTS = [
		'Charge',
		'Maillard',
		'FC Start',
		'FC Rolling',
		'FC End',
		'SC Start',
		'Drop',
		'Cool End'
	];
</script>

<div class="flex flex-col gap-4 sm:flex-row sm:gap-6">
	<!-- Fan and Heat controls -->
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

	<!-- Roast events timeline -->
	<div class="flex-grow">
		<div class="mb-4">
			<h3 class="mb-2 text-sm font-medium text-text-secondary-light">ROAST EVENTS</h3>
			<div class="relative overflow-x-auto">
				<div class="rounded-lg border border-border-light bg-background-primary-light shadow-sm">
					<!-- Mobile view: Grid layout with 2 buttons per row -->
					<div class="grid grid-cols-2 sm:hidden">
						{#each ROAST_EVENTS as event, i}
							<button
								type="button"
								class="cursor-pointer whitespace-nowrap p-2 text-center transition-colors hover:bg-background-tertiary-light/10 {selectedEvent ===
								event
									? 'bg-background-tertiary-light text-text-primary-light'
									: 'text-text-primary-light'} {!isRoasting
									? 'cursor-not-allowed opacity-50'
									: ''} {i % 2 !== 0 ? 'border-l border-border-light' : ''} {i > 1
									? 'border-t border-border-light'
									: ''}"
								onclick={() => isRoasting && onEventLog(event)}
								disabled={!isRoasting}
							>
								<span class="block text-xs font-medium">{event}</span>
							</button>
						{/each}
					</div>

					<!-- Desktop view: Flex layout with all buttons in one row -->
					<div class="hidden w-full sm:flex">
						{#each ROAST_EVENTS as event, i}
							<button
								type="button"
								class="flex-1 cursor-pointer whitespace-nowrap p-3 text-center transition-colors hover:bg-background-tertiary-light/10 {selectedEvent ===
								event
									? 'bg-background-tertiary-light text-text-primary-light'
									: 'text-text-primary-light'} {!isRoasting
									? 'cursor-not-allowed opacity-50'
									: ''} {i !== 0 ? 'border-l border-border-light' : ''}"
								onclick={() => isRoasting && onEventLog(event)}
								disabled={!isRoasting}
							>
								<span class="block text-sm font-medium">{event}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
