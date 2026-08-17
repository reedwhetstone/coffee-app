<script lang="ts">
	import type {
		CoffeeBenchSubject,
		CoffeeBenchSubjectResult,
		CoffeeBenchTrackResult
	} from '$lib/benchmarks/coffeebench';
	import { formatDuration, formatMetric, formatPerTask, formatUsd } from '$lib/benchmarks/display';

	type Point = {
		subjectId: string;
		name: string;
		quality: number;
		value: number;
		label: string;
	};

	type Tradeoff = {
		id: 'tokens' | 'cost' | 'latency';
		title: string;
		question: string;
		description: string;
		axisLabel: string;
		points: Point[];
	};

	let {
		trackResult,
		subjects,
		fixture = false
	} = $props<{
		trackResult: CoffeeBenchTrackResult;
		subjects: CoffeeBenchSubject[];
		fixture?: boolean;
	}>();

	let subjectById: Map<string, CoffeeBenchSubject> = $derived(
		new Map(subjects.map((subject: CoffeeBenchSubject) => [subject.subject_id, subject]))
	);
	let qualityRows = $derived(
		trackResult.subjects.filter(
			(result: CoffeeBenchSubjectResult) =>
				result.quality_score !== null &&
				result.quality_interval_95.lower !== null &&
				result.quality_interval_95.upper !== null
		)
	);
	let qualityBounds = $derived(
		qualityRows.length
			? {
					min: Math.min(
						...qualityRows.map(
							(result: CoffeeBenchSubjectResult) => result.quality_interval_95.lower ?? 0
						)
					),
					max: Math.max(
						...qualityRows.map(
							(result: CoffeeBenchSubjectResult) => result.quality_interval_95.upper ?? 0
						)
					)
				}
			: { min: 0, max: 1 }
	);
	let tradeoffs: Tradeoff[] = $derived([
		buildTradeoff(
			'tokens',
			'Quality vs. tokens',
			'Does the quality gain justify more model work?',
			'Canonical total tokens per attempted task',
			'Fewer tokens',
			(result) => result.token_usage.total_tokens.per_attempted_task,
			(value) => formatPerTask(value)
		),
		buildTradeoff(
			'cost',
			'Quality vs. cost',
			'What quality does each dollar buy?',
			'Normalized USD per attempted task',
			'Lower cost',
			(result) => {
				const value = result.cost.normalized_cost_usd.per_attempted_task;
				return value === null ? null : Number(value);
			},
			(value) => formatUsd(String(value))
		),
		buildTradeoff(
			'latency',
			'Quality vs. latency',
			'How much responsiveness is traded for quality?',
			'Successful-task p50 end-to-end latency',
			'Lower latency',
			(result) => result.latency.end_to_end_ms.p50,
			(value) => formatDuration(value)
		)
	]);

	function subjectName(subjectId: string): string {
		return subjectById.get(subjectId)?.display_name ?? subjectId;
	}

	function buildTradeoff(
		id: Tradeoff['id'],
		title: string,
		question: string,
		description: string,
		axisLabel: string,
		metric: (result: CoffeeBenchSubjectResult) => number | null,
		formatter: (value: number) => string
	): Tradeoff {
		return {
			id,
			title,
			question,
			description,
			axisLabel,
			points: trackResult.subjects.flatMap((result: CoffeeBenchSubjectResult) => {
				const value = metric(result);
				return result.quality_score === null || value === null
					? []
					: [
							{
								subjectId: result.subject_id,
								name: subjectName(result.subject_id),
								quality: result.quality_score,
								value,
								label: formatter(value)
							}
						];
			})
		};
	}

	function position(value: number, min: number, max: number): number {
		if (min === max) return 50;
		return 8 + ((value - min) / (max - min)) * 84;
	}

	function qualityPosition(value: number): number {
		return position(value, qualityBounds.min, qualityBounds.max);
	}

	function pointPosition(point: Point, points: Point[], axis: 'quality' | 'value'): number {
		const values = points.map((candidate) => candidate[axis]);
		return position(point[axis], Math.min(...values), Math.max(...values));
	}

	function tooltipPlacement(percent: number): 'left' | 'center' | 'right' {
		if (percent < 24) return 'left';
		if (percent > 76) return 'right';
		return 'center';
	}

	function tooltipVertical(percent: number): 'above' | 'below' {
		return percent < 30 ? 'below' : 'above';
	}
