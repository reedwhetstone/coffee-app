<script lang="ts">
	interface ThinkingStep {
		message: string;
		timestamp: Date;
	}

	let { steps = [] } = $props<{ steps: ThinkingStep[] }>();
</script>

<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
	<div class="space-y-2">
		{#each steps as step}
			<div class="fade-in">
				<div class="flex items-center space-x-2">
					<div class="h-1 w-1 rounded-full bg-background-tertiary-light"></div>
					<span class="font-mono text-sm text-text-secondary-light">
						{step.message}
					</span>
				</div>
			</div>
		{/each}

		{#if steps.length > 0}
			<div class="flex items-center space-x-2">
				<div class="h-1 w-1 animate-pulse rounded-full bg-background-tertiary-light"></div>
				<span class="animate-pulse font-mono text-sm text-text-primary-light"> Thinking... </span>
			</div>
		{/if}
	</div>
</div>

<style>
	.fade-in {
		animation: fadeIn 0.3s ease-in-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
