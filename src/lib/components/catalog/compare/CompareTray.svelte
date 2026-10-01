<script lang="ts">
	import { compareSelection } from '$lib/stores/compareSelection.svelte';
	import { compareHref, FULL_COMPARE_MAX } from '$lib/catalog/compareAccess';

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
	let canCompare = $derived(items.length >= 2);
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
					<a href="/auth" class="font-semibold text-link hover:text-accent">Sign in</a> to compare coffees
					side by side.
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
						href={canCompare ? compareHref(items.map((item) => item.id)) : undefined}
						aria-disabled={!canCompare}
						class="rounded-md px-4 py-2 text-sm font-semibold transition-colors {canCompare
							? 'bg-accent text-ink hover:bg-accent/85'
							: 'pointer-events-none bg-surface-panel text-muted'}"
					>
						{canCompare ? `Compare ${items.length}` : 'Pick one more'}
					</a>
				</div>
			{/if}
		</div>
	</div>
{/if}
