<script lang="ts">
	import type { Snippet } from 'svelte';

	// Button component following the Coffee App UI Framework
	let {
		variant = 'primary',
		size = 'default',
		disabled = false,
		onclick = () => {},
		type = 'button',
		class: additionalClasses = '',
		children
	} = $props<{
		variant?: 'primary' | 'secondary' | 'danger';
		size?: 'sm' | 'default' | 'lg';
		disabled?: boolean;
		onclick?: () => void;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		children: Snippet;
	}>();

	// Base button classes following UI framework
	const baseClasses =
		'rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-background-tertiary-light focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

	// Variant classes
	const variantClasses: Record<'primary' | 'secondary' | 'danger', string> = {
		primary: 'bg-background-tertiary-light text-white hover:bg-opacity-90',
		secondary:
			'border border-background-tertiary-light text-background-tertiary-light hover:bg-background-tertiary-light hover:text-white',
		danger: 'border border-red-600 text-red-600 hover:bg-red-600 hover:text-white'
	};

	// Size classes
	const sizeClasses: Record<'sm' | 'default' | 'lg', string> = {
		sm: 'px-3 py-1 text-sm',
		default: 'px-4 py-2',
		lg: 'px-6 py-3'
	};

	// Combine all classes
	let buttonClass = $derived(
		`${baseClasses} ${variantClasses[variant as keyof typeof variantClasses]} ${sizeClasses[size as keyof typeof sizeClasses]} ${additionalClasses}`
	);
</script>

<button {type} {disabled} {onclick} class={buttonClass}>
	{@render children()}
</button>
