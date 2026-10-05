<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import type { components } from '@purveyors/sdk';
	import {
		buildProfileGenerationChart,
		chargeOffsetMilliseconds
	} from '$lib/roast/profile-generation-model';
	import { planHref, savedPlanHref, type PlanLink } from '$lib/roast/plan-link';
	import {
		clearIdempotencyKey,
		reserveIdempotencyKey,
		shouldRetainIdempotencyKey
	} from '$lib/idempotency';

	type Summary = components['schemas']['ReferenceProfileSummary'];
	type Candidate =
		components['schemas']['ReferenceProfileRoastCandidatesResponse']['data']['roasts'][number];
	type Candidates = components['schemas']['ReferenceProfileRoastCandidatesResponse']['data'];
	type Chart = components['schemas']['ReferenceProfileChart'];
	type Request = components['schemas']['ReferenceProfileGenerationRequest'];
	type Preview =
		| components['schemas']['ReferenceProfileGenerationPreviewResponse']['data']
		| components['schemas']['ReferenceProfileRoastGenerationPreviewResponse']['data'];
	type Target = { id: string; revisionId: string };
	let { link, ownerId }: { link: PlanLink; ownerId: string | null } = $props();

	let profiles = $state<Summary[]>([]);
	let candidates = $state<Candidates | null>(null);
	let fallbackCandidate = $state<Candidate | null>(null);
	let savedLoadingId = $state('');
	let loading = $state(true);
	let selectedValue = $state('');
	let title = $state('Next-batch plan');
	let kind = $state<'bean_temperature' | 'environmental_temperature'>('bean_temperature');
	let direction = $state<'raise' | 'lower'>('raise');
	let delta = $state('5');
	let startMinutes = $state('0');
	let endMinutes = $state('5');
	let parentChart = $state<Chart | null>(null);
	let parentFor = $state('');
	let preview = $state<Preview | null>(null);
	let previewFingerprint = $state('');
	let saved = $state<{ id: string; revisionId: string; title: string } | null>(null);
	let roastReference = $state<Target | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let nextStep = $state<string | null>(null);
	let loadError = $state(false);

	const refOptions = $derived(
		profiles.filter(
			(profile) =>
				profile.sourceClass === 'artisan_upload' || profile.sourceClass === 'generated_revision'
		)
	);
	const sortedCandidates = $derived(
		[...(candidates?.roasts ?? [])].sort(
			(a, b) => (b.roastDate ?? '').localeCompare(a.roastDate ?? '') || b.roastId - a.roastId
		)
	);
	const source = $derived.by(() => {
		if (selectedValue.startsWith('roast:')) {
			const id = Number(selectedValue.slice(6));
			return (
				sortedCandidates.find((candidate) => candidate.roastId === id) ??
				(fallbackCandidate?.roastId === id ? fallbackCandidate : null)
			);
		}
		return null;
	});
	const reference = $derived(refOptions.find((profile) => selectedValue === `ref:${profile.id}`));
	const chartData = $derived(
		parentChart && preview ? buildProfileGenerationChart(parentChart, preview.chart) : null
	);
	const matchingPreview = $derived(!!preview && previewFingerprint === fingerprint());
	const loadRoastChart = () => import('./chart/RoastChart.svelte');

	function requestedValue(): string {
		if (link.kind === 'from') return `${link.side.type}:${link.side.id}`;
		return '';
	}

	function unavailableReason(reason: string | null): string {
		if (reason === 'artisan_file_not_retained')
			return "This roast was imported before Artisan files were kept. Import the roast's .alog again to plan from it.";
		if (reason === 'artisan_file_too_large')
			return "This roast's Artisan file is too large to use for a plan. Add a smaller Artisan file under Saved references and plans.";
		return 'This roast has no Artisan file on record, so a plan cannot be built from it. Import its .alog to plan from it.';
	}

	async function loadSources() {
		loading = true;
		loadError = false;
		try {
			const [referencesResponse, candidatesResponse] = await Promise.all([
				fetch('/api/reference-profiles'),
				fetch('/api/reference-profiles/from-roast/candidates')
			]);
			const referencesBody: components['schemas']['ReferenceProfileListResponse'] =
				await referencesResponse.json();
			const candidatesBody: components['schemas']['ReferenceProfileRoastCandidatesResponse'] =
				await candidatesResponse.json();
			if (!referencesResponse.ok || !candidatesResponse.ok)
				throw new Error('Unable to load planning sources');
			profiles = referencesBody.data;
			candidates = candidatesBody.data;
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	function resetPlan() {
		preview = null;
		previewFingerprint = '';
		saved = null;
		roastReference = null;
		parentChart = null;
		parentFor = '';
		fallbackCandidate = null;
		error = null;
		nextStep = null;
	}

	function choose(value: string) {
		selectedValue = value;
		resetPlan();
		const match = value.match(/^(roast|ref):(.+)$/);
		if (match) {
			const side =
				match[1] === 'roast'
					? { type: 'roast' as const, id: Number(match[2]) }
					: { type: 'ref' as const, id: match[2] };
			void goto(planHref(side));
			void loadParent(value);
		} else void goto(planHref());
	}

	async function loadParent(value: string): Promise<Chart | null> {
		if (parentFor === value && parentChart) return parentChart;
		const route = value.startsWith('roast:')
			? `/api/reference-profiles/from-roast/chart/${encodeURIComponent(value.slice(6))}`
			: reference
				? `/api/reference-profiles/${encodeURIComponent(reference.id)}/revisions/${encodeURIComponent(reference.currentRevisionId)}/chart`
				: null;
		if (!route) return null;
		try {
			const response = await fetch(route);
			const body: { data: { chart: Chart; revision?: string | null } } = await response.json();
			if (!response.ok || !body.data?.chart) throw new Error('Unable to load this curve');
			if (selectedValue !== value) return null;
			parentChart = body.data.chart;
			if (
				value.startsWith('roast:') &&
				!sortedCandidates.some((candidate) => candidate.roastId === Number(value.slice(6))) &&
				body.data.revision
			) {
				const id = Number(value.slice(6));
				fallbackCandidate = {
					roastId: id,
					roastRevision: body.data.revision,
					label: `Roast #${id}`,
					batchName: null,
					coffeeName: null,
					roastDate: null,
					reference: { profileId: '', revisionId: '', saved: false }
				};
			}
			parentFor = value;
			return body.data.chart;
		} catch {
			if (selectedValue === value) error = 'Unable to load this curve. Try again.';
			return null;
		}
	}

	function request(chart: Chart | null): Request | null {
		const start = Number(startMinutes);
		const end = Number(endMinutes);
		const amount = Number(delta);
		if (
			!chart ||
			!title.trim() ||
			!Number.isFinite(start) ||
			!Number.isFinite(end) ||
			!Number.isFinite(amount) ||
			start < 0 ||
			end <= start ||
			amount <= 0 ||
			amount > (chart.temperatureUnit === 'C' ? 10 : 20)
		)
			return null;
		const offset = chargeOffsetMilliseconds(chart);
		return {
			title: title.trim(),
			changes: {
				temperatureAdjustments: [
					{
						kind,
						startMilliseconds: Math.round(start * 60_000) + offset,
						endMilliseconds: Math.round(end * 60_000) + offset,
						delta: direction === 'raise' ? amount : -amount
					}
				]
			}
		};
	}

	function fingerprint(): string {
		return JSON.stringify({ source: selectedValue, input: request(parentChart) });
	}

	async function previewPlan() {
		if (busy || !selectedValue) return;
		busy = true;
		error = null;
		nextStep = null;
		preview = null;
		try {
			const chart = await loadParent(selectedValue);
			const input = request(chart);
			if (!input) {
				error =
					'Choose a plan name, an end after the start, and a change within the allowed range.';
				return;
			}
			const endpoint = source
				? '/api/reference-profiles/from-roast/preview'
				: reference
					? `/api/reference-profiles/${encodeURIComponent(reference.id)}/revisions/${encodeURIComponent(reference.currentRevisionId)}/preview`
					: null;
			if (!endpoint) {
				error = 'Choose a roast or saved reference';
				return;
			}
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					source
						? { ...input, roastId: source.roastId, roastRevision: source.roastRevision }
						: input
				)
			});
			const body: { data?: Preview; code?: string; reason?: string | null; error?: string } =
				await response.json();
			if (selectedValue !== (source ? `roast:${source.roastId}` : `ref:${reference?.id}`)) return;
			if (!response.ok || !body.data) {
				if (body.code === 'roast_artisan_source_unavailable') {
					nextStep = unavailableReason(body.reason ?? null);
					return;
				}
				throw new Error(body.error || 'Unable to preview this plan');
			}
			preview = body.data;
			previewFingerprint = fingerprint();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to preview this plan';
		} finally {
			busy = false;
		}
	}

	async function savePlan() {
		const input = request(parentChart);
		if (!input || !preview || !matchingPreview || busy) return;
		const planFingerprint = fingerprint();
		busy = true;
		error = null;
		nextStep = null;
		try {
			let target: Target;
			if (source) {
				if (!roastReference) {
					const key = reserveIdempotencyKey(
						sessionStorage,
						ownerId,
						'roast-plan-reference',
						`${source.roastId}:${source.roastRevision}`
					);
					const response = await fetch('/api/reference-profiles/from-roast', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
						body: JSON.stringify({ roastId: source.roastId, roastRevision: source.roastRevision })
					});
					const body: { data?: Summary; code?: string; reason?: string | null; error?: string } =
						await response.json();
					if (!response.ok || !body.data) {
						if (!shouldRetainIdempotencyKey(response.status))
							clearIdempotencyKey(
								sessionStorage,
								ownerId,
								'roast-plan-reference',
								`${source.roastId}:${source.roastRevision}`
							);
						if (body.code === 'roast_artisan_source_unavailable') {
							nextStep = unavailableReason(body.reason ?? null);
							return;
						}
						throw new Error(body.error || 'Unable to save the roast as a reference');
					}
					roastReference = { id: body.data.id, revisionId: body.data.currentRevisionId };
					clearIdempotencyKey(
						sessionStorage,
						ownerId,
						'roast-plan-reference',
						`${source.roastId}:${source.roastRevision}`
					);
				}
				target = roastReference;
			} else if (reference) {
				target = { id: reference.id, revisionId: reference.currentRevisionId };
			} else return;
			if (preview.parentRevisionId !== target.revisionId) {
				error = 'The source changed after preview. Preview it again before saving.';
				return;
			}
			const key = reserveIdempotencyKey(
				sessionStorage,
				ownerId,
				'roast-plan-generation',
				planFingerprint
			);
			const response = await fetch(
				`/api/reference-profiles/${encodeURIComponent(target.id)}/revisions/${encodeURIComponent(target.revisionId)}/generated`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
					body: JSON.stringify(input)
				}
			);
			const body: { data?: Summary; error?: string } = await response.json();
			if (!response.ok || !body.data) {
				if (!shouldRetainIdempotencyKey(response.status))
					clearIdempotencyKey(sessionStorage, ownerId, 'roast-plan-generation', planFingerprint);
				throw new Error(body.error || 'Unable to save this plan');
			}
			clearIdempotencyKey(sessionStorage, ownerId, 'roast-plan-generation', planFingerprint);
			saved = { id: body.data.id, revisionId: body.data.currentRevisionId, title: body.data.title };
			void goto(savedPlanHref(body.data.id), { replaceState: true });
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to save this plan';
		} finally {
			busy = false;
		}
	}

	async function loadSaved(id: string) {
		try {
			savedLoadingId = id;
			const response = await fetch(`/api/reference-profiles/${encodeURIComponent(id)}`);
			const body: components['schemas']['ReferenceProfileResponse'] = await response.json();
			if (!response.ok || body.data.sourceClass !== 'generated_revision')
				throw new Error('Unable to open this plan');
			saved = { id: body.data.id, revisionId: body.data.currentRevisionId, title: body.data.title };
		} catch {
			error = 'Unable to open this plan';
		}
	}

	$effect(() => {
		if (link.kind === 'plan') {
			if (saved?.id !== link.id && savedLoadingId !== link.id) void loadSaved(link.id);
		} else {
			const value = requestedValue();
			if (selectedValue !== value) {
				selectedValue = value;
				resetPlan();
				if (value) void loadParent(value);
			}
		}
	});
	onMount(() => {
		void loadSources();
	});
