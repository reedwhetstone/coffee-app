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
				class="rounded-full border border-border-light bg-background-primary-light px-3 py-1 text-xs text-text-secondary-light transition-all hover:border-background-tertiary-light/50 hover:text-text-primary-light"
			>
				{suggestion.label}
			</button>
		{/each}
	</div>
{/if}
