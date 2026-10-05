<script lang="ts">
	import type { CatalogLock } from '$lib/catalog/filterModel';

	/** Says why a control is unavailable and where to get it. */
	let { lock, compact = false }: { lock: NonNullable<CatalogLock>; compact?: boolean } = $props();
</script>

<p class="min-w-0 text-muted {compact ? 'text-xs' : 'text-sm'}" data-catalog-lock>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 20 20"
		fill="currentColor"
		class="mr-1 inline h-3.5 w-3.5 align-[-0.125em]"
		aria-hidden="true"
	>
		<path
			fill-rule="evenodd"
			d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
			clip-rule="evenodd"
		/>
	</svg>
	<span>{lock.reason}</span>
	{' '}<a href={lock.href} class="font-semibold text-link hover:text-accent">{lock.action}</a>
</p>