</script>

<div class="rounded-lg border border-line bg-surface-panel p-4 sm:p-6">
	{#if loadError}<p
			role="alert"
			class="mb-4 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
		>
			Planning sources could not be loaded. <button
				type="button"
				class="font-semibold underline"
				onclick={loadSources}>Try again</button
			>
		</p>{/if}
	{#if error}<p
			role="alert"
			class="mb-4 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
		>
			{error}
		</p>{/if}
	{#if nextStep}<p role="status" class="mb-4 rounded-lg bg-info-subtle p-3 text-sm text-ink">
			{nextStep}
		</p>{/if}
	<section aria-labelledby="plan-start">
		<h2 id="plan-start" class="text-lg font-semibold text-ink">1. Start from</h2>
		{#if saved}<p class="mt-2 text-sm text-ink">{saved.title} · Plan</p>{:else}
			<select
				aria-label="Start from"
				value={selectedValue}
				disabled={loading || busy}
				onchange={(event) => choose(event.currentTarget.value)}
				class="mt-3 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 text-sm text-ink"
			>
				<option value="">Choose a roast or saved reference</option>
				<optgroup label="Roasts">
					{#each sortedCandidates as candidate (candidate.roastId)}<option
							value={`roast:${candidate.roastId}`}>{candidate.label}</option
						>{/each}
				</optgroup>
				<optgroup label="Saved references and plans">
					{#each refOptions as profile (profile.id)}<option value={`ref:${profile.id}`}
							>{profile.title}</option
						>{/each}
				</optgroup>
			</select>
			{#if candidates && candidates.ineligibleRoastCount > 0}<p class="mt-2 text-sm text-muted">
					{candidates.ineligibleRoastCount} older roasts were imported before Artisan files were kept.
					Import the roast's .alog again to plan from it.
				</p>{/if}
			{#if !loading && sortedCandidates.length === 0 && refOptions.length === 0}<p
					class="mt-2 text-sm text-muted"
				>
					A plan starts from a roast or reference that still has its Artisan file. Import a roast
					from Artisan, or add an Artisan file under Saved references and plans.
				</p>{/if}
		{/if}
	</section>
	<section aria-labelledby="plan-change" class="mt-6 border-t border-line pt-5">
		<h2 id="plan-change" class="text-lg font-semibold text-ink">2. What to change</h2>
		<p class="mt-1 text-sm text-muted">
			Raise or lower bean or environmental temperature by a number of degrees between two times
			after charge.
		</p>
		<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
			<label class="text-sm font-medium text-ink"
				>Plan name<input
					bind:value={title}
					disabled={!!saved}
					maxlength="200"
					class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
				/></label
			>
			<label class="text-sm font-medium text-ink"
				>Change<select
					bind:value={direction}
					disabled={!!saved}
					class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
					><option value="raise">Raise</option><option value="lower">Lower</option></select
				></label
			>
			<label class="text-sm font-medium text-ink"
				>Temperature<select
					bind:value={kind}
					disabled={!!saved}
					class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
					><option value="bean_temperature">Bean temperature</option><option
						value="environmental_temperature">Environmental temperature</option
					></select
				></label
			>
			<label class="text-sm font-medium text-ink"
				>Degrees<input
					type="number"
					min="0.5"
					max={parentChart?.temperatureUnit === 'C' ? 10 : 20}
					step="0.5"
					bind:value={delta}
					disabled={!!saved}
					class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
				/></label
			>
			<div class="grid grid-cols-2 gap-2">
				<label class="text-sm font-medium text-ink"
					>From (min)<input
						type="number"
						min="0"
						step="0.1"
						bind:value={startMinutes}
						disabled={!!saved}
						class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
					/></label
				><label class="text-sm font-medium text-ink"
					>To (min)<input
						type="number"
						min="0.1"
						step="0.1"
						bind:value={endMinutes}
						disabled={!!saved}
						class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
					/></label
				>
			</div>
		</div>
		<p class="mt-2 text-xs text-muted">Up to 20 °F (10 °C).</p>
	</section>
	<section aria-labelledby="plan-preview" class="mt-6 border-t border-line pt-5">
		<h2 id="plan-preview" class="text-lg font-semibold text-ink">3. Preview</h2>
		{#if !saved}<button
				type="button"
				disabled={!selectedValue || busy || loading}
				onclick={previewPlan}
				class="mt-3 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
				>{busy ? 'Working…' : 'Preview'}</button
			>{/if}
		{#if preview}{#if !saved}<p class="mt-3 text-sm text-muted">
					Plan preview · not saved yet. The dashed line is what you started from.
				</p>{/if}
			{#if !matchingPreview}<p class="mt-1 text-sm font-semibold text-ink">
					Inputs changed. Preview again before saving.
				</p>{/if}
			{#if chartData}<div class="mt-4 h-[24rem] min-h-[20rem]">
					{#await loadRoastChart() then { default: RoastChart }}<RoastChart {chartData} />{:catch}<p
							class="text-sm text-muted"
						>
							The preview chart could not load. Refresh to try again.
						</p>{/await}
				</div>{/if}
		{/if}
	</section>
	<section aria-labelledby="plan-send" class="mt-6 border-t border-line pt-5">
		<h2 id="plan-send" class="text-lg font-semibold text-ink">4. Save and send to Artisan</h2>
		{#if !saved}<button
				type="button"
				disabled={!matchingPreview || busy}
				onclick={savePlan}
				class="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
				>Save plan</button
			>{:else}
			<a
				href={`/api/reference-profiles/${encodeURIComponent(saved.id)}/revisions/${encodeURIComponent(saved.revisionId)}/export`}
				data-sveltekit-reload
				class="mt-3 inline-flex min-h-11 items-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink"
				>Download for Artisan (.alog)</a
			>
			<p class="mt-3 text-sm text-muted">
				In Artisan, open Roast, then Background, and load this file. The plan appears behind your
				live curve as a guide. It does not control your roaster.
			</p>
		{/if}
	</section>
</div>
