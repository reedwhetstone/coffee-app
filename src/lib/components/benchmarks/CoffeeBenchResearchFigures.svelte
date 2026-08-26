<script lang="ts">
	import type {
		CoffeeBenchIndependentPublicExport,
		CoffeeBenchIndependentSlice,
		CoffeeBenchIndependentSubjectResult
	} from '$lib/benchmarks/coffeebench';
	import { formatDuration, formatMetric, formatRate } from '$lib/benchmarks/display';

	const RAW_SUBJECT_ID = 'deepseek-v4-raw';
	const COLORS = ['#C05B2E', '#4E8098', '#6D5BD0', '#586048'] as const;
	type CoffeeBenchIndependentSubject = CoffeeBenchIndependentPublicExport['subjects'][number];

	let { overallResults, historical, liveWeb, subjects } = $props<{
		overallResults: CoffeeBenchIndependentSubjectResult[];
		historical: CoffeeBenchIndependentSlice;
		liveWeb: CoffeeBenchIndependentSlice;
		subjects: CoffeeBenchIndependentSubject[];
	}>();

	let subjectById: Map<string, CoffeeBenchIndependentSubject> = $derived(
		new Map(subjects.map((subject: CoffeeBenchIndependentSubject) => [subject.subject_id, subject]))
	);
	let qualityRows: CoffeeBenchIndependentSubjectResult[] = $derived(
		overallResults.filter(
			(result: CoffeeBenchIndependentSubjectResult) =>
				result.pairwise_quality.score !== null &&
				result.pairwise_quality.interval_95.lower !== null &&
				result.pairwise_quality.interval_95.upper !== null
		)
	);
	let qualityMinimum: number = $derived(
		Math.min(
			...qualityRows.map(
				(result: CoffeeBenchIndependentSubjectResult) =>
					result.pairwise_quality.interval_95.lower ?? 0
			)
		)
	);
	let qualityMaximum: number = $derived(
		Math.max(
			...qualityRows.map(
				(result: CoffeeBenchIndependentSubjectResult) =>
					result.pairwise_quality.interval_95.upper ?? 1
			)
		)
	);
	let harnessResults: CoffeeBenchIndependentSubjectResult[] = $derived(
		overallResults.filter(
			(result: CoffeeBenchIndependentSubjectResult) => result.subject_id !== RAW_SUBJECT_ID
		)
	);
	let maximumTokens: number = $derived(
		Math.max(
			...overallResults.map(
				(result: CoffeeBenchIndependentSubjectResult) =>
					result.operational.token_usage.total_tokens.per_attempted_task ?? 0
			)
		)
	);
	let maximumLatency: number = $derived(
		Math.max(
			...overallResults.map(
				(result: CoffeeBenchIndependentSubjectResult) =>
					result.operational.latency.end_to_end_ms.p50 ?? 0
			)
		)
	);
	let maximumUnacceptable: number = $derived(
		Math.max(
			...overallResults.map(
				(result: CoffeeBenchIndependentSubjectResult) =>
					result.absolute_rubric.unacceptable_response_rate
			)
		)
	);

	function subjectName(subjectId: string): string {
		return subjectById.get(subjectId)?.display_name ?? subjectId;
	}

	function shortSubjectName(subjectId: string): string {
		return subjectName(subjectId).replace('DeepSeek V4 with ', '').replace('DeepSeek V4 ', '');
	}

	function qualityPosition(value: number): number {
		if (qualityMinimum === qualityMaximum) return 50;
		return 4 + ((value - qualityMinimum) / (qualityMaximum - qualityMinimum)) * 92;
	}

	function preferenceAgainstRaw(
		slice: CoffeeBenchIndependentSlice,
		subjectId: string
	): number | null {
		const matchup = (slice.track_results[0].pairwise_matchups ?? []).find(
			(candidate) =>
				(candidate.subject_a === subjectId && candidate.subject_b === RAW_SUBJECT_ID) ||
				(candidate.subject_b === subjectId && candidate.subject_a === RAW_SUBJECT_ID)
		);
		if (!matchup) return null;
		return matchup.subject_a === subjectId
			? matchup.subject_a_preference_share
			: matchup.subject_b_preference_share;
	}

	function barWidth(value: number | null, maximum: number): number {
		return value === null || maximum === 0 ? 0 : (value / maximum) * 100;
	}

	function formatTokens(value: number | null): string {
		return value === null
			? 'Unavailable'
			: `${new Intl.NumberFormat('en-US').format(Math.round(value))}`;
	}
