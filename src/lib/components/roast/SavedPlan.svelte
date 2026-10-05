<script lang="ts">
	import { untrack } from 'svelte';
	import type { components } from '@purveyors/sdk';
	import { buildProfileGenerationChart } from '$lib/roast/profile-generation-model';
	import { compareHref } from '$lib/roast/compare-sides';
	import { referenceOption } from '$lib/roast/profile-picker-model';
	import { planHref, type ReferenceChart, type SavedReference } from '$lib/roast/roast-plan';

	type ChartAnswer = components['schemas']['ReferenceProfileChartResponse']['data'];

	let {
		planId,
		profiles,
		justSaved = false
	}: {
		planId: string;
		profiles: SavedReference[];
		/** The plan was saved on this visit, so the page says so. */
		justSaved?: boolean;
	} = $props();

	let loaded = $state<{
		key: string;
		chart: ReferenceChart;
		startedFrom: { profile: SavedReference; chart: ReferenceChart } | null;
	} | null>(null);
	let chartFailed = $state(false);

	const plan = $derived(
		profiles.find(
			(profile) => profile.id === planId && profile.sourceClass === 'generated_revision'
		) ?? null
	);
	const key = $derived(plan ? `${plan.id}@${plan.currentRevisionId}` : '');
	const curve = $derived(loaded?.key === key ? loaded : null);
	const chartData = $derived(
		curve ? buildProfileGenerationChart(curve.startedFrom?.chart ?? null, curve.chart) : null
	);
	const downloadHref = $derived(plan ? `${revisionPath(plan)}/export` : '');

	const loadRoastChart = () => import('./chart/RoastChart.svelte');

	function revisionPath(profile: SavedReference): string {
		return `/api/reference-profiles/${encodeURIComponent(profile.id)}/revisions/${encodeURIComponent(profile.currentRevisionId)}`;
	}

	async function fetchChart(profile: SavedReference): Promise<ChartAnswer | null> {
		const response = await fetch(`${revisionPath(profile)}/chart`);
		const body: { data?: ChartAnswer } | null = await response.json().catch(() => null);
		return response.ok && body?.data?.chart ? body.data : null;
	}

	/** The plan's curve, over the saved reference it was made from when that is still on record. */
	async function loadCurve(profile: SavedReference, requested: string) {
		chartFailed = false;
		try {
			const answer = await fetchChart(profile);
			if (requested !== key) return;
			if (!answer) throw new Error('No chart');
			const parentRevisionId = answer.revision.parentRevisionId;
			const parent = profiles.find((entry) => entry.currentRevisionId === parentRevisionId);
			const parentAnswer = parent ? await fetchChart(parent).catch(() => null) : null;
			if (requested !== key) return;
			loaded = {
				key: requested,
				chart: answer.chart,
				startedFrom: parent && parentAnswer ? { profile: parent, chart: parentAnswer.chart } : null
			};
		} catch {
			if (requested === key) chartFailed = true;
		}
	}

	$effect(() => {
		const requested = key;
		untrack(() => {
			if (plan && loaded?.key !== requested) void loadCurve(plan, requested);
		});
	});
</script>

{#if !plan}
	<div class="rounded-xl border border-line bg-surface-panel p-4 sm:p-6">
		<h2 class="font-semibold text-ink">That plan could not be found.</h2>
		<p class="mt-1 text-sm text-muted">It may have been removed.</p>
		<a
			href={planHref()}
			class="mt-4 inline-flex rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink"
			>Plan a roast</a
		>
	</div>
{:else}
	<div class="rounded-xl border border-line bg-surface-panel p-4 sm:p-6">
		{#if justSaved}
			<p role="status" class="mb-4 rounded-lg bg-success-subtle p-3 text-sm text-success-strong">
				{plan.title} is saved. Your roast history is not changed.
			</p>
		{/if}
		<h2 class="break-words text-lg font-semibold text-ink">{plan.title}</h2>
		<p class="mt-1 text-sm text-muted">
			{referenceOption(plan).detail}{curve?.startedFrom
				? ` · Started from ${curve.startedFrom.profile.title}`
				: ''}
		</p>

		<div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
			<a
				href={downloadHref}
				download
				class="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink"
				>Download for Artisan (.alog)</a
			>
			{#if curve?.startedFrom}
				<a
					href={compareHref({
						a: { type: 'ref', id: curve.startedFrom.profile.id },
						b: { type: 'ref', id: plan.id }
					})}
					class="text-sm font-semibold text-link hover:text-accent"
					>Compare with what it started from</a
				>
			{/if}
			<a
				href={planHref({ from: { type: 'ref', id: plan.id } })}
				class="text-sm font-semibold text-link hover:text-accent">Plan from this</a
			>
		</div>
		<p class="mt-3 max-w-2xl text-sm text-muted">
			In Artisan, open Roast, then Background, and load this file. The plan appears behind your live
			curve as a guide. It does not control your roaster, unless Artisan is set to play back a
			background’s events or to follow the background.
		</p>

		{#if chartData}
			<div class="mt-5 rounded-xl bg-surface-canvas p-3 sm:p-4">
				{#if curve?.startedFrom}
					<p class="text-sm text-muted">The dashed line is what you started from.</p>
				{/if}
				<div class="mt-2 h-[24rem] min-h-[20rem]">
					{#await loadRoastChart() then { default: RoastChart }}
						<RoastChart {chartData} />
					{:catch}
						<p class="text-sm text-muted">The chart could not load. Refresh to try again.</p>
					{/await}
				</div>
			</div>
		{:else if chartFailed}
			<div
				role="alert"
				class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
			>
				<span>The plan’s curve could not be loaded. The download still works.</span>
				<button
					type="button"
					class="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-danger hover:text-white"
					onclick={() => loadCurve(plan, key)}>Try again</button
				>
			</div>
		{/if}
	</div>
{/if}
