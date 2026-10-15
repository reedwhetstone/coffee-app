<script lang="ts">
	import type { DecafPresentation } from '$lib/catalog/decafPresentation';

	let { presentation } = $props<{ presentation: DecafPresentation }>();
</script>

{#if presentation.isDecaffeinated}
	<span
		class="inline-flex items-center rounded-full bg-surface-panel px-2 py-0.5 text-[10px] font-semibold text-ink ring-1 ring-line"
		aria-label={presentation.methodLabel ? `Decaf · ${presentation.methodLabel}` : 'Decaffeinated'}
		title="Supplier identifies this coffee as decaffeinated"
	>
		Decaf{#if presentation.methodLabel}<span aria-hidden="true">
				·
			</span>{presentation.methodLabel}{/if}
	</span>
{/if}