</script>

<div class="space-y-6">
	<figure class="rounded-3xl border border-line bg-surface-panel p-5 sm:p-7">
		<figcaption class="max-w-3xl">
			<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Figure 1</p>
			<h3 class="mt-2 font-serif text-2xl font-medium text-ink">No harness separated cleanly.</h3>
			<p class="mt-2 text-sm leading-6 text-muted">
				Purveyors Search ranked first on Bradley–Terry preference. Every interval overlaps, so V1
				does not establish a winner.
			</p>
		</figcaption>
		<div class="mt-7 space-y-5">
			{#each qualityRows as result, index (result.subject_id)}
				<div class="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_8.5rem] sm:items-center sm:gap-4">
					<p class="text-sm font-medium leading-5 text-ink">
						{shortSubjectName(result.subject_id)}
					</p>
					<div
						class="relative h-7"
						role="img"
						aria-label={`${shortSubjectName(result.subject_id)} score ${formatMetric(result.pairwise_quality.score, 3)}, interval ${formatMetric(result.pairwise_quality.interval_95.lower, 3)} to ${formatMetric(result.pairwise_quality.interval_95.upper, 3)}`}
					>
						<div class="absolute inset-x-0 top-1/2 h-px bg-line"></div>
						<div
							class="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
							style={`left: ${qualityPosition(result.pairwise_quality.interval_95.lower ?? 0)}%; width: ${qualityPosition(result.pairwise_quality.interval_95.upper ?? 0) - qualityPosition(result.pairwise_quality.interval_95.lower ?? 0)}%; background: ${COLORS[index]}`}
						></div>
						<div
							class="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-panel shadow-sm"
							style={`left: ${qualityPosition(result.pairwise_quality.score ?? 0)}%; background: ${COLORS[index]}`}
						></div>
					</div>
					<p class="text-xs tabular-nums text-muted sm:text-right">
						{formatMetric(result.pairwise_quality.score, 3)} · {formatMetric(
							result.pairwise_quality.interval_95.lower,
							3
						)}–{formatMetric(result.pairwise_quality.interval_95.upper, 3)}
					</p>
				</div>
			{/each}
		</div>
		<div class="mt-4 grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_8.5rem] sm:gap-4">
			<span class="hidden sm:block" aria-hidden="true"></span>
			<div
				class="flex justify-between border-t border-line pt-2 text-[11px] tabular-nums text-muted"
			>
				<span>{formatMetric(qualityMinimum, 3)}</span>
				<span>Relative pairwise quality</span>
				<span>{formatMetric(qualityMaximum, 3)}</span>
			</div>
		</div>
	</figure>

	<div class="grid gap-6 xl:grid-cols-2">
		<figure class="rounded-3xl border border-line bg-surface-panel p-5 sm:p-7">
			<figcaption>
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Figure 2</p>
				<h3 class="mt-2 font-serif text-2xl font-medium text-ink">
					Current-information cases widened the gap.
				</h3>
				<p class="mt-2 text-sm leading-6 text-muted">
					Preference share against Raw, with ties split evenly. Search was disabled on historical
					control cases and enabled on live-web cases.
				</p>
			</figcaption>
			<div class="mt-6 flex gap-5 text-xs text-muted" aria-hidden="true">
				<span class="flex items-center gap-2"
					><span class="size-2.5 rounded-full bg-chart-gold"></span>Historical control</span
				>
				<span class="flex items-center gap-2"
					><span class="size-2.5 rounded-full bg-chart-teal"></span>Live web</span
				>
			</div>
			<div class="mt-6 space-y-6">
				{#each harnessResults as result (result.subject_id)}
					{@const historicalShare = preferenceAgainstRaw(historical, result.subject_id)}
					{@const liveShare = preferenceAgainstRaw(liveWeb, result.subject_id)}
					<div>
						<p class="text-sm font-medium text-ink">{shortSubjectName(result.subject_id)}</p>
						<div class="mt-2 space-y-2">
							<div class="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-2">
								<span class="text-xs text-muted">Historical</span>
								<div class="h-3 overflow-hidden rounded-full bg-line">
									<div
										class="h-full rounded-full bg-chart-gold"
										style={`width: ${(historicalShare ?? 0) * 100}%`}
									></div>
								</div>
								<span class="text-right text-xs tabular-nums text-ink"
									>{formatRate(historicalShare)}</span
								>
							</div>
							<div class="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-2">
								<span class="text-xs text-muted">Live web</span>
								<div class="h-3 overflow-hidden rounded-full bg-line">
									<div
										class="h-full rounded-full bg-chart-teal"
										style={`width: ${(liveShare ?? 0) * 100}%`}
									></div>
								</div>
								<span class="text-right text-xs tabular-nums text-ink">{formatRate(liveShare)}</span
								>
							</div>
						</div>
					</div>
				{/each}
			</div>
			<p class="mt-5 border-t border-line pt-4 text-xs leading-5 text-muted">
				A 50% share is even. The harnesses retained an advantage over Raw on historical cases, where
				web retrieval was disabled.
			</p>
		</figure>

		<figure class="rounded-3xl border border-line bg-surface-panel p-5 sm:p-7">
			<figcaption>
				<p class="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Figure 3</p>
				<h3 class="mt-2 font-serif text-2xl font-medium text-ink">
					Raw was faster, used fewer reported input/output tokens, and produced weaker answers.
				</h3>
				<p class="mt-2 text-sm leading-6 text-muted">
					Reported input/output tokens only; reasoning-token usage was unavailable for every
					treatment. Successful-task median latency and jury-marked unacceptable answers are also
					shown. Bar lengths are scaled within each metric.
				</p>
			</figcaption>
			<div class="mt-6 space-y-6">
				{#each overallResults as result, index (result.subject_id)}
					{@const tokens = result.operational.token_usage.total_tokens.per_attempted_task}
					{@const latency = result.operational.latency.end_to_end_ms.p50}
					{@const unacceptable = result.absolute_rubric.unacceptable_response_rate}
					<div>
						<p class="text-sm font-medium text-ink">{shortSubjectName(result.subject_id)}</p>
						<div class="mt-2 grid gap-2 text-xs">
							<div class="grid grid-cols-[5.5rem_minmax(0,1fr)_4rem] items-center gap-2">
								<span class="text-muted">Reported input/output tokens / task</span>
								<div class="h-2.5 overflow-hidden rounded-full bg-line">
									<div
										class="h-full rounded-full"
										style={`width: ${barWidth(tokens, maximumTokens)}%; background: ${COLORS[index]}`}
									></div>
								</div>
								<span class="text-right tabular-nums text-ink">{formatTokens(tokens)}</span>
							</div>
							<div class="grid grid-cols-[5.5rem_minmax(0,1fr)_4rem] items-center gap-2">
								<span class="text-muted">Median time</span>
								<div class="h-2.5 overflow-hidden rounded-full bg-line">
									<div
										class="h-full rounded-full"
										style={`width: ${barWidth(latency, maximumLatency)}%; background: ${COLORS[index]}`}
									></div>
								</div>
								<span class="text-right tabular-nums text-ink">{formatDuration(latency)}</span>
							</div>
							<div class="grid grid-cols-[5.5rem_minmax(0,1fr)_4rem] items-center gap-2">
								<span class="text-muted">Unacceptable</span>
								<div class="h-2.5 overflow-hidden rounded-full bg-line">
									<div
										class="h-full rounded-full"
										style={`width: ${barWidth(unacceptable, maximumUnacceptable)}%; background: ${COLORS[index]}`}
									></div>
								</div>
								<span class="text-right tabular-nums text-ink">{formatRate(unacceptable)}</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</figure>
	</div>
</div>
