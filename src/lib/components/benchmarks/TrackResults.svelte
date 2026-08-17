<script lang="ts">
	import type { CoffeeBenchSubject, CoffeeBenchTrackResult } from '$lib/benchmarks/coffeebench';
	import {
		formatCount,
		formatDuration,
		formatMetric,
		formatPerTask,
		formatRate,
		formatUsd,
		qualitySummary
	} from '$lib/benchmarks/display';

	let {
		trackResult,
		subjects,
		compactHeading = false
	} = $props<{
		trackResult: CoffeeBenchTrackResult;
		subjects: CoffeeBenchSubject[];
		compactHeading?: boolean;
	}>();

	let subjectById: Map<string, CoffeeBenchSubject> = $derived(
		new Map(subjects.map((subject: CoffeeBenchSubject) => [subject.subject_id, subject]))
	);
	let trackLabel = $derived(
		trackResult.track === 'model' ? 'Model comparison track' : 'System comparison track'
	);

	function subjectName(subjectId: string): string {
		return subjectById.get(subjectId)?.display_name ?? subjectId;
	}

	function intervalLabel(lower: number | null, upper: number | null): string {
		return lower === null || upper === null
			? 'Unavailable'
			: `${formatMetric(lower, 3)}–${formatMetric(upper, 3)}`;
	}

	function paretoLabel(classification: 'frontier' | 'dominated' | 'unavailable'): string {
		if (classification === 'frontier') return 'Pareto frontier';
		if (classification === 'dominated') return 'Dominated';
		return 'Unavailable';
	}
</script>

