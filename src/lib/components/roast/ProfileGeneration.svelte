<script lang="ts">
	import { tick, untrack } from 'svelte';
	import type { components } from '@purveyors/sdk';
	import {
		buildProfileGenerationChart,
		chargeOffsetMilliseconds
	} from '$lib/roast/profile-generation-model';
	import {
		clearIdempotencyKey,
		reserveIdempotencyKey,
		shouldRetainIdempotencyKey
	} from '$lib/idempotency';
	import {
		compareSideToOptionValue,
		optionValueToCompareSide,
		roastHref,
		type CompareSide
	} from '$lib/roast/compare-sides';
	import {
		buildPlanStartGroups,
		describeAdjustment,
		isRoastSourceReason,
		olderRoastsLine,
		planHref,
		planStartKey,
		planStarts,
		referenceChartFromRoast,
		resolvePlanStart,
		roastSourceReasonCopy,
		unlistedRoastStart,
		unusableRoastsLine,
		type PlanStart,
		type ReferenceChart,
		type RoastCandidate,
		type RoastChartData,
		type RoastSourceReason,
		type SavedReference
	} from '$lib/roast/roast-plan';
	import ProfilePicker from './ProfilePicker.svelte';

	type Changes = components['schemas']['ReferenceProfileGenerationRequest']['changes'];
	type Preview = components['schemas']['ReferenceProfileGenerationPreviewResponse']['data'];
	type RoastPreview =
		components['schemas']['ReferenceProfileRoastGenerationPreviewResponse']['data'];
	type SavedProfile = components['schemas']['ReferenceProfileResponse']['data'];
	type Target = { id: string; revisionId: string };
	type Failure = { error?: string; code?: string; reason?: string } | null;
	/** A roast Parchment will not build a plan on, or could not find. */
	type Refusal = { roastId: number; reason: RoastSourceReason | null; missing: boolean };

	const SOURCE_UNAVAILABLE = 'roast_artisan_source_unavailable';
	// Parchment builds a plan only on the roast as the page read it.
	const ROAST_CHANGED =
		'This roast changed after this page opened. Reload the page to plan from it.';
	const GENERATION_SCOPE = 'profile-studio-generation';
	const REFERENCE_SCOPE = 'roast-plan-reference';

	let {
		candidates,
		profiles,
		ineligibleRoastCount = 0,
		eligibleRoastCount = 0,
		referencesFailed = false,
		roastsFailed = false,
		from,
		ownerId,
		onStartChange,
		onSaved
	}: {
		/** Roasts whose Artisan file is on record, newest first. */
		candidates: RoastCandidate[];
		profiles: SavedReference[];
		/** How many of the account's other roasts have no usable Artisan file. */
		ineligibleRoastCount?: number;
		/** How many of the account's roasts can be planned from, listed here or not. */
		eligibleRoastCount?: number;
		/** The saved references could not be read, so none being listed says nothing about them. */
		referencesFailed?: boolean;
		/** The roasts could not be read, so none being listed says nothing about them. */
		roastsFailed?: boolean;
		/** What the link asks to start from. */
		from: CompareSide | null;
		ownerId: string | null;
		onStartChange: (side: CompareSide) => void;
		onSaved: (plan: Target & { title: string }) => void | Promise<void>;
	} = $props();

	const uid = $props.id();

	let title = $state('');
	let titleEdited = $state(false);
	let direction = $state<'raise' | 'lower'>('raise');
	let kind = $state<'bean_temperature' | 'environmental_temperature'>('bean_temperature');
	let degrees = $state('5');
	let startMinutes = $state('0');
	let endMinutes = $state('5');
	let busy = $state<'preview' | 'save' | null>(null);
	let previewError = $state<string | null>(null);
	let saveError = $state<string | null>(null);
	let preview = $state<Preview | null>(null);
	// The inputs the preview on screen was drawn for, and the change exactly as Parchment read it.
	let previewed = $state<{ fingerprint: string; changes: Changes } | null>(null);
	let loadedChart = $state<{ key: string; chart: ReferenceChart } | null>(null);
	// A roast named in the link that the list of roasts does not carry.
	let accepted = $state<PlanStart | null>(null);
	let refusal = $state<Refusal | null>(null);
	let checkingRoastId = $state<number | null>(null);
	let uncheckedRoastId = $state<number | null>(null);
	// The saved reference a roast's Artisan file was kept under, so a second try reuses it.
	let keptReference = $state<(Target & { key: string }) | null>(null);
	let referenceKept = $state(false);
	// The plan this preview was saved as. It is saved once, whatever happens on the way to it.
	let savedPlan = $state<(Target & { title: string }) | null>(null);
	let previewSection = $state<HTMLElement | null>(null);

	const storage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
	const loadRoastChart = () => import('./chart/RoastChart.svelte');

	const starts = $derived.by(() => {
		const listed = planStarts(candidates, profiles);
		const extra = accepted;
		return extra &&
			!listed.some(
				(start) => start.side.type === extra.side.type && start.side.id === extra.side.id
			)
			? [...listed, extra]
			: listed;
	});
	const failed = $derived({ references: referencesFailed, roasts: roastsFailed });
	const groups = $derived(buildPlanStartGroups(starts, failed));
	const resolution = $derived(resolvePlanStart(from, starts, candidates, profiles, failed));
	// Only two lists that were both read and both came back empty mean there is nothing to start from.
	const nothingToStartFrom = $derived(starts.length === 0 && !referencesFailed && !roastsFailed);
	const start = $derived(resolution.status === 'ready' ? resolution.start : null);
	const startKey = $derived(start ? planStartKey(start) : '');
	// Only the curve loaded for the current start may place, limit, or sit behind a plan.
	const startChart = $derived(loadedChart?.key === startKey ? loadedChart.chart : null);
	const temperatureUnit = $derived(startChart?.temperatureUnit ?? 'F');
	const maxDegrees = $derived(maxDegreesFor(temperatureUnit));
	const unusableLine = $derived(unusableRoastsLine(ineligibleRoastCount));
	const olderLine = $derived(olderRoastsLine(candidates.length, eligibleRoastCount));
	const fingerprint = $derived(
		JSON.stringify({
			start: startKey,
			kind,
			direction,
			degrees: Number(degrees),
			from: Number(startMinutes),
			to: Number(endMinutes)
		})
	);
	const matchingPreview = $derived(!!preview && previewed?.fingerprint === fingerprint);
	const chartData = $derived(
		preview && startChart ? buildProfileGenerationChart(startChart, preview.chart) : null
	);

	/** Why the roast or reference in the link cannot be planned from, and what to do instead. */
	const stop = $derived.by(
		(): { heading?: string; text: string; href?: string; action?: string } | null => {
			if (from?.type === 'roast' && refusal?.roastId === from.id) {
				if (refusal.missing) return { text: 'That roast could not be found.' };
				return {
					heading: `Roast #${from.id}`,
					text: roastSourceReasonCopy(refusal.reason),
					href: roastHref(from.id),
					action: 'Open this roast'
				};
			}
			if (resolution.status === 'missing')
				return { text: 'That saved reference could not be found.' };
			if (resolution.status === 'snapshot') {
				const roastId = resolution.sourceRoastId;
				return {
					text: 'This saved reference holds a roast’s chart and not its Artisan file, so a plan cannot be built from it.',
					...(roastId
						? {
								href: planHref({ from: { type: 'roast', id: roastId } }),
								action: 'Plan from the roast it was saved from'
							}
						: {})
				};
			}
			return null;
		}
	);

	function maxDegreesFor(unit: 'F' | 'C'): number {
		return unit === 'C' ? 10 : 20;
	}

	function revisionPath(target: Target): string {
		return `/api/reference-profiles/${encodeURIComponent(target.id)}/revisions/${encodeURIComponent(target.revisionId)}`;
	}

	/** The form counts minutes from charge; Parchment counts milliseconds from the start of the recording. */
	function plannedChanges(chart: ReferenceChart, offset: number): Changes | null {
		const begin = Number(startMinutes);
		const end = Number(endMinutes);
		const size = Number(degrees);
		if (
			!Number.isFinite(begin) ||
			!Number.isFinite(end) ||
			!Number.isFinite(size) ||
			begin < 0 ||
			end <= begin ||
			size <= 0 ||
			size > maxDegreesFor(chart.temperatureUnit)
		)
			return null;
		return {
			temperatureAdjustments: [
				{
					kind,
					startMilliseconds: Math.round(begin * 60_000) + offset,
					endMilliseconds: Math.round(end * 60_000) + offset,
					delta: direction === 'raise' ? size : -size
				}
			]
		};
	}

	async function fetchRoastChart(roastId: number): Promise<RoastChartData | null> {
		const response = await fetch(`/api/roast-chart-data?roastId=${roastId}`);
		const body: RoastChartData | null = await response.json().catch(() => null);
		return response.ok && body?.metadata ? body : null;
	}

	/** A roast is drawn from its own recorded curve; a saved reference from its saved chart. */
	async function loadStartChart(requested: PlanStart): Promise<ReferenceChart | null> {
		const key = planStartKey(requested);
		if (loadedChart?.key === key) return loadedChart.chart;
		try {
			let chart: ReferenceChart | null = null;
			if (requested.kind === 'roast') {
				const data = await fetchRoastChart(requested.roastId);
				chart = data ? referenceChartFromRoast(data) : null;
			} else {
				const response = await fetch(
					`${revisionPath({ id: requested.profileId, revisionId: requested.revisionId })}/chart`
				);
				const body: { data?: { chart?: ReferenceChart } } | null = await response
					.json()
					.catch(() => null);
				chart = response.ok ? (body?.data?.chart ?? null) : null;
			}
			if (key !== startKey) return null;
			if (!chart) throw new Error('No chart');
			loadedChart = { key, chart };
			return chart;
		} catch {
			if (key === startKey)
				previewError = 'The curve this plan starts from could not be loaded. Try again.';
			return null;
		}
	}

	function refuse(roastId: number, failure: Failure, status: number): boolean {
		if (failure?.code === SOURCE_UNAVAILABLE) {
			refusal = {
				roastId,
				reason: isRoastSourceReason(failure.reason) ? failure.reason : null,
				missing: false
			};
			return true;
		}
		if (status === 404) {
			refusal = { roastId, reason: null, missing: true };
			return true;
		}
		return false;
	}

	/**
	 * Parchment lists the newest roasts that can be planned from, not all of them. For a roast
	 * outside that list, a preview is the one read that says whether its Artisan file is on
	 * record, and why not when it is not. Nothing is saved and the preview is not shown.
	 */
	async function checkRoast(roastId: number) {
		checkingRoastId = roastId;
		uncheckedRoastId = null;
		try {
			const data = await fetchRoastChart(roastId);
			if (!data) throw new Error('No roast');
			const roastRevision = data.metadata.revision;
			if (!roastRevision) {
				refusal = { roastId, reason: null, missing: false };
				return;
			}
			const chart = referenceChartFromRoast(data);
			const offset = chargeOffsetMilliseconds(chart);
			const response = await fetch('/api/reference-profiles/from-roast/preview', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					roastId,
					roastRevision,
					title: 'Plan',
					changes: {
						temperatureAdjustments: [
							{
								kind: 'bean_temperature',
								startMilliseconds: offset,
								endMilliseconds: offset + 300_000,
								delta: 5
							}
						]
					}
				})
			});
			const body: ({ data?: RoastPreview } & NonNullable<Failure>) | null = await response
				.json()
				.catch(() => null);
			let found: PlanStart;
			if (response.ok && body?.data) {
				const roast = body.data.sourceRoast;
				found = unlistedRoastStart({
					roastId: roast.id,
					roastRevision: roast.revision,
					batchName: roast.batchName,
					coffeeName: roast.coffeeName,
					roastDate: roast.roastDate
				});
			} else if (refuse(roastId, body, response.status)) {
				return;
			} else if (response.status === 400) {
				// Parchment read the roast's file and only turned down the trial change.
				found = unlistedRoastStart({
					roastId,
					roastRevision,
					batchName: null,
					coffeeName: null,
					roastDate: null
				});
			} else {
				throw new Error('Not checked');
			}
			loadedChart = { key: planStartKey(found), chart };
			accepted = found;
		} catch {
			uncheckedRoastId = roastId;
		} finally {
			if (checkingRoastId === roastId) checkingRoastId = null;
		}
	}

	async function requestPreview(
		requested: PlanStart,
		changes: Changes
	): Promise<{ preview: Preview | null; failure: Failure; status: number }> {
		const input = { title: title.trim() || 'Plan', changes };
		const response =
			requested.kind === 'roast'
				? await fetch('/api/reference-profiles/from-roast/preview', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							roastId: requested.roastId,
							roastRevision: requested.roastRevision,
							...input
						})
					})
				: await fetch(
						`${revisionPath({ id: requested.profileId, revisionId: requested.revisionId })}/preview`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify(input)
						}
					);
		const body: ({ data?: Preview } & NonNullable<Failure>) | null = await response
			.json()
			.catch(() => null);
		return {
			preview: response.ok ? (body?.data ?? null) : null,
			failure: body,
			status: response.status
		};
	}

	async function previewPlan() {
		const requested = start;
		const key = startKey;
		if (!requested || busy) return;
		busy = 'preview';
		previewError = null;
		saveError = null;
		referenceKept = false;
		savedPlan = null;
		preview = null;
		previewed = null;
		try {
			const chart = await loadStartChart(requested);
			// An answer for a start that is no longer chosen must never be shown as its preview.
			if (!chart || key !== startKey) return;
			const inputs = fingerprint;
			let changes = plannedChanges(chart, chargeOffsetMilliseconds(chart));
			if (!changes) {
				previewError = `Choose an end after the start, and a change of more than 0 and at most ${maxDegreesFor(chart.temperatureUnit)}°${chart.temperatureUnit}.`;
				return;
			}
			let result = await requestPreview(requested, changes);
			if (key !== startKey) return;
			// Charge was first read from the roast's own curve. The plan is built on its
			// Artisan file, so where that file puts charge decides where the change falls.
			if (result.preview && requested.kind === 'roast') {
				const fileOffset = chargeOffsetMilliseconds(result.preview.chart);
				const placed = plannedChanges(chart, fileOffset);
				if (placed && fileOffset !== chargeOffsetMilliseconds(chart)) {
					changes = placed;
					result = await requestPreview(requested, changes);
					if (key !== startKey) return;
				}
			}
			if (requested.kind === 'roast' && refuse(requested.roastId, result.failure, result.status))
				return;
			if (!result.preview)
				throw new Error(
					requested.kind === 'roast' && result.status === 409
						? ROAST_CHANGED
						: result.failure?.error || 'Unable to preview this plan'
				);
			preview = result.preview;
			previewed = { fingerprint: inputs, changes };
			// The chart is drawn below the form; bring what was asked for into view.
			void tick().then(() => previewSection?.scrollIntoView?.({ block: 'start' }));
		} catch (cause) {
			if (key === startKey)
				previewError = cause instanceof Error ? cause.message : 'Unable to preview this plan';
		} finally {
			busy = null;
		}
	}

	/** Keep the roast's Artisan file as a saved reference. Parchment returns the one already kept. */
	async function keepRoastFile(
		requested: Extract<PlanStart, { kind: 'roast' }>
	): Promise<Target | null> {
		const payload = JSON.stringify({
			roastId: requested.roastId,
			roastRevision: requested.roastRevision,
			// Named for the coffee and its date, so it can be told apart among saved references.
			title: requested.option.spoken.slice(0, 200)
		});
		const idempotencyKey = reserveIdempotencyKey(storage(), ownerId, REFERENCE_SCOPE, payload);
		const response = await fetch('/api/reference-profiles/from-roast', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
			body: payload
		});
		const body: ({ data?: SavedProfile } & NonNullable<Failure>) | null = await response
			.json()
			.catch(() => null);
		if (!response.ok) {
			if (!shouldRetainIdempotencyKey(response.status))
				clearIdempotencyKey(storage(), ownerId, REFERENCE_SCOPE, payload);
			if (refuse(requested.roastId, body, response.status)) return null;
			throw new Error(
				response.status === 409 ? ROAST_CHANGED : body?.error || 'Unable to save this plan'
			);
		}
		if (!body?.data?.id || !body.data.currentRevisionId)
			throw new Error('Unable to save this plan');
		clearIdempotencyKey(storage(), ownerId, REFERENCE_SCOPE, payload);
		return { id: body.data.id, revisionId: body.data.currentRevisionId };
	}

	async function savePlan() {
		const requested = start;
		const key = startKey;
		const drawn = preview;
		const inputs = previewed;
		if (!requested || !drawn || !inputs || busy || savedPlan) return;
		if (inputs.fingerprint !== fingerprint) {
			saveError = 'The plan changed after the preview. Preview it again before saving.';
			return;
		}
		const name = title.trim();
		if (!name) {
			saveError = 'Give the plan a name before saving.';
			return;
		}
		busy = 'save';
		saveError = null;
		referenceKept = false;
		// From here a roast's file is kept as a saved reference, whatever happens to the plan.
		let kept = false;
		try {
			let parent: Target | null;
			if (requested.kind === 'reference') {
				parent = { id: requested.profileId, revisionId: requested.revisionId };
			} else if (keptReference?.key === key) {
				parent = { id: keptReference.id, revisionId: keptReference.revisionId };
				kept = true;
			} else {
				parent = await keepRoastFile(requested);
				if (!parent) return;
				keptReference = { key, ...parent };
				kept = true;
			}
			if (drawn.parentRevisionId !== parent.revisionId) {
				saveError =
					'What this plan starts from changed after the preview. Preview it again before saving.';
				return;
			}
			const body = JSON.stringify({ title: name, changes: inputs.changes });
			const operation = JSON.stringify({ ...parent, body });
			const idempotencyKey = reserveIdempotencyKey(storage(), ownerId, GENERATION_SCOPE, operation);
			const response = await fetch(`${revisionPath(parent)}/generated`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
				body
			});
			const answer: ({ data?: SavedProfile } & NonNullable<Failure>) | null = await response
				.json()
				.catch(() => null);
			if (!response.ok) {
				if (!shouldRetainIdempotencyKey(response.status))
					clearIdempotencyKey(storage(), ownerId, GENERATION_SCOPE, operation);
				throw new Error(answer?.error || 'Unable to save this plan');
			}
			const saved = answer?.data;
			if (!saved?.id || !saved.currentRevisionId)
				throw new Error('Unable to confirm the saved plan');
			clearIdempotencyKey(storage(), ownerId, GENERATION_SCOPE, operation);
			kept = false;
			// The plan is saved from here. Failing to open it is not a failure to save it, and
			// must not leave the form offering to save the same plan a second time.
			const plan = { id: saved.id, revisionId: saved.currentRevisionId, title: saved.title };
			savedPlan = plan;
			try {
				await onSaved(plan);
			} catch {
				// The form keeps a link to the saved plan.
			}
		} catch (cause) {
			saveError = cause instanceof Error ? cause.message : 'Unable to save this plan';
			referenceKept = kept;
		} finally {
			busy = null;
		}
	}

	function choose(value: string) {
		const side = optionValueToCompareSide(value);
		if (side) onStartChange(side);
	}

	// A roast outside the listed ones is checked once, when the link names it.
	$effect(() => {
		if (resolution.status !== 'unlisted') return;
		const roastId = resolution.roastId;
		untrack(() => {
			if (
				refusal?.roastId !== roastId &&
				checkingRoastId !== roastId &&
				uncheckedRoastId !== roastId
			)
				void checkRoast(roastId);
		});
	});

	// A new start clears the preview drawn for the last one and brings up its curve.
	$effect(() => {
		void startKey;
		untrack(() => {
			preview = null;
			previewed = null;
			previewError = null;
			saveError = null;
			referenceKept = false;
			savedPlan = null;
			if (!titleEdited) title = start ? `${start.option.title} plan`.slice(0, 200) : '';
			if (start) void loadStartChart(start);
		});
	});
