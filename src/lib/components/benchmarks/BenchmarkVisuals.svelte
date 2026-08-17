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

	type Bounds = {
		min: number;
		max: number;
	};

	type AxisTick = {
		value: number;
		label: string;
		position: number;
	};

	type Tradeoff = {
		id: 'tokens' | 'cost' | 'latency';
		title: string;
		question: string;
		description: string;
		metricLabel: string;
		points: Point[];
		qualityBounds: Bounds;
		valueBounds: Bounds;
		qualityTicks: AxisTick[];
		valueTicks: AxisTick[];
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
	let qualityTicks = $derived(buildAxisTicks(qualityBounds, (value) => formatMetric(value, 3)));
	let tradeoffs: Tradeoff[] = $derived([
		buildTradeoff(
			'tokens',
			'Quality vs. tokens',
			'Does the quality gain justify more model work?',
			'Canonical total tokens per attempted task',
			'Canonical tokens / attempted task',
			(result) => result.token_usage.total_tokens.per_attempted_task,
			(value) => formatPerTask(value),
			(value) => formatPerTask(value)
		),
		buildTradeoff(
			'cost',
			'Quality vs. cost',
			'What quality does each dollar buy?',
			'Normalized USD per attempted task',
			'Normalized USD / attempted task',
			(result) => {
				const value = result.cost.normalized_cost_usd.per_attempted_task;
				return value === null ? null : Number(value);
			},
			(value) => formatUsd(String(value)),
			(value) => `$${value.toFixed(4)}`
		),
		buildTradeoff(
			'latency',
			'Quality vs. latency',
			'How much responsiveness is traded for quality?',
			'Successful-task p50 end-to-end latency',
			'p50 end-to-end latency / successful task',
			(result) => result.latency.end_to_end_ms.p50,
			(value) => formatDuration(value),
			(value) => `${formatPerTask(value)} ms`
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
		metricLabel: string,
		metric: (result: CoffeeBenchSubjectResult) => number | null,
		formatter: (value: number) => string,
		tickFormatter: (value: number) => string
	): Tradeoff {
		const points: Point[] = trackResult.subjects.flatMap((result: CoffeeBenchSubjectResult) => {
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
		});
		const tradeoffQualityBounds = valueBounds(points.map((point) => point.quality));
		const tradeoffValueBounds = valueBounds(points.map((point) => point.value));

		return {
			id,
			title,
			question,
			description,
			metricLabel,
			points,
			qualityBounds: tradeoffQualityBounds,
			valueBounds: tradeoffValueBounds,
			qualityTicks: buildAxisTicks(tradeoffQualityBounds, (value) => formatMetric(value, 3)),
			valueTicks: buildAxisTicks(tradeoffValueBounds, tickFormatter)
		};
	}

	function valueBounds(values: number[]): Bounds {
		return values.length
			? { min: Math.min(...values), max: Math.max(...values) }
			: { min: 0, max: 1 };
	}

	function buildAxisTicks(bounds: Bounds, formatter: (value: number) => string): AxisTick[] {
		if (bounds.min === bounds.max) {
			return [{ value: bounds.min, label: formatter(bounds.min), position: 50 }];
		}
		return [bounds.min, (bounds.min + bounds.max) / 2, bounds.max].map((value) => ({
			value,
			label: formatter(value),
			position: position(value, bounds.min, bounds.max)
		}));
	}

	function position(value: number, min: number, max: number): number {
		if (min === max) return 50;
		return 8 + ((value - min) / (max - min)) * 84;
	}

	function qualityPosition(value: number): number {
		return position(value, qualityBounds.min, qualityBounds.max);
	}

	function pointPosition(value: number, bounds: Bounds): number {
		return position(value, bounds.min, bounds.max);
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
				The horizontal scale is the precomputed Bradley–Terry score from pairwise jury preferences,
				a relative measure rather than percent correct. The dot is the score; the line is its
				source-family clustered 95% interval.
			</p>
			<details class="mt-3 text-xs text-muted">
				<summary class="cursor-pointer font-medium text-ink">How to read this chart</summary>
				<p class="mt-2 max-w-3xl leading-5">
					Compare the dots first, then the uncertainty spans. Hover or focus a dot for its exact
					score and interval. Farther right means stronger pairwise preference; a wider span means
					the measured ordering is less certain.
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
		{#if qualityRows.length > 0}
			<div class="mt-4 grid gap-2 sm:grid-cols-[13rem_minmax(0,1fr)_8rem] sm:gap-4">
				<span class="hidden sm:block" aria-hidden="true"></span>
				<div
					role="img"
					aria-label={`Bradley-Terry quality score scale from ${formatMetric(qualityBounds.min, 3)} to ${formatMetric(qualityBounds.max, 3)}`}
				>
					<div class="relative h-6 border-t border-line" aria-hidden="true">
						{#each qualityTicks as tick (tick.value)}
							<span
								class="axis-tick axis-tick-x"
								data-placement={tooltipPlacement(tick.position)}
								style={`left: ${tick.position}%`}
							>
								{tick.label}
							</span>
						{/each}
					</div>
					<p class="text-center text-[10px] font-medium uppercase tracking-wide text-muted">
						Bradley–Terry quality score · relative pairwise preference
					</p>
				</div>
			</div>
		{/if}
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
							Each point plots relative pairwise-preference quality on the horizontal axis and the
							measured operational metric on the vertical axis. Higher quality moves right; lower
							operational burden plots higher. The tick labels show the actual displayed range.
							Hover or focus a numbered point for both exact values.
						</p>
					</details>
				</figcaption>
				<p class="mt-5 text-[10px] font-medium uppercase tracking-wide text-muted">
					{tradeoff.metricLabel} · lower values plot higher
				</p>
				<div class="mt-2 grid grid-cols-[4rem_minmax(0,1fr)] gap-x-2">
					<div
						class="relative h-full"
						role="img"
						aria-label={`${tradeoff.metricLabel} scale from ${tradeoff.valueTicks[0]?.label ?? 'Unavailable'} to ${tradeoff.valueTicks[tradeoff.valueTicks.length - 1]?.label ?? 'Unavailable'}`}
					>
						{#each tradeoff.valueTicks as tick (tick.value)}
							<span
								class="axis-tick axis-tick-y"
								style={`top: ${tick.position}%`}
								aria-hidden="true"
							>
								{tick.label}
							</span>
						{/each}
					</div>
					<div
						class="relative aspect-square w-full overflow-visible rounded-xl bg-surface-canvas ring-1 ring-line"
						role="group"
						aria-label={`${tradeoff.title}: horizontal Bradley-Terry quality score and vertical ${tradeoff.metricLabel.toLowerCase()}`}
					>
						{#each tradeoff.valueTicks as tick (tick.value)}
							<span
								class="absolute inset-x-0 h-px bg-line/70"
								style={`top: ${tick.position}%`}
								aria-hidden="true"
							></span>
						{/each}
						{#each tradeoff.qualityTicks as tick (tick.value)}
							<span
								class="absolute inset-y-0 w-px bg-line/70"
								style={`left: ${tick.position}%`}
								aria-hidden="true"
							></span>
						{/each}
						{#each tradeoff.points as point, index (point.subjectId)}
							<button
								type="button"
								class="chart-point absolute z-10 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface-panel bg-accent text-[10px] font-bold text-ink shadow-sm outline-none ring-accent focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas"
								style={`left: ${pointPosition(point.quality, tradeoff.qualityBounds)}%; top: ${pointPosition(point.value, tradeoff.valueBounds)}%`}
								aria-label={`${point.name}: quality ${formatMetric(point.quality, 3)}, ${tradeoff.description.toLowerCase()} ${point.label}`}
							>
								{index + 1}
								<span
									class="chart-tooltip"
									data-placement={tooltipPlacement(
										pointPosition(point.quality, tradeoff.qualityBounds)
									)}
									data-vertical={tooltipVertical(pointPosition(point.value, tradeoff.valueBounds))}
									role="tooltip"
								>
									<strong>{point.name}</strong>
									<span>Quality {formatMetric(point.quality, 3)}</span>
									<span>{point.label} · {tradeoff.description.toLowerCase()}</span>
								</span>
							</button>
						{/each}
					</div>
					<span aria-hidden="true"></span>
					<div
						class="relative h-6 border-t border-line"
						role="img"
						aria-label={`Bradley-Terry quality score scale from ${tradeoff.qualityTicks[0]?.label ?? 'Unavailable'} to ${tradeoff.qualityTicks[tradeoff.qualityTicks.length - 1]?.label ?? 'Unavailable'}`}
					>
						{#each tradeoff.qualityTicks as tick (tick.value)}
							<span
								class="axis-tick axis-tick-x"
								data-placement={tooltipPlacement(tick.position)}
								style={`left: ${tick.position}%`}
								aria-hidden="true"
							>
								{tick.label}
							</span>
						{/each}
					</div>
					<span aria-hidden="true"></span>
					<p class="text-center text-[10px] font-medium uppercase tracking-wide text-muted">
						Bradley–Terry quality score · relative pairwise preference
					</p>
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
		.axis-tick {
			position: absolute;
			font-size: 0.625rem;
			font-variant-numeric: tabular-nums;
			line-height: 1rem;
			color: var(--color-muted, #6f6962);
			white-space: nowrap;
		}

		.axis-tick-x {
			top: 0.25rem;
			transform: translateX(-50%);
		}

		.axis-tick-x::before {
			position: absolute;
			top: -0.25rem;
			left: 50%;
			width: 1px;
			height: 0.25rem;
			background: var(--color-line, #ded8cf);
			content: '';
		}

		.axis-tick-x[data-placement='left'] {
			transform: none;
		}

		.axis-tick-x[data-placement='left']::before {
			left: 0;
		}

		.axis-tick-x[data-placement='right'] {
			transform: translateX(-100%);
		}

		.axis-tick-x[data-placement='right']::before {
			right: 0;
			left: auto;
		}

		.axis-tick-y {
			right: 0.5rem;
			transform: translateY(-50%);
			text-align: right;
		}

		.axis-tick-y::after {
			position: absolute;
			top: 50%;
			right: -0.5rem;
			width: 0.35rem;
			height: 1px;
			background: var(--color-line, #ded8cf);
			content: '';
		}

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
