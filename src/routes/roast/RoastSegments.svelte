<script lang="ts">
	import { savedHref } from '$lib/roast/saved-library';

	// The two lists under Roast: what was roasted, and what was kept to repeat or follow.
	let { current }: { current: 'roasts' | 'saved' } = $props();

	const segments = [
		{ key: 'roasts', label: 'Roasts', href: '/roast' },
		{ key: 'saved', label: 'Saved references and plans', href: savedHref() }
	] as const;
</script>

<nav
	aria-label="Roasts, and saved references and plans"
	class="mb-4 inline-flex max-w-full rounded-lg border border-line bg-surface-panel p-1"
>
	{#each segments as segment (segment.key)}
		<a
			href={segment.href}
			aria-current={segment.key === current ? 'page' : undefined}
			class="rounded-md px-3 py-2 text-sm font-medium transition-colors {segment.key === current
				? 'bg-surface-raised text-ink shadow-sm'
				: 'text-muted hover:text-ink'}"
		>
			{segment.label}
		</a>
	{/each}
</nav>
