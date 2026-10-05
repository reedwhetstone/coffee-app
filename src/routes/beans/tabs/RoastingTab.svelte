<script lang="ts">
	import AccentSpine from '$lib/components/ui/AccentSpine.svelte';
	import { coffeeRoastsHref } from '$lib/roast/coffee-links';
	import {
		newestFirst,
		newestRoastDifference,
		trendRow,
		trendSummaryLine
	} from '$lib/roast/coffee-trend';
	import { compareHref, roastHref } from '$lib/roast/compare-sides';
	import type { SummaryRoast } from '$lib/roast/roast-summary';
	import type { InventoryWithCatalog } from '$lib/types/component.types';

	type RowMenuLink = { label: string; href: string };

	let {
		selectedBean,
		role,
		readOnly = false,
		onStartNewRoast,
		rowMenu = () => []
	} = $props<{
		selectedBean: InventoryWithCatalog;
		role?: 'viewer' | 'member' | 'admin';
		/** A portfolio someone shared: the roasts it carries are listed with no links or actions. */
		readOnly?: boolean;
		onStartNewRoast: () => void;
		/**
		 * EXTENSION POINT: the row menu.
		 * The links offered for one roast. A row draws its menu once this returns any.
		 * "Log sale" belongs here.
		 */
		rowMenu?: (roast: SummaryRoast) => RowMenuLink[];
	}>();

	// Roast history is part of Mallard Studio.
	let hasStudio = $derived(role === 'member' || role === 'admin');

	let loaded = $state<SummaryRoast[] | null>(null);
	let loadFailed = $state(false);
	let retry = $state(0);

	// The trend columns come from the roast list, narrowed to this coffee.
	$effect(() => {
		const coffeeId = selectedBean.id;
		void retry;
		if (readOnly || !hasStudio) return;
		const controller = new AbortController();
		loaded = null;
		loadFailed = false;
		void fetch(`/api/roast-profiles?coffee_id=${coffeeId}`, { signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error('Roasts failed to load');
				const result = (await response.json()) as { data?: SummaryRoast[] };
				if (!Array.isArray(result.data)) throw new Error('Roasts failed to load');
				if (!controller.signal.aborted) loaded = result.data;
			})
			.catch(() => {
				if (!controller.signal.aborted) loadFailed = true;
			});
		return () => controller.abort();
	});

	let roasts = $derived.by(() => {
		const source = readOnly ? ((selectedBean.roast_profiles ?? []) as SummaryRoast[]) : loaded;
		return source ? newestFirst(source.filter((roast) => roast.roast_id != null)) : null;
	});
	let rows = $derived((roasts ?? []).map((roast) => trendRow(roast)));
	let summary = $derived(
		roasts && roasts.length > 0 ? trendSummaryLine(roasts, selectedBean.purchased_qty_lbs) : ''
	);
	let newestDifference = $derived(
		roasts && roasts.length > 1 ? newestRoastDifference(roasts[0], roasts[1]) : null
	);

	// Up to two roasts are ticked for comparison. A third tick replaces the earliest.
	let ticked = $state<number[]>([]);
	$effect(() => {
		const present = new Set((roasts ?? []).map((roast) => roast.roast_id));
		if (ticked.some((roastId) => !present.has(roastId))) {
			ticked = ticked.filter((roastId) => present.has(roastId));
		}
	});

	function toggleTick(roastId: number) {
		ticked = ticked.includes(roastId)
			? ticked.filter((id) => id !== roastId)
			: [...ticked, roastId].slice(-2);
	}

	// The newer roast is side A, as it is when a comparison starts from an open roast.
	let compareLink = $derived.by(() => {
		if (ticked.length !== 2) return null;
		const [a, b] = rows.filter((row) => ticked.includes(row.roastId));
		return compareHref({
			a: { type: 'roast', id: a.roastId },
			b: { type: 'roast', id: b.roastId }
		});
	});

	const rowGrid =
		'grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 sm:grid-cols-[auto_3.5rem_minmax(0,1fr)_6.25rem_2.75rem_2.5rem_3rem_2.75rem_auto]';
</script>

