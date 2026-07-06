<script lang="ts">
	interface ThinkingStep {
		message: string;
		timestamp: Date;
	}

	let { steps = [], isActive = false } = $props<{
		steps: ThinkingStep[];
		isActive?: boolean;
	}>();

	function getStatusColor(message: string): string {
		if (message.includes('Found') && !message.includes('No ')) return 'text-success-strong';
		if (message.includes('Error') || message.includes('error')) return 'text-danger';
		if (message.includes('No ') || message.includes('Sorry')) return 'text-warning';
		return 'text-muted';
	}
</script>

<div class="space-y-1">
	{#each steps as step, index}
		{@const isLast = index === steps.length - 1}
		<div
			class="flex items-center gap-2 text-sm transition-opacity duration-200"
			style:opacity={isLast && isActive ? 1 : isLast ? 0.8 : 0.5}
		>
			<span
				class="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent {isLast && isActive
					? 'status-dot-active'
					: ''}"
			></span>
			<span class="font-mono text-xs {getStatusColor(step.message)}">
				{step.message}
			</span>
		</div>
	{/each}

	{#if isActive && steps.length === 0}
		<div class="flex items-center gap-2 text-sm">
			<span class="status-dot-active inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
			></span>
			<span class="font-mono text-xs text-muted">Thinking...</span>
		</div>
	{/if}
</div>

<style>
	.status-dot-active {
		animation: statusDotPulse 1.5s ease-in-out infinite;
	}

	@keyframes statusDotPulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}
</style>
