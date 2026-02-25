<script lang="ts">
	let {
		isRoasting,
		selectedEvent = $bindable(null),
		onEventLog
	}: {
		isRoasting: boolean;
		selectedEvent?: string | null;
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
							: 'text-text-primary-light'} {!isRoasting ? 'cursor-not-allowed opacity-50' : ''} {i %
							2 !==
						0
							? 'border-l border-border-light'
							: ''} {i > 1 ? 'border-t border-border-light' : ''}"
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
