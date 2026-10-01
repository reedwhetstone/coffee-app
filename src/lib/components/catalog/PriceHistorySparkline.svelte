<script lang="ts">
	import { AXIS_LABEL_COLOR, GRIDLINE_COLOR, MARKER_PRIMARY } from '$lib/styles/chartColors';

	interface PricePoint {
		date: string;
		priceLb: number;
		minLbs: number | null;
		stocked: boolean;
	}
	type PriceEvent =
		| { date: string; type: 'tier_ladder_change'; fromMinLbs: number[]; toMinLbs: number[] }
		| { date: string; type: 'restocked' | 'unstocked' };
	interface PriceHistory {
		points: PricePoint[];
		events: PriceEvent[];
		summary: {
			latestPriceLb: number | null;
			minPriceLb: number | null;
			maxPriceLb: number | null;
			comparableChangePct: number | null;
			tierLadderChanged: boolean;
		};
	}

	let { coffeeId, days = 180 }: { coffeeId: number; days?: number } = $props();

	let history = $state<PriceHistory | null>(null);
	let loading = $state(true);
	let failed = $state(false);

	$effect(() => {
		const id = coffeeId;
		const window = days;
		const controller = new AbortController();
		let active = true;
		loading = true;
		failed = false;
		history = null;
		void (async () => {
			try {
				const response = await fetch(`/api/catalog/${id}/price-history?days=${window}`, {
					signal: controller.signal
				});
				if (!response.ok) throw new Error('unavailable');
				const body = (await response.json()) as { data?: PriceHistory };
				if (!body.data || !Array.isArray(body.data.points)) throw new Error('invalid');
				if (active) history = body.data;
			} catch {
				if (active) failed = true;
			} finally {
				if (active) loading = false;
			}
		})();
		return () => {
			active = false;
			controller.abort();
		};
	});

	const WIDTH = 560;
	const HEIGHT = 140;
	const PAD = { top: 12, right: 12, bottom: 22, left: 44 };

	let points = $derived(history?.points ?? []);
	let ladderEvents = $derived(
		(history?.events ?? []).filter(
			(event): event is Extract<PriceEvent, { type: 'tier_ladder_change' }> =>
				event.type === 'tier_ladder_change'
		)
	);

	let domain = $derived.by(() => {
		if (points.length === 0) return null;
		const t0 = Date.parse(points[0].date);
		const t1 = Date.parse(points[points.length - 1].date);
		const prices = points.map((p) => p.priceLb);
		const lo = Math.min(...prices);
		const hi = Math.max(...prices);
		const pad = hi === lo ? Math.max(hi * 0.05, 0.5) : (hi - lo) * 0.1;
		return { t0, t1: t1 === t0 ? t0 + 86400000 : t1, lo: lo - pad, hi: hi + pad };
	});

	function x(date: string): number {
		if (!domain) return PAD.left;
		const span = domain.t1 - domain.t0;
		return PAD.left + ((Date.parse(date) - domain.t0) / span) * (WIDTH - PAD.left - PAD.right);
	}

	function y(price: number): number {
		if (!domain) return HEIGHT - PAD.bottom;
		const span = domain.hi - domain.lo;
		return PAD.top + (1 - (price - domain.lo) / span) * (HEIGHT - PAD.top - PAD.bottom);
	}

	// Step line: a listed price holds until the next observation.
	let path = $derived.by(() => {
		if (points.length === 0) return '';
		let d = `M ${x(points[0].date)} ${y(points[0].priceLb)}`;
		for (let i = 1; i < points.length; i++) {
			d += ` H ${x(points[i].date)} V ${y(points[i].priceLb)}`;
		}
		return d;
	});

	function money(value: number | null): string {
		return value == null ? 'N/A' : `$${value.toFixed(2)}`;
	}

	function shortDate(date: string): string {
		return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}

	function lbs(values: number[]): string {
		return values.length ? `${values[0]} lb` : 'unknown';
	}

	let summaryText = $derived.by(() => {
		if (!history || points.length < 2) return null;
		const since = shortDate(points[0].date);
		const change = history.summary.comparableChangePct;
		if (history.summary.tierLadderChanged) {
			return `The tier structure changed, so prices before and after it are not directly comparable.`;
		}
		if (change == null || Math.abs(change) < 0.05) return `Unchanged since ${since}.`;
		return `${change > 0 ? 'Up' : 'Down'} ${Math.abs(change).toFixed(1)}% since ${since}, same tiers.`;
	});
