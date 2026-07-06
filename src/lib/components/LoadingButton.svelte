<script lang="ts">
	let {
		loading = false,
		disabled = false,
		variant = 'primary',
		size = 'medium',
		onclick,
		children,
		loadingText = 'Loading...',
		class: customClass = ''
	} = $props<{
		loading?: boolean;
		disabled?: boolean;
		variant: 'primary' | 'secondary' | 'danger' | 'success';
		size?: 'small' | 'medium' | 'large';
		onclick?: () => void | Promise<void>;
		children: import('svelte').Snippet;
		loadingText?: string;
		class?: string;
	}>();

	// Internal loading state for async functions (not initialized from prop)
	let isLoading = $state(false);

	// Handle click with automatic loading state for async functions
	async function handleClick() {
		if (loading || isLoading || disabled || !onclick) return;

		try {
			const result = onclick();

			// If onclick returns a Promise, manage loading state
			if (result instanceof Promise) {
				isLoading = true;
				await result;
			}
		} finally {
			isLoading = false;
		}
	}

	// Reactive loading state (external loading prop overrides internal state)
	let showLoading = $derived(loading || isLoading);
	let isDisabled = $derived(disabled || showLoading);

	// Style configurations
	const variantStyles = {
		primary: 'bg-accent text-ink hover:bg-opacity-90 disabled:bg-line',
		secondary:
			'border border-accent text-accent hover:bg-accent hover:text-white disabled:border-line disabled:text-muted',
		danger: 'bg-danger text-white hover:bg-danger-strong disabled:bg-line',
		success: 'bg-success text-white hover:bg-success-strong disabled:bg-line'
	};

	const sizeStyles = {
		small: 'px-2 py-1 text-sm',
		medium: 'px-4 py-2 text-base',
		large: 'px-6 py-3 text-lg'
	};

	const baseStyles =
		'rounded-md font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50';
</script>

<button
	class="{baseStyles} {variantStyles[variant as keyof typeof variantStyles]} {sizeStyles[
		size as keyof typeof sizeStyles
	]} {customClass}"
	onclick={handleClick}
	disabled={isDisabled}
>
	{#if showLoading}
		<div class="flex items-center gap-2">
			<div
				class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
			></div>
			<span>{loadingText}</span>
		</div>
	{:else}
		{@render children()}
	{/if}
</button>
