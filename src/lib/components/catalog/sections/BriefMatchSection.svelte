<script lang="ts">
	import type { SourcingBriefMatchSummary } from '$lib/procurement/sourcingBriefMatching';

	interface Props {
		briefMatchSummaries: SourcingBriefMatchSummary[];
	}

	let { briefMatchSummaries }: Props = $props();
</script>

<div
	class="rounded-lg border border-accent/30 bg-surface-panel px-4 py-3"
	aria-label="Sourcing brief matches"
>
	<p class="text-xs font-semibold text-accent">Active sourcing briefs</p>
	<div class="mt-2 flex flex-col gap-2">
		{#each briefMatchSummaries as summary}
			<div class="flex items-center justify-between gap-3 text-sm">
				<span class="font-medium text-ink">{summary.briefName}</span>
				<span class="shrink-0 text-xs text-muted">
					<span class="font-semibold text-accent">{summary.matchCount}</span>
					{summary.matchCount === 1 ? 'lot matches' : 'lots match'} criteria on this page
				</span>
			</div>
		{/each}
	</div>
</div>
