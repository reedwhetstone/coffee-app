<script lang="ts">
	interface ThinkingStep {
		message: string;
		timestamp: Date;
	}

	let { steps = [], isActive = false } = $props<{
		steps: ThinkingStep[];
		isActive?: boolean;
	}>();

	// Coffee brewing words organized by phases
	const coffeeWords = {
		warmup: [
			'Charging',
			'Preheating',
			'Grinding',
			'Prepping',
			'Tamping',
			'Weighing', // measuring green
			'Sorting', // defect removal
			'Dosing'
		],
		execution: [
			'Brewing',
			'Percolating',
			'Blooming',
			'Steeping',
			'Stirring',
			'Frothing',
			'Drying',
			'Cracking',
			'Extracting',
			'Channeling',
			'Yellowing',
			'Filtering',
			'Cupping',
			'Roasting',
			'Degassing',
			'Foaming',
			"Crema'ing",
			'Pouring',
			'Cooling',
			'Sipping',
			'Knocking',
			'Browning',
			'Maillard-ing?',
			'Caramelizing',
			'Rolling',
			'Puffing',
			'Exotherming',
			'Pacing',
			'Tracking',
			'Logging',
			'Dialing',
			'Blending',
			'Bagging',
			'Tasting',
			'Slurping',
			'Sampling',
			'Sourcing',
			'Burning'
		]
	};

	// Track current word with $state to prevent flickering
	let currentWord = $state('');
	let lastStepCount = $state(-1);

	// Only pick new word when step count changes
	$effect(() => {
		const stepCount = steps.length;

		if (stepCount !== lastStepCount) {
			lastStepCount = stepCount;

			if (stepCount === 0) {
				// Randomly choose from warmup words for initial step
				const randomIndex = Math.floor(Math.random() * coffeeWords.warmup.length);
				currentWord = coffeeWords.warmup[randomIndex];
			} else {
				// After warmup, randomly choose from execution array
				const randomIndex = Math.floor(Math.random() * coffeeWords.execution.length);
				currentWord = coffeeWords.execution[randomIndex];
			}
		}
	});

	// Get status color for different types of steps
	function getStatusColor(message: string): string {
		if (message.includes('Found') && !message.includes('No ')) return 'text-green-600';
		if (message.includes('No ') || message.includes('Sorry')) return 'text-amber-600';
		if (message.includes('issue') || message.includes('trouble')) return 'text-red-600';
		return 'text-text-secondary-light';
	}
</script>

<div
	class="rounded-lg bg-background-secondary-light p-4 ring-1 ring-border-light transition-all duration-300"
>
	<div class="space-y-3">
		{#each steps as step, index}
			<div class="fade-in" style="animation-delay: {index * 0.1}s">
				<div class="flex items-start space-x-3">
					<!-- Simple dot indicator -->
					<div class="mt-1.5 flex-shrink-0">
						<div class="h-1.5 w-1.5 rounded-full bg-background-tertiary-light opacity-60"></div>
					</div>

					<!-- Message content -->
					<div class="min-w-0 flex-1">
						<span class="text-sm {getStatusColor(step.message)} break-words">
							{step.message}
						</span>
						<div class="mt-1 text-xs text-text-secondary-light opacity-60">
							{step.timestamp.toLocaleTimeString()}
						</div>
					</div>
				</div>
			</div>
		{/each}

		<!-- Coffee word indicator - shows when active -->
		{#if isActive}
			<div class="coffee-indicator flex items-center space-x-3">
				<div class="flex-shrink-0">
					<div class="h-1.5 w-1.5 animate-pulse rounded-full bg-background-tertiary-light"></div>
				</div>
				<span class="coffee-word text-sm text-text-primary-light">
					{currentWord}...
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

	.coffee-word {
		animation: coffeeBrewPulse 2s ease-in-out infinite;
	}

	.coffee-indicator {
		animation: fadeIn 0.3s ease-out;
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

	@keyframes coffeeBrewPulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(1.02);
		}
	}

	/* Smooth exit animation when transitioning to final response */
	:global(.chain-of-thought-exit) {
		animation: fadeOut 0.5s ease-in-out forwards;
	}

	@keyframes fadeOut {
		from {
			opacity: 1;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(0.95);
		}
	}
</style>