<div class="space-y-4">
	<!-- Heading and actions share a line where there is room; the summary reads under both. -->
	<div class="grid gap-x-4 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
		<h3 class="text-lg font-semibold text-ink">Roasts of this coffee</h3>
		{#if summary}
			<p class="text-sm text-muted sm:col-span-2 sm:row-start-2">{summary}</p>
		{/if}
		{#if !readOnly && hasStudio && rows.length > 0}
			<div
				class="flex flex-wrap items-center gap-x-4 gap-y-2 sm:col-start-2 sm:row-start-1 sm:justify-end"
			>
				<button
					type="button"
					onclick={onStartNewRoast}
					class="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
				>
					Roast this coffee
				</button>
				<a
					href={coffeeRoastsHref(selectedBean.id)}
					class="text-sm font-semibold text-link transition-colors hover:text-accent"
				>
					See all in Roasts <span aria-hidden="true">→</span>
				</a>
			</div>
		{/if}
	</div>

	{#if !readOnly && !hasStudio}
		<div
			class="relative overflow-hidden rounded-lg border border-accent/20 bg-accent-subtle/10 p-5 pl-7"
		>
			<AccentSpine />
			<p class="leading-7 text-muted">
				<span class="font-semibold text-ink">Roast history is part of Mallard Studio.</span>
				Log roasts against this coffee, compare them, and plan the next one.
			</p>
			<a
				href="/subscription?plan=studio-monthly"
				class="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
			>
				See Mallard Studio
			</a>
		</div>
	{:else if loadFailed}
		<div class="rounded-lg bg-surface-canvas p-6 ring-1 ring-line" role="alert">
			<p class="font-semibold text-ink">Roasts could not be loaded.</p>
			<button
				type="button"
				class="mt-3 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
				onclick={() => retry++}
			>
				Try again
			</button>
		</div>
	{:else if roasts === null}
		<p role="status" class="text-sm text-muted">Loading roasts…</p>
	{:else if rows.length === 0}
		<div class="rounded-lg bg-surface-canvas p-6 ring-1 ring-line">
			<p class="text-muted">
				<span class="font-semibold text-ink">No roasts of this coffee yet.</span>
				{#if !readOnly}Roast it and its history will build here.{/if}
			</p>
			{#if !readOnly}
				<button
					type="button"
					onclick={onStartNewRoast}
					class="mt-4 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
				>
					Roast this coffee
				</button>
			{/if}
		</div>
	{:else}
		<div
			role="table"
			aria-label="Roasts of this coffee, newest first"
			class="overflow-hidden rounded-lg bg-surface-canvas ring-1 ring-line"
		>
			<!-- On a phone the header names the four values on each row's second line. -->
			<div
				role="row"
				class="border-b border-line px-3 py-2 text-xs font-medium text-muted {rowGrid}"
			>
				<span role="columnheader" class="w-5"><span class="sr-only">Compare</span></span>
				<div role="presentation" class="hidden sm:contents">
					<span role="columnheader">Date</span>
					<span role="columnheader">Batch</span>
				</div>
				<div role="presentation" class="col-start-2 grid grid-cols-4 gap-x-2 sm:contents">
					<span role="columnheader" class="hidden sm:block">In → out</span>
					<span role="columnheader">Loss</span>
					<span role="columnheader">Time</span>
					<span role="columnheader">Drop</span>
					<span role="columnheader">Dev</span>
				</div>
			</div>
			{#each rows as row, index (row.roastId)}
				{@const menuLinks = readOnly || !roasts ? [] : rowMenu(roasts[index])}
				<div
					role="row"
					class="relative gap-y-1 border-b border-line px-3 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-surface-panel {rowGrid}"
				>
					<span
						role="cell"
						class="relative z-10 col-start-1 row-span-2 row-start-1 flex w-5 items-start pt-0.5 sm:row-span-1"
					>
						{#if !readOnly}
							<input
								type="checkbox"
								class="h-4 w-4 rounded border-line text-accent focus:ring-accent"
								checked={ticked.includes(row.roastId)}
								onchange={() => toggleTick(row.roastId)}
								aria-label="Compare roast #{row.roastId}, {row.date}"
							/>
						{/if}
					</span>
					<div
						role="presentation"
						class="col-start-2 row-start-1 flex min-w-0 items-baseline gap-2 sm:contents"
					>
						<span role="cell" class="shrink-0 font-semibold tabular-nums text-ink">
							{#if readOnly}
								{row.date}
							{:else}
								<a
									href={roastHref(row.roastId)}
									class="rounded-sm after:absolute after:inset-0 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								>
									{row.date}<span class="sr-only">, {row.batch}, roast #{row.roastId}</span>
								</a>
							{/if}
						</span>
						<span role="cell" class="min-w-0 truncate text-muted" title={row.batch}>
							{row.batch}
						</span>
					</div>
					<div
						role="presentation"
						class="col-start-2 row-start-2 grid grid-cols-4 gap-x-2 tabular-nums text-ink sm:contents"
					>
						<span role="cell" class="hidden sm:block">{row.weights}</span>
						<span role="cell">{row.loss}</span>
						<span role="cell">{row.time}</span>
						<span role="cell">{row.drop}</span>
						<span role="cell">{row.development}</span>
					</div>
					{#if menuLinks.length > 0}
						<div role="cell" class="relative z-10 col-start-3 row-start-1 sm:col-start-9">
							<details class="relative">
								<summary
									class="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-md text-muted transition-colors hover:bg-accent/10 hover:text-accent [&::-webkit-details-marker]:hidden"
									aria-label="More for roast #{row.roastId}"
								>
									<span aria-hidden="true">⋯</span>
								</summary>
								<div
									class="absolute right-0 top-7 z-20 min-w-[10rem] rounded-lg border border-line bg-surface-canvas p-1 shadow-lg"
								>
									{#each menuLinks as link (link.label)}
										<a
											href={link.href}
											class="block rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-panel hover:text-accent"
										>
											{link.label}
										</a>
									{/each}
								</div>
							</details>
						</div>
					{/if}
					{#if index === 0 && newestDifference}
						<span role="cell" class="col-start-2 col-end-[-1] block text-xs font-medium text-ink">
							{newestDifference}
						</span>
					{/if}
				</div>
			{/each}
		</div>

		{#if !readOnly && rows.length > 1}
			<div class="flex flex-wrap items-center justify-between gap-3">
				<p class="text-sm text-muted" aria-live="polite">
					{ticked.length === 0 ? 'Tick two roasts to compare them.' : `${ticked.length} selected`}
				</p>
				{#if compareLink}
					<a
						href={compareLink}
						class="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
					>
						Compare
					</a>
				{:else}
					<button
						type="button"
						disabled
						class="rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted opacity-60"
					>
						Compare
					</button>
				{/if}
			</div>
		{/if}
	{/if}
</div>
