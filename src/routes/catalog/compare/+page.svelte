<script lang="ts">
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import CompareTable from '$lib/components/catalog/compare/CompareTable.svelte';
	import { compareSelection } from '$lib/stores/compareSelection.svelte';
	import { compareHref, FULL_COMPARE_MAX, signInHref } from '$lib/catalog/compareAccess';

	let { data }: { data: PageData } = $props();

	// Only the coffees Parchment returned make up the comparison; ids it reported
	// missing are dropped from quantity changes, removals, and the tray.
	let lotIds = $derived(
		data.state.status === 'ready' ? data.state.comparison.lots.map((lot) => lot.id) : data.ids
	);

	// A shared comparison link becomes the current selection, so the catalog tray
	// reflects it when the user goes back to add or remove coffees. The write is
	// untracked so updating the selection never re-runs this effect.
	$effect(() => {
		if (data.state.status !== 'ready') return;
		const lots = data.state.comparison.lots;
		untrack(() => compareSelection.replace(lots.map((lot) => ({ id: lot.id, name: lot.name }))));
	});

	function changeQuantity(quantityLbs: number) {
		void goto(compareHref(lotIds, quantityLbs), { keepFocus: true, noScroll: true });
	}

	function remove(id: number) {
		compareSelection.remove(id);
		const remaining = lotIds.filter((existing) => existing !== id);
		void goto(remaining.length >= 2 ? compareHref(remaining, data.quantityLbs) : '/catalog');
	}
</script>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<a href="/catalog" class="text-sm text-link hover:text-accent">← Back to catalog</a>
			<h1 class="mt-2 font-serif text-3xl font-medium text-ink">Compare coffees</h1>
		</div>
	</div>

	{#if data.state.status === 'ready'}
		{#if data.state.comparison.missingIds.length > 0}
			<p class="rounded-md bg-surface-panel px-4 py-2 text-sm text-muted">
				{data.state.comparison.missingIds.length === 1
					? 'One coffee'
					: `${data.state.comparison.missingIds.length} coffees`}
				in this link are no longer available to you and were left out.
			</p>
		{/if}
		<CompareTable
			comparison={data.state.comparison}
			quantityOptions={data.quantityOptions}
			onQuantityChange={changeQuantity}
			onRemove={remove}
		/>
	{:else if data.state.status === 'empty'}
		<section class="rounded-lg border border-line bg-surface-panel p-6">
			<h2 class="text-lg font-semibold text-ink">Pick at least two coffees</h2>
			{#if data.state.unavailable}
				<p class="mt-1 text-sm text-muted">
					{data.state.unavailable === 1 ? 'One coffee' : `${data.state.unavailable} coffees`}
					in this link {data.state.unavailable === 1 ? 'is' : 'are'} no longer available to you.
				</p>
			{/if}
			<p class="mt-1 text-sm text-muted">
				Use Compare on coffee cards in the catalog, then open the comparison from the tray.
			</p>
			<a
				href="/catalog"
				class="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent/85"
				>Browse the catalog</a
			>
		</section>
	{:else if data.state.status === 'sign_in'}
		<section class="rounded-lg border border-line bg-surface-panel p-6">
			<h2 class="text-lg font-semibold text-ink">Sign in to compare coffees</h2>
			<p class="mt-1 text-sm text-muted">
				Free accounts compare two coffees side by side. Members compare up to {FULL_COMPARE_MAX}.
			</p>
			<a
				href={signInHref(page.url)}
				class="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent/85"
				>Sign in</a
			>
		</section>
	{:else if data.state.status === 'limit'}
		<section class="rounded-lg border border-line bg-surface-panel p-6">
			<h2 class="text-lg font-semibold text-ink">Too many coffees for your plan</h2>
			<p class="mt-1 text-sm text-muted">{data.state.message}</p>
			<a
				href="/subscription"
				class="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink hover:bg-accent/85"
				>Compare plans</a
			>
		</section>
	{:else}
		<section class="rounded-lg border border-line bg-surface-panel p-6" role="alert">
			<h2 class="text-lg font-semibold text-ink">Comparison unavailable</h2>
			<p class="mt-1 text-sm text-muted">{data.state.message}</p>
		</section>
	{/if}
</div>
