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

<details
	open={isActive}
	class="group text-xs text-muted"
	role="status"
	aria-live="polite"
	aria-atomic="true"
	aria-label={isActive ? 'Parchment is working' : 'Parchment activity'}
>
	<summary class="flex cursor-pointer list-none items-center gap-2 py-1 hover:text-ink">
		<span
			class="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent {isActive
				? 'status-dot-active'
				: ''}"
		></span>
		<span
			>{isActive
				? 'Researching…'
				: `Research activity · ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`}</span
		>
		<svg
			class="h-3 w-3 transition-transform group-open:rotate-90"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5l7 7-7 7" />
		</svg>
	</summary>
	<div class="space-y-1 border-l border-line pl-3">
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
				<span class="text-xs {getStatusColor(step.message)}">
					{step.message}
				</span>
			</div>
		{/each}

		{#if isActive && steps.length === 0}
			<div class="flex items-center gap-2 text-sm">
				<span
					class="status-dot-active inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
				></span>
				<span class="text-xs text-muted">Preparing the research plan…</span>
			</div>
		{/if}
	</div>
</details>

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
