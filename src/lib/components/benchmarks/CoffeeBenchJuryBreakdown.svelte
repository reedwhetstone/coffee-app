<script lang="ts">
	import type {
		CoffeeBenchIndependentPublicExport,
		CoffeeBenchIndependentSlice,
		CoffeeBenchPairwiseMatchup
	} from '$lib/benchmarks/coffeebench';
	import { formatRate } from '$lib/benchmarks/display';

	type SliceId = CoffeeBenchIndependentSlice['slice_id'];
	type CoffeeBenchIndependentSubject = CoffeeBenchIndependentPublicExport['subjects'][number];

	let { slices, subjects } = $props<{
		slices: CoffeeBenchIndependentSlice[];
		subjects: CoffeeBenchIndependentSubject[];
	}>();

	let selectedSliceId = $state<SliceId>('overall');
	let selectedSlice: CoffeeBenchIndependentSlice = $derived(
		slices.find((slice: CoffeeBenchIndependentSlice) => slice.slice_id === selectedSliceId) ??
			slices[0]
	);
	let matchups: CoffeeBenchPairwiseMatchup[] = $derived(
		selectedSlice.track_results[0].pairwise_matchups ?? []
	);
	let subjectById: Map<string, CoffeeBenchIndependentSubject> = $derived(
		new Map(subjects.map((subject: CoffeeBenchIndependentSubject) => [subject.subject_id, subject]))
	);

	function subjectName(subjectId: string): string {
		return (subjectById.get(subjectId)?.display_name ?? subjectId)
			.replace('DeepSeek V4 with ', '')
			.replace('DeepSeek V4 ', '');
	}

	function juryName(family: 'openai' | 'google' | 'anthropic'): string {
		return family === 'openai' ? 'OpenAI' : family[0].toUpperCase() + family.slice(1);
	}

	function counts(matchup: CoffeeBenchPairwiseMatchup): string {
		return `${matchup.subject_a_win_count} wins · ${matchup.tie_count} ties · ${matchup.subject_b_win_count} losses`;
	}
</script>

<div>
	<div class="flex flex-wrap gap-2" role="group" aria-label="Pairwise result cohort">
		{#each slices as slice (slice.slice_id)}
			<button
				type="button"
				class="rounded-full px-4 py-2 text-sm font-medium ring-1 transition"
				class:bg-ink={selectedSliceId === slice.slice_id}
				class:text-surface-raised={selectedSliceId === slice.slice_id}
				class:ring-ink={selectedSliceId === slice.slice_id}
				class:bg-surface-panel={selectedSliceId !== slice.slice_id}
				class:text-muted={selectedSliceId !== slice.slice_id}
				class:ring-line={selectedSliceId !== slice.slice_id}
				aria-pressed={selectedSliceId === slice.slice_id}
				onclick={() => (selectedSliceId = slice.slice_id)}
			>
				{slice.label}
			</button>
		{/each}
	</div>

	<div class="mt-6 grid gap-4 xl:grid-cols-2">
		{#each matchups as matchup (`${selectedSlice.slice_id}-${matchup.subject_a}-${matchup.subject_b}`)}
			<article class="rounded-2xl border border-line bg-surface-panel p-5">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3 class="font-semibold text-ink">
							{subjectName(matchup.subject_a)} vs {subjectName(matchup.subject_b)}
						</h3>
						<p class="mt-1 text-xs text-muted">{counts(matchup)}</p>
					</div>
					<p class="text-sm font-semibold tabular-nums text-ink">
						{formatRate(matchup.subject_a_preference_share)} · {formatRate(
							matchup.subject_b_preference_share
						)}
					</p>
				</div>

				<div
					class="mt-4 flex h-3 overflow-hidden rounded-full bg-line"
					role="img"
					aria-label={`${subjectName(matchup.subject_a)} ${formatRate(matchup.subject_a_preference_share)}, ${subjectName(matchup.subject_b)} ${formatRate(matchup.subject_b_preference_share)}`}
				>
					<div
						class="bg-chart-rust"
						style={`width: ${matchup.subject_a_preference_share * 100}%`}
					></div>
					<div
						class="bg-chart-teal"
						style={`width: ${matchup.subject_b_preference_share * 100}%`}
					></div>
				</div>

				<div class="mt-5 space-y-3 border-t border-line pt-4">
					{#each matchup.jury_families as family (family.family)}
						<div class="grid grid-cols-[4.75rem_minmax(0,1fr)_6.75rem] items-center gap-3">
							<p class="text-xs font-medium text-ink">{juryName(family.family)}</p>
							<div
								class="flex h-2.5 overflow-hidden rounded-full bg-line"
								role="img"
								aria-label={`${juryName(family.family)}: ${subjectName(matchup.subject_a)} ${formatRate(family.subject_a_preference_share)}, ${subjectName(matchup.subject_b)} ${formatRate(family.subject_b_preference_share)}`}
							>
								<div
									class="bg-chart-rust"
									style={`width: ${family.subject_a_preference_share * 100}%`}
								></div>
								<div
									class="bg-chart-teal"
									style={`width: ${family.subject_b_preference_share * 100}%`}
								></div>
							</div>
							<p class="text-right text-xs tabular-nums text-muted">
								{formatRate(family.subject_a_preference_share)} · {formatRate(
									family.subject_b_preference_share
								)}
							</p>
						</div>
					{/each}
				</div>
				<div class="mt-4 flex justify-between text-[11px] text-muted" aria-hidden="true">
					<span>{subjectName(matchup.subject_a)}</span>
					<span>{subjectName(matchup.subject_b)}</span>
				</div>
			</article>
		{/each}
	</div>
</div>