</script>

<section class="rounded-lg border border-line bg-surface-panel p-4" aria-label="Price history">
	<div class="flex items-baseline justify-between gap-3">
		<h3 class="text-xs font-semibold text-muted">Price history · smallest tier</h3>
		{#if history && points.length > 1}
			<p class="text-xs text-muted">
				Range {money(history.summary.minPriceLb)}–{money(history.summary.maxPriceLb)}/lb
			</p>
		{/if}
	</div>

	{#if loading}
		<div class="mt-3 h-[140px] animate-pulse rounded bg-surface-canvas" role="status">
			<span class="sr-only">Loading price history…</span>
		</div>
	{:else if failed}
		<p class="mt-3 text-sm text-muted" role="alert">Price history is unavailable right now.</p>
	{:else if points.length < 2}
		<p class="mt-3 text-sm text-muted" role="status">
			Price history starts once this coffee has been seen on two different days.
		</p>
	{:else}
		<svg
			viewBox="0 0 {WIDTH} {HEIGHT}"
			class="mt-3 h-auto w-full"
			role="img"
			aria-label="Smallest-tier price per pound from {shortDate(points[0].date)} to {shortDate(
				points[points.length - 1].date
			)}"
		>
			<line
				x1={PAD.left}
				x2={WIDTH - PAD.right}
				y1={HEIGHT - PAD.bottom}
				y2={HEIGHT - PAD.bottom}
				stroke={GRIDLINE_COLOR}
			/>
			{#if history?.summary.maxPriceLb != null && history?.summary.minPriceLb != null}
				<text
					x={PAD.left - 6}
					y={y(history.summary.maxPriceLb) + 3}
					text-anchor="end"
					font-size="10"
					fill={AXIS_LABEL_COLOR}>{money(history.summary.maxPriceLb)}</text
				>
				{#if history.summary.minPriceLb !== history.summary.maxPriceLb}
					<text
						x={PAD.left - 6}
						y={y(history.summary.minPriceLb) + 3}
						text-anchor="end"
						font-size="10"
						fill={AXIS_LABEL_COLOR}>{money(history.summary.minPriceLb)}</text
					>
				{/if}
			{/if}
			<path d={path} fill="none" stroke={MARKER_PRIMARY} stroke-width="2" stroke-linejoin="round" />
			{#each ladderEvents as event (event.date)}
				<line
					x1={x(event.date)}
					x2={x(event.date)}
					y1={PAD.top}
					y2={HEIGHT - PAD.bottom}
					stroke={AXIS_LABEL_COLOR}
					stroke-width="1"
					stroke-dasharray="3 3"
				>
					<title
						>{shortDate(event.date)}: tiers changed (minimum {lbs(event.fromMinLbs)} → {lbs(
							event.toMinLbs
						)})</title
					>
				</line>
				<text
					x={x(event.date) + 4}
					y={(PAD.top + HEIGHT - PAD.bottom) / 2}
					text-anchor="start"
					font-size="10"
					fill={AXIS_LABEL_COLOR}>Tiers changed</text
				>
			{/each}
			<circle
				cx={x(points[points.length - 1].date)}
				cy={y(points[points.length - 1].priceLb)}
				r="3.5"
				fill={MARKER_PRIMARY}
			/>
			<text x={PAD.left} y={HEIGHT - 6} font-size="10" fill={AXIS_LABEL_COLOR}
				>{shortDate(points[0].date)}</text
			>
			<text
				x={WIDTH - PAD.right}
				y={HEIGHT - 6}
				text-anchor="end"
				font-size="10"
				fill={AXIS_LABEL_COLOR}>{shortDate(points[points.length - 1].date)}</text
			>
		</svg>
		{#if summaryText}
			<p class="mt-2 text-sm text-ink">{summaryText}</p>
		{/if}
		{#each ladderEvents as event (event.date)}
			<p class="mt-1 text-xs text-muted">
				{shortDate(event.date)}: tiers changed, minimum order {lbs(event.fromMinLbs)} → {lbs(
					event.toMinLbs
				)}.
			</p>
		{/each}
	{/if}
</section>
