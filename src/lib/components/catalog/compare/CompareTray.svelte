<script lang="ts">
	import { page } from '$app/state';
	import { compareSelection } from '$lib/stores/compareSelection.svelte';
	import {
		canOpenComparison,
		compareHref,
		FULL_COMPARE_MAX,
		signInHref
	} from '$lib/catalog/compareAccess';

	let {
		limit,
		notice = null,
		onDismissNotice
	}: {
		limit: number;
		notice?: 'sign_in' | 'limit' | null;
		onDismissNotice?: () => void;
	} = $props();

	let items = $derived(compareSelection.items);
	let canCompare = $derived(canOpenComparison(items.length, limit));
	// The selection outlives sign-out and plan changes, so it can sit above the
	// current limit. Keep it, but only offer what the visitor can open now.
	let signedOut = $derived(limit === 0);
	let overLimit = $derived(limit > 0 && items.length > limit);
	let ctaHref = $derived(
		canCompare
			? compareHref(items.map((item) => item.id))
			: signedOut
				? signInHref(page.url)
				: undefined
	);
	let ctaLabel = $derived(
		canCompare
			? `Compare ${items.length}`
			: signedOut
				? 'Sign in to compare'
				: overLimit
					? `Remove ${items.length - limit} to compare`
					: 'Pick one more'
	);
</script>

{#if items.length > 0 || notice}
	<div
		class="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
		role="region"
		aria-label="Coffee comparison"
	>
		<div
			class="flex w-full max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-raised px-4 py-3 shadow-lg"
		>
			{#if notice === 'sign_in'}
				<p class="flex-1 text-sm text-ink">
					<a href={signInHref(page.url)} class="font-semibold text-link hover:text-accent"
						>Sign in</a
					> to compare coffees side by side.
				</p>
			{:else if notice === 'limit'}
				<p class="flex-1 text-sm text-ink">
					{#if limit < FULL_COMPARE_MAX}
						Free accounts compare {limit} coffees.
						<a href="/subscription" class="font-semibold text-link hover:text-accent"
							>Members compare up to {FULL_COMPARE_MAX}.</a
						>
					{:else}
						You can compare up to {limit} coffees at a time.
					{/if}
				</p>
			{/if}
			{#if notice}
				<button
					type="button"
					class="text-xs text-muted hover:text-ink"
					aria-label="Dismiss"
					onclick={() => onDismissNotice?.()}>✕</button
				>
			{/if}

			{#if items.length > 0}
				<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
					<span class="text-xs font-semibold text-muted">Compare {items.length}/{limit || '–'}</span
					>
					{#each items as item (item.id)}
						<span
							class="inline-flex max-w-[12rem] items-center gap-1 rounded-full bg-surface-panel px-2.5 py-1 text-xs text-ink ring-1 ring-line"
						>
							<span class="truncate" title={item.name}>{item.name}</span>
							<button
								type="button"
								class="text-muted hover:text-ink"
								aria-label={`Remove ${item.name} from comparison`}
								onclick={() => compareSelection.remove(item.id)}>✕</button
							>
						</span>
					{/each}
				</div>
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="text-xs text-muted hover:text-ink"
						onclick={() => compareSelection.clear()}>Clear</button
					>
					<a
						href={ctaHref}
						aria-disabled={!ctaHref}
						class="rounded-md px-4 py-2 text-sm font-semibold transition-colors {ctaHref
							? 'bg-accent text-ink hover:bg-accent/85'
							: 'pointer-events-none bg-surface-panel text-muted'}"
					>
						{ctaLabel}
					</a>
				</div>
			{/if}
		</div>
	</div>
{/if}
