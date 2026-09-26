<script lang="ts">
	import { getContext, type Snippet } from 'svelte';
	import { catalogReferenceId, safeAnswerLink } from '$lib/services/coffeeReferences';
	import { COFFEE_REFERENCE_CONTEXT, type CoffeeReferenceContext } from './coffeeReferenceContext';
	let {
		href = '',
		title,
		children
	}: { href?: string; title?: string; children?: Snippet } = $props();
	const context = getContext<CoffeeReferenceContext>(COFFEE_REFERENCE_CONTEXT);
	let id = $derived(catalogReferenceId(href));
	let reference = $derived(typeof id === 'number' ? context.resolve(id) : undefined);
</script>

{#if reference}
	<button
		type="button"
		class="inline rounded-sm font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
		title={`Inspect ${reference.coffee.name} from this answer`}
		onclick={(event) => {
			if (reference) context.open(reference, event.currentTarget);
		}}>{reference.coffee.name}</button
	>
{:else if id !== null}
	<span>{@render children?.()} <span class="text-xs text-muted">(details unavailable)</span></span>
{:else if safeAnswerLink(href)}
	<a href={safeAnswerLink(href)} {title}>{@render children?.()}</a>
{:else}
	<span>{@render children?.()}</span>
{/if}
