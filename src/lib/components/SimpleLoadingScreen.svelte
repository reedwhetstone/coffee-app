<script lang="ts">
	import { loadingStore } from '$lib/stores/loadingStore';

	let { 
		show = true, 
		message = 'Loading...', 
		progress,
		showProgress = false,
		overlay = true,
		size = 'medium'
	} = $props<{
		show?: boolean;
		message?: string;
		progress?: number;
		showProgress?: boolean;
		overlay?: boolean;
		size?: 'small' | 'medium' | 'large';
	}>();

	// If no explicit show prop, use global loading state
	let shouldShow = $derived(show !== undefined ? show : loadingStore.isAnyLoading);
	let displayMessage = $derived(message || loadingStore.primaryOperation?.message || 'Loading...');
	let displayProgress = $derived(progress ?? loadingStore.primaryOperation?.progress);

	// Size configurations
	const sizeConfig = {
		small: { spinner: 'h-6 w-6', text: 'text-sm' },
		medium: { spinner: 'h-12 w-12', text: 'text-lg' },
		large: { spinner: 'h-16 w-16', text: 'text-xl' }
	};
</script>

{#if shouldShow}
	<div class="{overlay ? 'fixed inset-0 z-50' : 'relative'} flex items-center justify-center {overlay ? 'bg-background-primary-light' : ''}">
		<div class="flex flex-col items-center space-y-4">
			<!-- Spinning circle with configurable size -->
			<div
				class="border-t-background-tertiary-light {sizeConfig[size as keyof typeof sizeConfig].spinner} animate-spin rounded-full border-4 border-background-secondary-light"
			></div>

			<!-- Loading message -->
			<p class="text-text-primary-light {sizeConfig[size as keyof typeof sizeConfig].text} font-medium text-center max-w-xs">
				{displayMessage}
			</p>

			<!-- Progress bar (optional) -->
			{#if showProgress && displayProgress !== undefined}
				<div class="w-64 bg-background-secondary-light rounded-full h-2">
					<div 
						class="bg-background-tertiary-light h-2 rounded-full transition-all duration-300"
						style="width: {Math.max(0, Math.min(100, displayProgress))}%"
					></div>
				</div>
				<p class="text-text-secondary-light text-sm">
					{Math.round(displayProgress)}%
				</p>
			{/if}
		</div>
	</div>
{/if}