</script>

<div class="space-y-6" data-visualization-track={trackResult.track}>
	<figure
		class="rounded-2xl border border-line bg-surface-panel p-5 sm:p-6"
		aria-labelledby={`quality-forest-${trackResult.track}`}
	>
		<figcaption>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h3 id={`quality-forest-${trackResult.track}`} class="font-semibold text-ink">
					Quality forest
				</h3>
				{#if fixture}
					<span
						class="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent ring-1 ring-accent/30"
					>
						Illustrative fixture
					</span>
				{/if}
			</div>
			<p class="mt-1 text-xs leading-5 text-muted">
				The dot is the precomputed Bradley–Terry quality score; the line is its source-family
				clustered 95% interval. Farther right is higher, but overlapping intervals weaken a rank
				claim.
			</p>
			<details class="mt-3 text-xs text-muted">
				<summary class="cursor-pointer font-medium text-ink">How to read this chart</summary>
				<p class="mt-2 max-w-3xl leading-5">
					Compare the dots first, then the uncertainty spans. Hover or focus a dot for its exact
					score and interval. A wider span means the measured ordering is less certain.
				</p>
			</details>
		</figcaption>
		<div class="mt-6 space-y-5">
			{#each qualityRows as result (result.subject_id)}
				<div class="grid gap-2 sm:grid-cols-[13rem_minmax(0,1fr)_8rem] sm:items-center sm:gap-4">
					<p class="min-w-0 break-words text-sm font-medium leading-5 text-ink">
						{subjectName(result.subject_id)}
					</p>
					<div class="relative h-7 overflow-visible">
						<div class="absolute inset-x-0 top-1/2 h-px bg-line"></div>
						<div
							class="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent/60"
							style={`left: ${qualityPosition(result.quality_interval_95.lower ?? 0)}%; width: ${qualityPosition(result.quality_interval_95.upper ?? 0) - qualityPosition(result.quality_interval_95.lower ?? 0)}%`}
						></div>
						<button
							type="button"
							class="chart-point absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-panel bg-ink shadow-sm outline-none ring-accent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-panel"
							style={`left: ${qualityPosition(result.quality_score ?? 0)}%`}
							aria-label={`${subjectName(result.subject_id)} quality ${formatMetric(result.quality_score, 3)}, 95% interval ${formatMetric(result.quality_interval_95.lower, 3)} to ${formatMetric(result.quality_interval_95.upper, 3)}`}
						>
							<span
								class="chart-tooltip"
								data-placement={tooltipPlacement(qualityPosition(result.quality_score ?? 0))}
								role="tooltip"
							>
								<strong>{subjectName(result.subject_id)}</strong>
								<span>Quality {formatMetric(result.quality_score, 3)}</span>
								<span>
									95% interval {formatMetric(result.quality_interval_95.lower, 3)}–{formatMetric(
										result.quality_interval_95.upper,
										3
									)}
								</span>
							</span>
						</button>
					</div>
					<p class="text-xs tabular-nums text-muted sm:text-right">
						{formatMetric(result.quality_score, 3)} ({formatMetric(
							result.quality_interval_95.lower,
							3
						)}–{formatMetric(result.quality_interval_95.upper, 3)})
					</p>
				</div>
			{/each}
		</div>
	</figure>

	<div class="grid gap-4 lg:grid-cols-3" aria-label="Quality and operational tradeoff views">
		{#each tradeoffs as tradeoff (tradeoff.id)}
			<figure
				class="rounded-2xl border border-line bg-surface-panel p-5"
				aria-labelledby={`tradeoff-${trackResult.track}-${tradeoff.id}`}
			>
				<figcaption>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<h3 id={`tradeoff-${trackResult.track}-${tradeoff.id}`} class="font-semibold text-ink">
							{tradeoff.title}
						</h3>
						{#if fixture}
							<span
								class="rounded-full bg-accent/10 px-2 py-1 text-[10px] font-medium text-accent ring-1 ring-accent/30"
							>
								Example values
							</span>
						{/if}
					</div>
					<p class="mt-2 text-sm font-medium leading-5 text-ink">{tradeoff.question}</p>
					<p class="mt-1 text-xs leading-5 text-muted">{tradeoff.description}</p>
					<details class="mt-3 text-xs text-muted">
						<summary class="cursor-pointer font-medium text-ink">How to read this chart</summary>
						<p class="mt-2 leading-5">
							Better trade-offs move toward the upper right: higher measured quality with a lower
							operational burden. Hover or focus any numbered point for both exact values.
						</p>
					</details>
				</figcaption>
				<div
					class="mt-5 flex items-center justify-between gap-4 text-[10px] uppercase tracking-wide text-muted"
					aria-hidden="true"
				>
					<span>{tradeoff.axisLabel} ↑</span>
					<span class="text-right">Higher quality →</span>
				</div>
				<div
					class="relative mt-2 aspect-[5/4] min-h-64 overflow-visible rounded-xl bg-surface-canvas ring-1 ring-line sm:aspect-[4/3]"
				>
					{#each tradeoff.points as point, index (point.subjectId)}
						<button
							type="button"
							class="chart-point absolute z-10 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface-panel bg-accent text-[10px] font-bold text-ink shadow-sm outline-none ring-accent focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
							style={`left: ${pointPosition(point, tradeoff.points, 'quality')}%; top: ${pointPosition(point, tradeoff.points, 'value')}%`}
							aria-label={`${point.name}: quality ${formatMetric(point.quality, 3)}, ${tradeoff.description.toLowerCase()} ${point.label}`}
						>
							{index + 1}
							<span
								class="chart-tooltip"
								data-placement={tooltipPlacement(pointPosition(point, tradeoff.points, 'quality'))}
								data-vertical={tooltipVertical(pointPosition(point, tradeoff.points, 'value'))}
								role="tooltip"
							>
								<strong>{point.name}</strong>
								<span>Quality {formatMetric(point.quality, 3)}</span>
								<span>{point.label} · {tradeoff.description.toLowerCase()}</span>
							</span>
						</button>
					{/each}
				</div>
				<ul class="mt-4 space-y-1.5 text-xs text-muted">
					{#each tradeoff.points as point, index (point.subjectId)}
						<li class="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
							<span class="min-w-0 break-words"
								><strong class="text-ink">{index + 1}</strong> · {point.name}</span
							>
							<span class="shrink-0 text-right tabular-nums">
								Q {formatMetric(point.quality, 3)} · {point.label}
							</span>
						</li>
					{/each}
				</ul>
			</figure>
		{/each}
	</div>

	<style>
		.chart-point:hover,
		.chart-point:focus-visible {
			z-index: 30;
		}

		.chart-tooltip {
			position: absolute;
			bottom: calc(100% + 0.55rem);
			left: 50%;
			z-index: 40;
			display: grid;
			width: 13rem;
			gap: 0.2rem;
			transform: translateX(-50%) translateY(0.2rem);
			border: 1px solid var(--color-line, #ded8cf);
			border-radius: 0.75rem;
			background: var(--color-ink, #2f2c29);
			padding: 0.65rem 0.75rem;
			text-align: left;
			font-size: 0.7rem;
			font-weight: 400;
			line-height: 1rem;
			color: var(--color-surface-canvas, #fffdf9);
			opacity: 0;
			visibility: hidden;
			pointer-events: none;
			transition:
				opacity 120ms ease,
				transform 120ms ease;
		}

		.chart-tooltip[data-placement='left'] {
			left: -0.5rem;
			transform: translateY(0.2rem);
		}

		.chart-tooltip[data-placement='right'] {
			right: -0.5rem;
			left: auto;
			transform: translateY(0.2rem);
		}

		.chart-tooltip[data-vertical='below'] {
			top: calc(100% + 0.55rem);
			bottom: auto;
		}

		.chart-point:hover .chart-tooltip,
		.chart-point:focus-visible .chart-tooltip {
			transform: translateX(-50%) translateY(0);
			opacity: 1;
			visibility: visible;
		}

		.chart-point:hover .chart-tooltip[data-placement='left'],
		.chart-point:focus-visible .chart-tooltip[data-placement='left'],
		.chart-point:hover .chart-tooltip[data-placement='right'],
		.chart-point:focus-visible .chart-tooltip[data-placement='right'] {
			transform: translateY(0);
		}
	</style>
</div>
