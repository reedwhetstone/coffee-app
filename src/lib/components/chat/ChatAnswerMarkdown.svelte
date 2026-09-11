<script lang="ts">
	import { setContext, tick } from 'svelte';
	import SvelteMarkdown from '@humanspeak/svelte-markdown';
	import CoffeeCard from '$lib/components/CoffeeCard.svelte';
	import { parseTastingNotes } from '$lib/utils/parseTastingNotes';
	import {
		coffeeReferencesThroughPart,
		type CoffeeReference,
		type ReferenceMessage
	} from '$lib/services/coffeeReferences';
	import { COFFEE_REFERENCE_CONTEXT, type CoffeeReferenceContext } from './coffeeReferenceContext';
	import CoffeeReferenceLink from './CoffeeReferenceLink.svelte';
	let {
		source,
		messages,
		messageIndex,
		partIndex
	}: { source: string; messages: ReferenceMessage[]; messageIndex: number; partIndex: number } =
		$props();
	let references = $derived(coffeeReferencesThroughPart(messages, messageIndex, partIndex));
	let selected = $state.raw<CoffeeReference | null>(null);
	let trigger: HTMLButtonElement | null = null;
	let detailRoot: HTMLDivElement | undefined = $state();
	$effect(() => {
		if (selected)
			void tick().then(() =>
				detailRoot
					?.querySelector<HTMLButtonElement>('[data-coffee-detail-layer] header button')
					?.focus()
			);
	});
	setContext<CoffeeReferenceContext>(COFFEE_REFERENCE_CONTEXT, {
		resolve: (id) => references.get(id),
		open: (reference, element) => {
			// Freeze what was cited; later reads cannot rewrite an open inspection.
			selected = { ...reference, coffee: JSON.parse(JSON.stringify(reference.coffee)) };
			trigger = element;
		}
	});
	async function close() {
		selected = null;
		await tick();
		if (trigger?.isConnected) trigger.focus();
	}
</script>

<div
	class="prose prose-sm max-w-2xl text-ink prose-headings:text-ink prose-p:leading-7 prose-p:text-ink prose-strong:text-ink prose-ol:text-ink prose-ul:text-ink prose-li:text-ink"
>
	<SvelteMarkdown {source} renderers={{ link: CoffeeReferenceLink }} />
</div>
{#if selected}
	<div bind:this={detailRoot} class="not-prose">
		<CoffeeCard
			coffee={selected.coffee}
			{parseTastingNotes}
			detailOnly={true}
			initialDetailsOpen={true}
			showCatalogLink={true}
			detailCloseLabel="Back to answer"
			onDetailClose={() => void close()}
			detailNotice="Details retrieved for this answer. Prices and availability may have changed."
		/>
	</div>
{/if}
