<script lang="ts">
	interface ThinkingStep {
		message: string;
		timestamp: Date;
	}

	let { steps = [], isActive = false } = $props<{ 
		steps: ThinkingStep[]; 
		isActive?: boolean;
	}>();

	// Get status color for different types of steps
	function getStatusColor(message: string): string {
		if (message.includes('Found') && !message.includes('No ')) return 'text-green-600';
		if (message.includes('No ') || message.includes('Sorry')) return 'text-amber-600';
		if (message.includes('issue') || message.includes('trouble')) return 'text-red-600';
		return 'text-text-secondary-light';
	}
</script>

<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
	<div class="space-y-3">
		{#each steps as step, index}
			<div class="fade-in" style="animation-delay: {index * 0.1}s">
				<div class="flex items-start space-x-3">
					<!-- Simple dot indicator -->
					<div class="flex-shrink-0 mt-1.5">
						<div class="h-1.5 w-1.5 rounded-full bg-background-tertiary-light opacity-60"></div>
					</div>
					
					<!-- Message content -->
					<div class="flex-1 min-w-0">
						<span class="text-sm {getStatusColor(step.message)} break-words">
							{step.message}
						</span>
						<div class="text-xs text-text-secondary-light mt-1 opacity-60">
							{step.timestamp.toLocaleTimeString()}
						</div>
					</div>
				</div>
			</div>
		{/each}

		{#if isActive && steps.length === 0}
			<div class="flex items-center space-x-3">
				<div class="flex-shrink-0">
					<div class="h-1.5 w-1.5 rounded-full bg-background-tertiary-light animate-pulse"></div>
				</div>
				<span class="text-sm text-text-primary-light typing-animation">
					Thinking...
				</span>
			</div>
		{/if}
	</div>
</div>

<style>
	.fade-in {
		animation: fadeIn 0.4s ease-out;
		opacity: 0;
		animation-fill-mode: forwards;
	}

	.typing-animation {
		animation: typewriter 1.5s steps(20) infinite;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes typewriter {
		0%, 90% {
			opacity: 1;
		}
		95%, 100% {
			opacity: 0.3;
		}
	}
</style>