<div class="space-y-6" data-track={trackResult.track}>
	<div>
		{#if compactHeading}
			<h4 class="text-lg font-semibold text-ink">{trackLabel}</h4>
		{:else}
			<h3 class="font-serif text-2xl font-medium text-ink">{trackLabel}</h3>
		{/if}
		<p class="mt-1 text-sm leading-6 text-muted">
			{trackResult.track === 'model'
				? 'Subjects compared within a model-only panel; each card declares its evaluator criteria.'
				: 'Subjects compared within the matched system panel; evaluator criteria and available capabilities remain explicit per harness.'}
		</p>
	</div>

	<figure
		class="rounded-2xl border border-line bg-surface-panel p-5"
		aria-label={`${trackLabel} rate comparison`}
	>
		<figcaption class="flex flex-wrap items-baseline justify-between gap-2">
			<span class="font-semibold text-ink">Outcome-rate profile</span>
			<p class="text-xs text-muted">Exact precomputed ratios; lower is better except calibration</p>
		</figcaption>
		<div class="mt-5 space-y-5">
			{#each trackResult.subjects as result (result.subject_id)}
				<div>
					<div class="flex items-center justify-between gap-3 text-sm">
						<span class="font-medium text-ink">{subjectName(result.subject_id)}</span>
						<span class="text-muted">{qualitySummary(result)}</span>
					</div>
					<div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
						<label class="text-xs text-muted">
							Failure · {formatRate(result.rates.terminal_failure)}
							<meter
								class="mt-1 block h-2 w-full"
								min="0"
								max="1"
								value={result.rates.terminal_failure}
								>{formatRate(result.rates.terminal_failure)}</meter
							>
						</label>
						<label class="text-xs text-muted">
							Unacceptable · {formatRate(result.rates.unacceptable_response)}
							<meter
								class="mt-1 block h-2 w-full"
								min="0"
								max="1"
								value={result.rates.unacceptable_response}
								>{formatRate(result.rates.unacceptable_response)}</meter
							>
						</label>
						<label class="text-xs text-muted">
							Critical error · {formatRate(result.rates.critical_error)}
							<meter
								class="mt-1 block h-2 w-full"
								min="0"
								max="1"
								value={result.rates.critical_error}>{formatRate(result.rates.critical_error)}</meter
							>
						</label>
						<label class="text-xs text-muted">
							Calibration pass · {formatRate(result.rates.confidence_calibration_pass)}
							<meter
								class="mt-1 block h-2 w-full"
								min="0"
								max="1"
								value={result.rates.confidence_calibration_pass}
								>{formatRate(result.rates.confidence_calibration_pass)}</meter
							>
						</label>
					</div>
				</div>
			{/each}
		</div>
	</figure>

	<div class="grid gap-4 lg:hidden" aria-label={`${trackLabel} subject details`}>
		{#each trackResult.subjects as result (result.subject_id)}
			<article class="rounded-2xl border border-line bg-surface-panel p-5">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h5 class="font-semibold text-ink">{subjectName(result.subject_id)}</h5>
						<p class="mt-1 text-xs text-muted">{result.trial_count} attempted trials</p>
					</div>
					<span
						class="rounded-full bg-surface-canvas px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line"
					>
						{result.rank === null ? 'No rank' : `Rank ${result.rank}`}
					</span>
				</div>

				<dl class="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
					<div>
						<dt class="text-xs text-muted">Quality score</dt>
						<dd class="mt-1 font-medium text-ink">{formatMetric(result.quality_score, 3)}</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">95% interval</dt>
						<dd class="mt-1 font-medium text-ink">
							{intervalLabel(result.quality_interval_95.lower, result.quality_interval_95.upper)}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Normalized cost / task</dt>
						<dd class="mt-1 font-medium text-ink">
							{formatUsd(result.cost.normalized_cost_usd.per_attempted_task)}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Provider billed / task</dt>
						<dd class="mt-1 font-medium text-ink">
							{formatUsd(result.cost.provider_billed_usd.per_attempted_task)}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">End-to-end latency</dt>
						<dd class="mt-1 font-medium text-ink">
							{formatDuration(result.latency.end_to_end_ms.p50)} p50 · {formatDuration(
								result.latency.end_to_end_ms.p95
							)} p95
						</dd>
					</div>
					<div>
						<dt class="text-xs text-muted">Tool latency</dt>
						<dd class="mt-1 font-medium text-ink">
							{formatDuration(result.latency.tool_ms.p50)} p50 · {formatDuration(
								result.latency.tool_ms.p95
							)} p95
						</dd>
					</div>
				</dl>

				<details class="mt-5 rounded-xl bg-surface-canvas p-4 ring-1 ring-line">
					<summary class="cursor-pointer text-sm font-medium text-ink"
						>Token and cost evidence</summary
					>
					<p class="mt-3 text-xs text-muted">Token provenance: {result.token_usage.provenance}</p>
					<dl class="mt-3 grid grid-cols-2 gap-3 text-xs">
						{#each [['Input', result.token_usage.input_tokens], ['Cached input', result.token_usage.cached_input_tokens], ['Reasoning', result.token_usage.reasoning_tokens], ['Output', result.token_usage.output_tokens], ['Total', result.token_usage.total_tokens]] as [label, metric]}
							<div>
								<dt class="text-muted">{label}</dt>
								<dd class="mt-0.5 font-medium text-ink">
									{formatCount(metric.total)} · {formatPerTask(metric.per_attempted_task)}/task
								</dd>
							</div>
						{/each}
						<div>
							<dt class="text-muted">Normalized total</dt>
							<dd class="mt-0.5 font-medium text-ink">
								{formatUsd(result.cost.normalized_cost_usd.total)}
							</dd>
						</div>
						<div>
							<dt class="text-muted">Provider billed total</dt>
							<dd class="mt-0.5 font-medium text-ink">
								{formatUsd(result.cost.provider_billed_usd.total)}
							</dd>
						</div>
					</dl>
				</details>

				<div class="mt-4 text-xs text-muted">
					<span class="font-medium text-ink">{paretoLabel(result.pareto.classification)}</span>
					{#if result.pareto.dominated_by.length > 0}
						· dominated by {result.pareto.dominated_by.map(subjectName).join(', ')}
					{/if}
				</div>
			</article>
		{/each}
	</div>

	<div class="hidden overflow-x-auto rounded-2xl border border-line bg-surface-panel lg:block">
		<table class="w-full min-w-[1180px] border-collapse text-left text-xs">
			<caption class="sr-only">{trackLabel} complete precomputed result table</caption>
			<thead class="border-b border-line bg-surface-canvas text-muted">
				<tr>
					<th class="px-4 py-3 font-medium">Subject</th>
					<th class="px-4 py-3 font-medium">Quality (95% interval)</th>
					<th class="px-4 py-3 font-medium">Token totals · / task</th>
					<th class="px-4 py-3 font-medium">Cost totals · / task</th>
					<th class="px-4 py-3 font-medium">Latency p50 / p95</th>
					<th class="px-4 py-3 font-medium">Outcome rates</th>
					<th class="px-4 py-3 font-medium">Pareto</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-line">
				{#each trackResult.subjects as result (result.subject_id)}
					<tr class="align-top">
						<th class="px-4 py-4 font-medium text-ink">
							{subjectName(result.subject_id)}
							<span class="mt-1 block font-normal text-muted">{result.trial_count} trials</span>
						</th>
						<td class="px-4 py-4 text-ink">
							{qualitySummary(result)}
						</td>
						<td class="space-y-1 px-4 py-4 text-muted">
							<div class="font-medium text-ink">Provenance {result.token_usage.provenance}</div>
							<div>
								Input {formatCount(result.token_usage.input_tokens.total)} · {formatPerTask(
									result.token_usage.input_tokens.per_attempted_task
								)}/task
							</div>
							<div>
								Cached {formatCount(result.token_usage.cached_input_tokens.total)} · {formatPerTask(
									result.token_usage.cached_input_tokens.per_attempted_task
								)}/task
							</div>
							<div>
								Reasoning {formatCount(result.token_usage.reasoning_tokens.total)} · {formatPerTask(
									result.token_usage.reasoning_tokens.per_attempted_task
								)}/task
							</div>
							<div>
								Output {formatCount(result.token_usage.output_tokens.total)} · {formatPerTask(
									result.token_usage.output_tokens.per_attempted_task
								)}/task
							</div>
							<div class="font-medium text-ink">
								Total {formatCount(result.token_usage.total_tokens.total)} · {formatPerTask(
									result.token_usage.total_tokens.per_attempted_task
								)}/task
							</div>
						</td>
						<td class="space-y-1 px-4 py-4 text-muted">
							<div>
								Normalized {formatUsd(result.cost.normalized_cost_usd.total)} · {formatUsd(
									result.cost.normalized_cost_usd.per_attempted_task
								)}/task
							</div>
							<div>
								Billed {formatUsd(result.cost.provider_billed_usd.total)} · {formatUsd(
									result.cost.provider_billed_usd.per_attempted_task
								)}/task
							</div>
						</td>
						<td class="space-y-1 px-4 py-4 text-muted">
							<div>
								End to end {formatDuration(result.latency.end_to_end_ms.p50)} / {formatDuration(
									result.latency.end_to_end_ms.p95
								)}
							</div>
							<div>
								Tools {formatDuration(result.latency.tool_ms.p50)} / {formatDuration(
									result.latency.tool_ms.p95
								)}
							</div>
						</td>
						<td class="space-y-1 px-4 py-4 text-muted">
							<div>Fail {formatRate(result.rates.terminal_failure)}</div>
							<div>Unacceptable {formatRate(result.rates.unacceptable_response)}</div>
							<div>Critical {formatRate(result.rates.critical_error)}</div>
							<div>Calibrated {formatRate(result.rates.confidence_calibration_pass)}</div>
						</td>
						<td class="px-4 py-4 text-ink">
							{paretoLabel(result.pareto.classification)}
							{#if result.pareto.dominated_by.length > 0}
								<span class="mt-1 block text-muted"
									>{result.pareto.dominated_by.map(subjectName).join(', ')}</span
								>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
