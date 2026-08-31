<script lang="ts">
	let { heading = 'The weekly green coffee market read.', compact = false } = $props<{
		heading?: string;
		compact?: boolean;
	}>();
</script>

<aside
	class={compact
		? 'rounded-xl border border-line bg-surface-panel p-5 sm:flex sm:items-center sm:justify-between sm:gap-6'
		: 'rounded-2xl border border-line bg-surface-panel p-6 sm:p-8'}
	aria-label="Purveyors Market Brief"
>
	<div>
		<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Market Brief</p>
		<h2 class="mt-2 font-serif text-2xl font-medium text-ink">{heading}</h2>
		<p class="mt-2 max-w-2xl text-sm leading-6 text-muted">
			A concise, cited read on green coffee pricing, availability, and movement, planned as a weekly
			publication.
		</p>
	</div>
	<a
		href="/market-wire"
		class="mt-5 inline-flex shrink-0 items-center rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 sm:mt-0"
	>
		Join the waitlist
		<span class="ml-2" aria-hidden="true">→</span>
	</a>
</aside>
