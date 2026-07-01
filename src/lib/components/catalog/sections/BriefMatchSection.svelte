<script lang="ts">
	import type { SourcingBriefMatchSummary } from '$lib/procurement/sourcingBriefMatching';

	interface Props {
		briefMatchSummaries: SourcingBriefMatchSummary[];
	}

	let { briefMatchSummaries }: Props = $props();
</script>

<div
	class="rounded-lg border border-background-tertiary-light/30 bg-background-secondary-light px-4 py-3"
	aria-label="Sourcing brief matches"
>
	<p class="text-xs font-semibold uppercase tracking-wide text-background-tertiary-light">
		Active sourcing briefs
	</p>
	<div class="mt-2 flex flex-col gap-2">
		{#each briefMatchSummaries as summary}
			<div class="flex items-center justify-between gap-3 text-sm">
				<span class="font-medium text-text-primary-light">{summary.briefName}</span>
				<span class="shrink-0 text-xs text-text-secondary-light">
					<span class="font-semibold text-background-tertiary-light">{summary.matchCount}</span>
					{summary.matchCount === 1 ? 'lot matches' : 'lots match'} criteria on this page
				</span>
			</div>
		{/each}
	</div>
</div>
