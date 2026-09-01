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
	class="mb-6 rounded-lg border border-line bg-surface-panel p-4 sm:p-5"
	aria-label="Analyze this market read with Cherry AI"
>
	<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
		<div>
			<h2 class="font-serif text-lg font-medium text-ink">
				Analyze this market read with Cherry AI.
			</h2>
			<p class="mt-1 text-sm text-muted">
				Cherry AI opens with your current scope and movement window already in context. Go straight
				from “prices moved” to “what should I do about it.”
			</p>
		</div>
		<AnalyticsActionCta
			eyebrow="Cherry AI"
			title="Analyze this market read"
			description="Open Cherry AI with the current scope, movement window, and market evidence already framed in the prompt."
			ctaLabel={askActionLabel}
			href={askActionHref}
			statusLabel={askActionStatus}
			tone={canAskWithAnalyticsContext ? 'primary' : 'secondary'}
		/>
	</div>
</section>
