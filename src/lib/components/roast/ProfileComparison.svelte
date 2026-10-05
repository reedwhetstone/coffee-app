<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import type { components } from '@purveyors/sdk';
	import {
		COMPARISON_SIDES,
		buildProfileComparisonChart,
		describeMilestoneTimings,
		milestoneHeadline,
		type ComparisonSideMilestones,
		type ProfileComparison
	} from '$lib/roast/profile-comparison-model';
	import {
		buildCompareOptionGroups,
		buildProfileOptionGroups,
		findProfileOption,
		formatShortDay,
		recordedRoasts,
		type PickerRoast,
		type ProfileOption
	} from '$lib/roast/profile-picker-model';
	import {
		compareSideToOptionValue,
		optionValueToCompareSide,
		roastHref,
		type CompareSide,
		type CompareSides
	} from '$lib/roast/compare-sides';
	import { trackProfileStudioActivation } from '$lib/profileStudio/analytics';
	import ProfilePicker from './ProfilePicker.svelte';

	type ReferenceProfileSummary = components['schemas']['ReferenceProfileSummary'];

	let {
		roasts,
		roastsError = false,
		onRetryRoasts,
		a,
		b,
		onChange
	}: {
		roasts: PickerRoast[];
		/** The roast list could not be loaded. Saved references can still be compared. */
		roastsError?: boolean;
		onRetryRoasts?: () => void;
		/** The two sides named in the link. */
		a: CompareSide | null;
		b: CompareSide | null;
		onChange: (sides: CompareSides) => void;
	} = $props();

	let profiles = $state<ReferenceProfileSummary[]>([]);
	let loading = $state(true);
	let referencesError = $state(false);
	let comparing = $state(false);
	let compareError = $state<string | null>(null);
	let comparison = $state<ProfileComparison | null>(null);
	let sideMilestones = $state<ComparisonSideMilestones | null>(null);
	let compared = $state<{ left: ProfileOption; right: ProfileOption } | null>(null);
	let leftPicker = $state<ProfilePicker>();
	let rightPicker = $state<ProfilePicker>();
	let latestRequest = 0;

	const leftValue = $derived(compareSideToOptionValue(a));
	const rightValue = $derived(compareSideToOptionValue(b));
	const executedRoasts = $derived(recordedRoasts(roasts));
	const unrecordedRoastCount = $derived(roasts.length - executedRoasts.length);
	const everything = $derived(buildProfileOptionGroups(roasts, profiles));
	const leftOption = $derived(findProfileOption(everything, leftValue));
	const rightOption = $derived(findProfileOption(everything, rightValue));
	// Each picker leaves out the other side's choice and lists that coffee's roasts first.
	const leftGroups = $derived(buildCompareOptionGroups(roasts, profiles, rightOption?.value));
	const rightGroups = $derived(buildCompareOptionGroups(roasts, profiles, leftOption?.value));
	const nothingToCompare = $derived(
		!loading &&
			!referencesError &&
			!roastsError &&
			executedRoasts.length === 0 &&
			profiles.length === 0
	);
	const pair = $derived(
		leftOption && rightOption && leftOption.value !== rightOption.value
			? `${leftOption.value}|${rightOption.value}`
			: ''
	);
	const onlyChosen = $derived(leftOption && !rightValue ? leftOption : null);

	// The roast page defers the LayerCake/D3 chart bundle; load it only once a
	// comparison is ready to draw.
	const loadRoastChart = () => import('./chart/RoastChart.svelte');

	const chartData = $derived(comparison ? buildProfileComparisonChart(comparison) : null);
	const milestoneTimings = $derived(
		comparison ? describeMilestoneTimings(comparison, sideMilestones) : []
	);
	const headline = $derived(comparison ? milestoneHeadline(comparison) : null);
	const comparedSides = $derived(
		compared
			? [
					{ tag: COMPARISON_SIDES.left, lines: 'Solid lines', ...compared.left },
					{ tag: COMPARISON_SIDES.right, lines: 'Dashed lines', ...compared.right }
				]
			: []
	);
	const cherryHref = $derived.by(() => {
		if (!compared) return '/chat';
		const prompt = `Discuss the measured differences between ${compared.left.spoken} and ${compared.right.spoken}, and help me decide what to preserve or change.`;
		return `/chat?${new URLSearchParams({
			source: 'profile-studio',
			prompt,
			left_kind: compared.left.kind,
			left_id: compared.left.id,
			right_kind: compared.right.kind,
			right_id: compared.right.id
		}).toString()}`;
	});

	/** "Ethiopia Yirgacheffe Wush Wush, Oct 1": enough to recognise the side already chosen. */
	function shortName(option: ProfileOption): string {
		if (option.kind !== 'executed_roast') return option.title;
		const roast = roasts.find((candidate) => String(candidate.roast_id) === option.id);
		const day = formatShortDay(roast?.roast_date);
		return day ? `${option.title}, ${day}` : option.title;
	}

	/** Why a side named in the link is not on screen, once everything it could be has loaded. */
	function missingSide(side: CompareSide | null, option: ProfileOption | null): string | null {
		if (!side || option) return null;
		if (side.type === 'ref') {
			return loading || referencesError ? null : 'That saved reference could not be found';
		}
		if (roastsError) return null;
		return roasts.some((roast) => roast.roast_id === side.id)
			? 'That roast has no recorded curve to compare'
			: 'That roast could not be found';
	}
	const sideProblems = $derived(
		[missingSide(a, leftOption), missingSide(b, rightOption)].filter(
			(problem, index, all): problem is string => problem !== null && all.indexOf(problem) === index
		)
	);

	/** Say what the member can do about a comparison that Parchment could not line up. */
	function comparisonError(message: unknown): string {
		if (typeof message !== 'string' || !message) return 'These two could not be compared.';
		return /charge milestone/i.test(message)
			? 'One of these has no charge time recorded, so the two curves cannot be lined up. Choose one with a recorded curve.'
			: message;
	}

	function choose(side: 'a' | 'b', value: string) {
		const chosen = optionValueToCompareSide(value);
		if (!chosen) return;
		onChange(side === 'a' ? { a: chosen, b } : { a, b: chosen });
	}

	async function loadReferences() {
		loading = true;
		referencesError = false;
		try {
			const response = await fetch('/api/reference-profiles');
			const body = await response.json();
			if (!response.ok) throw new Error(body.error);
			profiles = body.data ?? [];
		} catch {
			referencesError = true;
		} finally {
			loading = false;
		}
	}

	async function compare(left: ProfileOption, right: ProfileOption) {
		const request = ++latestRequest;
		comparing = true;
		compareError = null;
		comparison = null;
		compared = null;
		try {
			const response = await fetch('/api/reference-profiles/compare', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					left: { kind: left.kind, id: left.id },
					right: { kind: right.kind, id: right.id },
					targetUnit: 'F'
				})
			});
			const body = await response.json();
			if (request !== latestRequest) return;
			if (!response.ok) throw new Error(comparisonError(body.error));
			comparison = body.data;
			sideMilestones = body.sideMilestones ?? null;
			compared = { left, right };
			trackProfileStudioActivation('profile_comparison_completed');
		} catch (cause) {
			if (request !== latestRequest) return;
			compareError = cause instanceof Error ? cause.message : comparisonError(null);
		} finally {
			if (request === latestRequest) comparing = false;
		}
	}

	// The comparison follows the link: it runs whenever both sides are chosen, and again
	// when either one changes. Only the pair is tracked, so reloading the lists does not
	// run it twice.
	$effect(() => {
		if (!pair) {
			latestRequest += 1;
			comparing = false;
			comparison = null;
			compared = null;
			compareError = null;
			return;
		}
		untrack(() => {
			if (leftOption && rightOption) void compare(leftOption, rightOption);
		});
	});

	onMount(() => {
		void loadReferences();
		// Arriving with one side chosen, the next step is choosing the other.
		void tick().then(() => {
			if (leftOption && !rightValue) rightPicker?.focus();
			else if (rightOption && !leftValue) leftPicker?.focus();
		});
	});
