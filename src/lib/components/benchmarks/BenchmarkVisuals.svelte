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
		description: string;
		points: Point[];
	};

	let { trackResult, subjects } = $props<{
		trackResult: CoffeeBenchTrackResult;
		subjects: CoffeeBenchSubject[];
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
			'Canonical total tokens per attempted task',
			(result) => result.token_usage.total_tokens.per_attempted_task,
			(value) => formatPerTask(value)
		),
		buildTradeoff(
			'cost',
			'Quality vs. cost',
			'Normalized USD per attempted task',
			(result) => {
				const value = result.cost.normalized_cost_usd.per_attempted_task;
				return value === null ? null : Number(value);
			},
			(value) => formatUsd(String(value))
		),
		buildTradeoff(
			'latency',
			'Quality vs. latency',
			'Successful-task p50 end-to-end latency',
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
		description: string,
		metric: (result: CoffeeBenchSubjectResult) => number | null,
		formatter: (value: number) => string
	): Tradeoff {
		return {
			id,
			title,
			description,
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
</script>

<div class="space-y-6" data-visualization-track={trackResult.track}>
	<figure
		class="rounded-2xl border border-line bg-surface-panel p-5 sm:p-6"
		aria-labelledby={`quality-forest-${trackResult.track}`}
	>
		<figcaption>
			<h3 id={`quality-forest-${trackResult.track}`} class="font-semibold text-ink">
				Quality forest
			</h3>
			<p class="mt-1 text-xs leading-5 text-muted">
				Precomputed Bradley–Terry score and source-family clustered 95% interval. Farther right is
				higher.
			</p>
		</figcaption>
		<div class="mt-6 space-y-5">
			{#each qualityRows as result (result.subject_id)}
				<div class="grid gap-2 sm:grid-cols-[13rem_minmax(0,1fr)_8rem] sm:items-center sm:gap-4">
					<p class="truncate text-sm font-medium text-ink">{subjectName(result.subject_id)}</p>
					<div class="relative h-5" aria-hidden="true">
						<div class="absolute inset-x-0 top-1/2 h-px bg-line"></div>
						<div
							class="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent/60"
							style={`left: ${qualityPosition(result.quality_interval_95.lower ?? 0)}%; width: ${qualityPosition(result.quality_interval_95.upper ?? 0) - qualityPosition(result.quality_interval_95.lower ?? 0)}%`}
						></div>
						<div
							class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-panel bg-ink shadow-sm"
							style={`left: ${qualityPosition(result.quality_score ?? 0)}%`}
						></div>
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
					<h3 id={`tradeoff-${trackResult.track}-${tradeoff.id}`} class="font-semibold text-ink">
						{tradeoff.title}
					</h3>
					<p class="mt-1 text-xs leading-5 text-muted">{tradeoff.description}</p>
				</figcaption>
				<div class="relative mt-5 aspect-[4/3] rounded-xl bg-surface-canvas ring-1 ring-line">
					<p class="absolute left-3 top-2 text-[10px] uppercase tracking-wide text-muted">
						Lower operations ↑
					</p>
					<p class="absolute bottom-2 right-3 text-[10px] uppercase tracking-wide text-muted">
						Higher quality →
					</p>
					{#each tradeoff.points as point, index (point.subjectId)}
						<div
							class="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-surface-panel bg-accent text-[10px] font-bold text-ink shadow-sm"
							style={`left: ${pointPosition(point, tradeoff.points, 'quality')}%; top: ${pointPosition(point, tradeoff.points, 'value')}%`}
							role="img"
							aria-label={`${point.name}: quality ${formatMetric(point.quality, 3)}, ${tradeoff.description.toLowerCase()} ${point.label}`}
						>
							{index + 1}
						</div>
					{/each}
				</div>
				<ul class="mt-4 space-y-1.5 text-xs text-muted">
					{#each tradeoff.points as point, index (point.subjectId)}
						<li class="flex justify-between gap-3">
							<span class="truncate"
								><strong class="text-ink">{index + 1}</strong> · {point.name}</span
							>
							<span class="shrink-0 tabular-nums">{point.label}</span>
						</li>
					{/each}
				</ul>
			</figure>
		{/each}
	</div>
</div>