</script>

<div class="rounded-xl border border-line bg-surface-panel p-4 sm:p-6">
	<section aria-labelledby="{uid}-start">
		<h2 id="{uid}-start" class="font-semibold text-ink">1. Start from</h2>
		{#if nothingToStartFrom}
			<p class="mt-2 max-w-2xl text-sm text-muted">
				A plan starts from a roast or reference that still has its Artisan file.
				<a href="/roast?modal=new" class="font-semibold text-link hover:text-accent"
					>Import a roast from Artisan</a
				>, or add an Artisan file under
				<a href="/roast/saved" class="font-semibold text-link hover:text-accent"
					>Saved references and plans</a
				>.
			</p>
		{:else}
			<div class="mt-2 max-w-2xl">
				<ProfilePicker
					label="Roast or saved reference"
					{groups}
					bind:value={() => (start ? compareSideToOptionValue(start.side) : ''), choose}
				/>
			</div>
		{/if}
		{#if stop}
			<div role="status" class="mt-3 max-w-2xl rounded-lg bg-surface-canvas p-4 text-sm">
				{#if stop.heading}<p class="font-semibold text-ink">{stop.heading}</p>{/if}
				<p class="text-muted {stop.heading ? 'mt-1' : ''}">{stop.text}</p>
				{#if stop.href && stop.action}
					<a href={stop.href} class="mt-2 inline-block font-semibold text-link hover:text-accent"
						>{stop.action}</a
					>
				{/if}
			</div>
		{:else if from?.type === 'roast' && checkingRoastId === from.id}
			<p role="status" class="mt-3 text-sm text-muted">Checking this roast…</p>
		{:else if from?.type === 'roast' && uncheckedRoastId === from.id}
			{@const roastId = from.id}
			<div
				role="alert"
				class="mt-3 flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
			>
				<span>This roast could not be loaded.</span>
				<button
					type="button"
					class="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-danger hover:text-white"
					onclick={() => checkRoast(roastId)}>Try again</button
				>
			</div>
		{/if}
		{#if olderLine}
			<p class="mt-3 max-w-2xl text-xs text-muted">{olderLine}</p>
		{/if}
		{#if unusableLine}
			<p class="mt-3 max-w-2xl text-xs text-muted">{unusableLine}</p>
		{/if}
	</section>

	{#if !stop && !nothingToStartFrom}
		<section class="mt-6 border-t border-line pt-5" aria-labelledby="{uid}-change">
			<h2 id="{uid}-change" class="font-semibold text-ink">2. What to change</h2>
			<fieldset
				disabled={!start || busy !== null}
				class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-3 text-sm text-ink"
			>
				<select
					value={direction}
					onchange={(event) =>
						(direction = event.currentTarget.value === 'lower' ? 'lower' : 'raise')}
					aria-label="Raise or lower"
					class="min-h-11 rounded-md border border-line bg-surface-canvas pl-3 pr-8"
				>
					<option value="raise">Raise</option>
					<option value="lower">Lower</option>
				</select>
				<select
					value={kind}
					onchange={(event) =>
						(kind =
							event.currentTarget.value === 'environmental_temperature'
								? 'environmental_temperature'
								: 'bean_temperature')}
					aria-label="Temperature"
					class="min-h-11 rounded-md border border-line bg-surface-canvas pl-3 pr-8"
				>
					<option value="bean_temperature">bean temperature</option>
					<option value="environmental_temperature">environmental temperature</option>
				</select>
				<span>by</span>
				<input
					type="number"
					bind:value={degrees}
					aria-label="Degrees"
					step="0.5"
					min="0.5"
					max={maxDegrees}
					class="min-h-11 w-20 rounded-md border border-line bg-surface-canvas px-3"
				/>
				<span>°{temperatureUnit}, from</span>
				<input
					type="number"
					bind:value={startMinutes}
					aria-label="Start, minutes after charge"
					min="0"
					step="0.1"
					class="min-h-11 w-20 rounded-md border border-line bg-surface-canvas px-3"
				/>
				<span>to</span>
				<input
					type="number"
					bind:value={endMinutes}
					aria-label="End, minutes after charge"
					min="0.1"
					step="0.1"
					class="min-h-11 w-20 rounded-md border border-line bg-surface-canvas px-3"
				/>
				<span>minutes after charge.</span>
			</fieldset>
			<p class="mt-2 text-xs text-muted">Up to 20 °F (10 °C).</p>
		</section>

		<section
			bind:this={previewSection}
			class="mt-6 scroll-mt-20 border-t border-line pt-5"
			aria-labelledby="{uid}-preview"
		>
			<h2 id="{uid}-preview" class="font-semibold text-ink">3. Preview</h2>
			<button
				type="button"
				class="mt-3 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
				disabled={!start || busy !== null}
				onclick={previewPlan}>{busy === 'preview' ? 'Working…' : 'Preview'}</button
			>
			{#if previewError}
				<p role="alert" class="mt-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong">
					{previewError}
				</p>
			{/if}
			{#if preview && start && chartData}
				<div class="mt-4 rounded-xl bg-surface-canvas p-3 sm:p-4">
					<p class="text-xs font-semibold uppercase tracking-wide text-muted">
						Plan preview · not saved yet
					</p>
					<p class="mt-1 text-sm font-semibold text-ink">
						{describeAdjustment(
							preview.changes.temperatureAdjustments[0],
							preview.chart.temperatureUnit,
							chargeOffsetMilliseconds(preview.chart)
						)}
					</p>
					<p class="mt-1 text-sm text-muted">
						{start.option.label}. The dashed line is what you started from.
					</p>
					{#if !matchingPreview}
						<p role="status" class="mt-2 text-sm font-semibold text-ink">
							You changed the plan after this preview. Preview again before saving.
						</p>
					{/if}
					<div class="mt-4 h-[24rem] min-h-[20rem]">
						{#await loadRoastChart() then { default: RoastChart }}
							<RoastChart {chartData} />
						{:catch}
							<p class="text-sm text-muted">
								The preview chart could not load. Refresh to try again.
							</p>
						{/await}
					</div>
				</div>
			{/if}
		</section>

		<section class="mt-6 border-t border-line pt-5" aria-labelledby="{uid}-save">
			<h2 id="{uid}-save" class="font-semibold text-ink">4. Save and send to Artisan</h2>
			<label class="mt-3 block max-w-2xl text-sm font-medium text-ink"
				>Plan name
				<input
					bind:value={title}
					oninput={() => (titleEdited = true)}
					maxlength="200"
					disabled={!start}
					class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
				/>
			</label>
			<div class="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					class="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
					disabled={busy !== null || !matchingPreview || savedPlan !== null}
					onclick={savePlan}>{busy === 'save' ? 'Saving…' : 'Save plan'}</button
				>
				<button
					type="button"
					disabled
					class="rounded-md border border-ink px-4 py-2 text-sm font-semibold text-ink opacity-50"
					>Download for Artisan (.alog)</button
				>
			</div>
			{#if saveError}
				<p role="alert" class="mt-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong">
					{saveError}
				</p>
			{/if}
			{#if referenceKept}
				<p role="status" class="mt-3 text-sm text-muted">
					This roast is now kept as a saved reference. Saving the plan again will use it.
				</p>
			{/if}
			{#if savedPlan && busy === null}
				<p role="status" class="mt-3 rounded-lg bg-success-subtle p-3 text-sm text-success-strong">
					{savedPlan.title} is saved.
					<a href={planHref({ plan: savedPlan.id })} class="font-semibold underline"
						>Open the saved plan</a
					>
				</p>
			{/if}
		</section>
	{/if}
</div>
