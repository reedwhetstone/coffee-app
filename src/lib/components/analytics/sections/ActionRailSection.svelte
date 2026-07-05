<script lang="ts">
	import AnalyticsActionCta from '$lib/components/analytics/AnalyticsActionCta.svelte';

	interface Props {
		askActionLabel: string;
		askActionHref: string | undefined;
		askActionStatus: string;
		canAskWithAnalyticsContext: boolean;
	}

	let { askActionLabel, askActionHref, askActionStatus, canAskWithAnalyticsContext }: Props =
		$props();
</script>

<section
	class="mb-6 rounded-xl border border-background-tertiary-light/20 bg-background-secondary-light p-5"
	aria-label="Action rail"
>
	<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
		<div>
			<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
				Next investigation
			</p>
			<h2 class="mt-1 text-lg font-semibold text-text-primary-light">
				Ask the chat agent with this market context.
			</h2>
			<p class="mt-1 text-sm text-text-secondary-light">
				The chat agent opens with your current market read, scope, and movement window already in
				context — so you can go straight from "prices moved" to "here's what I should do about it."
			</p>
		</div>
		<AnalyticsActionCta
			eyebrow="Ask"
			title="Ask about this market read"
			description="Open chat with the current scope, movement window, and market evidence already framed in the prompt."
			ctaLabel={askActionLabel}
			href={askActionHref}
			statusLabel={askActionStatus}
			tone={canAskWithAnalyticsContext ? 'primary' : 'secondary'}
		/>
	</div>
</section>
