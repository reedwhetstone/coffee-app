<script lang="ts">
	interface ThinkingStep {
		message: string;
		timestamp: Date;
	}

	let { steps = [], isActive = false } = $props<{ 
		steps: ThinkingStep[]; 
		isActive?: boolean;
	}>();

	// Extract icon from message if present
	function extractIcon(message: string): { icon: string; text: string } {
		const emojiRegex = /^([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}])\s*/u;
		const match = message.match(emojiRegex);
		
		if (match) {
			return {
				icon: match[1],
				text: message.replace(emojiRegex, '')
			};
		}
		
		return { icon: '•', text: message };
	}

	// Get status color based on message type
	function getStatusColor(message: string): string {
		if (message.includes('✅')) return 'text-green-500';
		if (message.includes('❌')) return 'text-red-500';
		if (message.includes('⚠️')) return 'text-yellow-500';
		if (message.includes('🔍') || message.includes('📦') || message.includes('📊')) return 'text-blue-500';
		return 'text-text-secondary-light';
	}
</script>

<div class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light">
	<div class="space-y-3">
		{#each steps as step, index}
			{@const { icon, text } = extractIcon(step.message)}
			<div class="fade-in" style="animation-delay: {index * 0.1}s">
				<div class="flex items-start space-x-3">
					<!-- Icon/Status indicator -->
					<div class="flex-shrink-0 mt-0.5">
						<span class="text-sm {getStatusColor(step.message)}">{icon}</span>
					</div>
					
					<!-- Message content -->
					<div class="flex-1 min-w-0">
						<span class="font-mono text-sm {getStatusColor(step.message)} break-words">
							{text}
						</span>
						<div class="text-xs text-text-secondary-light mt-1 opacity-60">
							{step.timestamp.toLocaleTimeString()}
						</div>
					</div>
				</div>
			</div>
		{/each}

		{#if isActive && steps.length > 0}
			<div class="flex items-center space-x-3 opacity-75">
				<div class="flex-shrink-0">
					<div class="h-2 w-2 rounded-full bg-background-tertiary-light animate-pulse"></div>
				</div>
				<span class="font-mono text-sm text-text-primary-light typing-animation">
					Processing...
				</span>
			</div>
		{/if}

		{#if isActive && steps.length === 0}
			<div class="flex items-center space-x-3">
				<div class="flex-shrink-0">
					<div class="h-2 w-2 rounded-full bg-background-tertiary-light animate-pulse"></div>
				</div>
				<span class="font-mono text-sm text-text-primary-light typing-animation">
					Initializing AI assistant...
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
