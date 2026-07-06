<script lang="ts">
	import type { Suggestion } from '$lib/services/suggestionEngine';

	let { suggestions, onSelect } = $props<{
		suggestions: Suggestion[];
		onSelect: (text: string) => void;
	}>();
</script>

{#if suggestions.length > 0}
	<div class="flex flex-wrap gap-1.5 px-1 pb-2">
		{#each suggestions as suggestion (suggestion.label)}
			<button
				onclick={() => onSelect(suggestion.text)}
				class="rounded-full border border-line bg-surface-canvas px-3 py-1 text-xs text-muted transition-all hover:border-accent/50 hover:text-ink"
			>
				{suggestion.label}
			</button>
		{/each}
	</div>
{/if}
