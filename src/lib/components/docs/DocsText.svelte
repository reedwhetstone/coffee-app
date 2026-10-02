<script lang="ts">
	import { splitInlineCode } from '$lib/docs/inline';

	let { text } = $props<{ text: string }>();
	let segments = $derived(splitInlineCode(text));
</script>

{#each segments as segment}{#if segment.code}<code
			class="rounded bg-surface-panel px-1.5 py-0.5 text-xs text-ink">{segment.text}</code
		>{:else}{segment.text}{/if}{/each}