</script>

{#if nothingToCompare}
	<p class="rounded-xl border border-line bg-surface-panel p-4 text-sm text-muted">
		Record or import a roast, and it will appear here to compare.
	</p>
{:else}
	<div class="rounded-xl border border-line bg-surface-panel p-4">
		<div class="grid gap-3 md:grid-cols-2 md:items-start">
			<ProfilePicker
				bind:this={leftPicker}
				label="First ({COMPARISON_SIDES.left})"
				groups={leftGroups}
				bind:value={() => leftOption?.value ?? '', (value) => choose('a', value)}
				{loading}
			/>
			<ProfilePicker
				bind:this={rightPicker}
				label="Second ({COMPARISON_SIDES.right})"
				groups={rightGroups}
				bind:value={() => rightOption?.value ?? '', (value) => choose('b', value)}
				{loading}
			/>
		</div>
		{#if onlyChosen}
			<p class="mt-3 text-sm text-muted">
				Choose a second roast or saved reference to compare with {shortName(onlyChosen)}.
			</p>
		{/if}
		{#each sideProblems as problem (problem)}
			<p role="alert" class="mt-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong">
				{problem}
			</p>
		{/each}
		{#if roastsError}
			<div
				role="alert"
				class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
			>
				<span>Roasts could not be loaded.</span>
				<button
					type="button"
					class="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-danger hover:text-white"
					onclick={() => onRetryRoasts?.()}>Try again</button
				>
			</div>
		{/if}
		{#if referencesError}
			<div
				role="alert"
				class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
			>
				<span>Saved references could not be loaded.</span>
				<button
					type="button"
					class="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-danger hover:text-white"
					onclick={loadReferences}>Try again</button
				>
			</div>
		{/if}
		{#if compareError}
			<p role="alert" class="mt-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong">
				{compareError}
			</p>
		{/if}
		{#if comparing}
			<p role="status" class="mt-3 text-sm text-muted">Comparing…</p>
		{/if}
		{#if unrecordedRoastCount > 0}
			<p class="mt-3 text-xs text-muted">
				{unrecordedRoastCount === 1
					? '1 roast with nothing recorded yet is not listed.'
					: `${unrecordedRoastCount} roasts with nothing recorded yet are not listed.`}
			</p>
		{/if}
	</div>
{/if}

{#if comparison && compared && chartData}
	<!-- A phone reads down: the key, the largest difference, the chart, the table, then the link. -->
	<div
		class="mt-5 flex flex-col rounded-xl border border-line bg-surface-canvas p-4 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-4"
	>
		<dl class="min-w-0 space-y-2" aria-label="Compared">
			{#each comparedSides as side (side.tag)}
				<div class="flex items-start gap-3">
					<dt class="flex shrink-0 items-center gap-2 pt-0.5 text-sm font-semibold text-ink">
						<svg width="28" height="8" aria-hidden="true">
							<line
								x1="0"
								y1="4"
								x2="28"
								y2="4"
								stroke="currentColor"
								stroke-width="2"
								stroke-dasharray={side.tag === COMPARISON_SIDES.right ? '5,4' : 'none'}
							/>
						</svg>
						{side.tag}
					</dt>
					<dd class="min-w-0">
						{#if side.kind === 'executed_roast'}
							<a
								href={roastHref(Number(side.id))}
								class="block text-sm font-semibold text-ink hover:text-accent">{side.title}</a
							>
						{:else}
							<span class="block text-sm font-semibold text-ink">{side.title}</span>
						{/if}
						<span class="block text-xs text-muted">{side.detail} · {side.lines}</span>
					</dd>
				</div>
			{/each}
		</dl>
		<a
			href={cherryHref}
			class="order-last mt-4 shrink-0 text-sm font-semibold text-link hover:text-accent sm:order-none sm:mt-0"
			>Discuss with Cherry AI</a
		>

		{#if headline}
			<p class="mt-4 text-lg font-semibold text-ink sm:col-span-2">{headline}</p>
		{/if}

		<div class="mt-4 grid gap-6 sm:col-span-2 lg:grid-cols-[minmax(0,1fr)_24rem]">
			<div class="min-w-0">
				<div class="h-[24rem] min-h-[20rem]">
					{#await loadRoastChart() then { default: RoastChart }}
						<RoastChart {chartData} />
					{:catch}
						<p class="text-sm text-muted">
							The comparison chart could not load. Refresh to try again.
						</p>
					{/await}
				</div>
				<p class="mt-3 text-sm text-muted">
					Shown in °{comparison.targetUnit}. The chart covers the time both were recording. A break
					in a line means no reading was recorded there.
				</p>
			</div>
			{#if milestoneTimings.length > 0}
				<div class="min-w-0">
					<h2 class="text-sm font-semibold text-ink">Milestone timing</h2>
					<p class="mt-1 text-xs text-muted">
						Time from charge to each milestone, and how much earlier or later
						{COMPARISON_SIDES.right} reached it than {COMPARISON_SIDES.left}.
					</p>
					<table class="mt-2 w-full text-left text-sm">
						<thead class="sr-only sm:not-sr-only">
							<tr class="text-xs text-muted">
								<th scope="col" class="py-1 pr-4 font-medium">Milestone</th>
								<th scope="col" class="py-1 pr-4 font-medium">{COMPARISON_SIDES.left}</th>
								<th scope="col" class="py-1 pr-4 font-medium">{COMPARISON_SIDES.right}</th>
								<th scope="col" class="py-1 font-medium">Difference</th>
							</tr>
						</thead>
						<tbody>
							{#each milestoneTimings as timing (timing.name)}
								<!-- On a phone each milestone is a row of its own: name, both times, then the difference. -->
								<tr class="grid grid-cols-2 gap-x-4 border-t border-line py-2 sm:table-row sm:py-0">
									<th
										scope="row"
										class="col-span-2 font-medium text-ink sm:py-1.5 sm:pr-4 sm:align-top"
										>{timing.label}</th
									>
									<td class="tabular-nums text-ink sm:py-1.5 sm:pr-4 sm:align-top"
										><span class="mr-1 text-xs text-muted sm:hidden">{COMPARISON_SIDES.left}</span
										>{timing.leftTime}</td
									>
									<td class="tabular-nums text-ink sm:py-1.5 sm:pr-4 sm:align-top"
										><span class="mr-1 text-xs text-muted sm:hidden">{COMPARISON_SIDES.right}</span
										>{timing.rightTime}</td
									>
									<td
										class="col-span-2 sm:py-1.5 sm:align-top {timing.missing
											? 'text-muted'
											: 'text-ink'}">{timing.difference}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
{/if}
