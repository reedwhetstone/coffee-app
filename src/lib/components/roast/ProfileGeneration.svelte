<script lang="ts">
	import type { components } from '@purveyors/sdk';
	import { buildProfileGenerationChart } from '$lib/roast/profile-generation-model';
	import {
		clearIdempotencyKey,
		reserveIdempotencyKey,
		shouldRetainIdempotencyKey
	} from '$lib/idempotency';

	type Summary = components['schemas']['ReferenceProfileSummary'];
	type Request = components['schemas']['ReferenceProfileGenerationRequest'];
	type Chart = components['schemas']['ReferenceProfileChart'];
	type Preview = components['schemas']['ReferenceProfileGenerationPreviewResponse']['data'];
	let {
		profiles,
		ownerId,
		onSaved
	}: {
		profiles: Summary[];
		ownerId: string | null;
		onSaved: () => Promise<void>;
	} = $props();

	let selectedId = $state('');
	let title = $state('Next-batch plan');
	let kind = $state<'bean_temperature' | 'environmental_temperature'>('bean_temperature');
	let startMinutes = $state('0');
	let endMinutes = $state('5');
	let delta = $state('5');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let preview = $state<Preview | null>(null);
	let parentChart = $state<Chart | null>(null);
	let previewFingerprint = $state<string | null>(null);
	let saved = $state<{ id: string; revisionId: string; title: string } | null>(null);
	const selected = $derived(profiles.find((profile) => profile.id === selectedId));
	const exportable = $derived(
		profiles.filter(
			(profile) =>
				profile.sourceClass === 'artisan_upload' || profile.sourceClass === 'generated_revision'
		)
	);
	const chartData = $derived(
		parentChart && preview ? buildProfileGenerationChart(parentChart, preview.chart) : null
	);
	const loadRoastChart = () => import('./chart/RoastChart.svelte');

	function request(): Request | null {
		const start = Number(startMinutes);
		const end = Number(endMinutes);
		const adjustment = Number(delta);
		if (
			!selected ||
			!title.trim() ||
			!Number.isFinite(start) ||
			!Number.isFinite(end) ||
			!Number.isFinite(adjustment) ||
			start < 0 ||
			end <= start ||
			adjustment === 0 ||
			Math.abs(adjustment) > (parentChart?.temperatureUnit === 'C' ? 10 : 20)
		)
			return null;
		return {
			title: title.trim(),
			changes: {
				temperatureAdjustments: [
					{
						kind,
						startMilliseconds: Math.round(start * 60_000),
						endMilliseconds: Math.round(end * 60_000),
						delta: adjustment
					}
				]
			}
		};
	}
	const matchingPreview = $derived.by(() => {
		const input = request();
		return (
			!!selected &&
			!!input &&
			previewFingerprint ===
				JSON.stringify({ id: selected.id, revisionId: selected.currentRevisionId, input })
		);
	});

	function clearPreview() {
		preview = null;
		parentChart = null;
		previewFingerprint = null;
		saved = null;
		notice = null;
		error = null;
	}

	async function previewPlan() {
		const input = request();
		if (!input || !selected || busy) {
			error = 'Choose a reference and a non-zero change within the supported bounds.';
			return;
		}
		busy = true;
		error = null;
		notice = null;
		preview = null;
		const base = `/api/reference-profiles/${encodeURIComponent(selected.id)}/revisions/${encodeURIComponent(selected.currentRevisionId)}`;
		try {
			const [chartResponse, previewResponse] = await Promise.all([
				fetch(`${base}/chart`),
				fetch(`${base}/preview`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(input)
				})
			]);
			const [chartBody, previewBody] = await Promise.all([
				chartResponse.json(),
				previewResponse.json()
			]);
			if (!chartResponse.ok) throw new Error(chartBody.error || 'Unable to load the parent chart');
			if (!previewResponse.ok) throw new Error(previewBody.error || 'Unable to preview this plan');
			parentChart = chartBody.data.chart;
			preview = previewBody.data;
			previewFingerprint = JSON.stringify({
				id: selected.id,
				revisionId: selected.currentRevisionId,
				input
			});
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to preview this plan';
		} finally {
			busy = false;
		}
	}

	async function savePlan() {
		const input = request();
		if (!input || !selected || !preview || busy) return;
		const fingerprint = JSON.stringify({
			id: selected.id,
			revisionId: selected.currentRevisionId,
			input
		});
		if (
			fingerprint !== previewFingerprint ||
			preview.parentRevisionId !== selected.currentRevisionId
		) {
			error = 'The plan changed after preview. Preview it again before saving.';
			return;
		}
		const key = reserveIdempotencyKey(
			typeof sessionStorage === 'undefined' ? null : sessionStorage,
			ownerId,
			'profile-studio-generation',
			fingerprint
		);
		busy = true;
		error = null;
		try {
			const response = await fetch(
				`/api/reference-profiles/${encodeURIComponent(selected.id)}/revisions/${encodeURIComponent(selected.currentRevisionId)}/generated`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
					body: JSON.stringify(input)
				}
			);
			const body = await response.json().catch(() => null);
			if (!response.ok) {
				if (!shouldRetainIdempotencyKey(response.status))
					clearIdempotencyKey(sessionStorage, ownerId, 'profile-studio-generation', fingerprint);
				throw new Error(body?.error || 'Unable to save this plan');
			}
			const profile = body?.data;
			if (!profile?.id || !profile?.currentRevisionId)
				throw new Error('Unable to confirm the saved plan');
			clearIdempotencyKey(sessionStorage, ownerId, 'profile-studio-generation', fingerprint);
			saved = { id: profile.id, revisionId: profile.currentRevisionId, title: profile.title };
			notice = `${profile.title} is saved as a plan, separate from executed roast history.`;
			await onSaved();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to save this plan';
		} finally {
			busy = false;
		}
	}
</script>

<div class="mt-5 rounded-xl border border-line p-4">
	<h3 class="font-semibold text-ink">Plan the next batch</h3>
	<p class="mt-1 text-sm text-muted">
		Start from an uploaded Artisan reference, preview one bounded temperature change, then save an
		unsigned Purveyors plan. It does not change the parent or record an executed roast.
	</p>
	{#if profiles.some((profile) => profile.sourceClass === 'executed_roast')}
		<p class="mt-2 text-xs text-muted">
			Historical roast snapshots can be compared, but cannot be exported as Artisan plans because
			they do not retain the original device and event mapping.
		</p>
	{/if}
	{#if error}<p
			role="alert"
			class="mt-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
		>
			{error}
		</p>{/if}
	{#if notice}<p
			role="status"
			class="mt-3 rounded-lg bg-success-subtle p-3 text-sm text-success-strong"
		>
			{notice}
		</p>{/if}
	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		<label class="text-sm font-medium text-ink"
			>Parent reference
			<select
				bind:value={selectedId}
				onchange={clearPreview}
				class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
			>
				<option value="">Choose an Artisan reference</option>
				{#each exportable as profile (profile.id)}
					<option value={profile.id}>{profile.title}</option>
				{/each}
			</select>
		</label>
		<label class="text-sm font-medium text-ink"
			>Plan name
			<input
				bind:value={title}
				maxlength="200"
				class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
			/>
		</label>
		<label class="text-sm font-medium text-ink"
			>Temperature channel
			<select
				bind:value={kind}
				class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
			>
				<option value="bean_temperature">Bean temperature</option>
				<option value="environmental_temperature">Environmental temperature</option>
			</select>
		</label>
		<label class="text-sm font-medium text-ink"
			>Change (degrees, + or −)
			<input
				type="number"
				bind:value={delta}
				step="0.5"
				min="-20"
				max="20"
				class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
			/>
		</label>
		<label class="text-sm font-medium text-ink"
			>Start (minutes from roast start)
			<input
				type="number"
				bind:value={startMinutes}
				min="0"
				step="0.1"
				class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
			/>
		</label>
		<label class="text-sm font-medium text-ink"
			>End (minutes from roast start)
			<input
				type="number"
				bind:value={endMinutes}
				min="0.1"
				step="0.1"
				class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
			/>
		</label>
	</div>
	<div class="mt-4 flex flex-wrap gap-3">
		<button
			type="button"
			class="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
			disabled={!selected || busy}
			onclick={previewPlan}>{busy ? 'Working…' : 'Preview changes'}</button
		>
		{#if preview}
			<button
				type="button"
				class="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink"
				disabled={busy || !!saved || !matchingPreview}
				onclick={savePlan}>Save planned reference</button
			>
		{/if}
		{#if saved}
			<a
				class="rounded-md border border-ink px-4 py-2 text-sm font-semibold text-ink"
				href={`/api/reference-profiles/${encodeURIComponent(saved.id)}/revisions/${encodeURIComponent(saved.revisionId)}/export`}
				>Download Purveyors .alog plan</a
			>
		{/if}
	</div>
	{#if preview && parentChart && chartData}
		<div class="mt-5 rounded-xl bg-surface-canvas p-4">
			<p class="text-xs font-semibold uppercase tracking-wide text-muted">
				Preview only · not saved
			</p>
			{#if !matchingPreview}<p class="mt-1 text-sm font-semibold text-ink">
					Inputs changed. Preview again before saving.
				</p>{/if}
			<p class="mt-1 text-sm text-muted">
				{preview.changes.temperatureAdjustments[0].kind === 'bean_temperature'
					? 'Bean'
					: 'Environmental'} temperature:
				{preview.changes.temperatureAdjustments[0].delta > 0 ? '+' : ''}{preview.changes
					.temperatureAdjustments[0].delta}°{parentChart.temperatureUnit} from {preview.changes
					.temperatureAdjustments[0].startMilliseconds / 60_000} to {preview.changes
					.temperatureAdjustments[0].endMilliseconds / 60_000} minutes. Dashed curves are the immutable
				parent. {preview.chart.events.length} source events remain unchanged.
			</p>
			<div class="mt-4 h-[24rem] min-h-[20rem]">
				{#await loadRoastChart() then { default: RoastChart }}
					<RoastChart {chartData} />
				{:catch}
					<p class="text-sm text-muted">The preview chart could not load. Refresh to try again.</p>
				{/await}
			</div>
		</div>
	{/if}
	{#if profiles.some((profile) => profile.sourceClass === 'generated_revision')}
		<div class="mt-5">
			<h4 class="text-sm font-semibold text-ink">Saved plans</h4>
			<ul class="mt-2 space-y-2 text-sm">
				{#each profiles.filter((profile) => profile.sourceClass === 'generated_revision') as profile (profile.id)}
					<li class="flex flex-wrap items-center justify-between gap-2">
						<span>{profile.title} · planned reference</span>
						<a
							class="font-semibold text-link hover:text-accent"
							href={`/api/reference-profiles/${encodeURIComponent(profile.id)}/revisions/${encodeURIComponent(profile.currentRevisionId)}/export`}
							>Download .alog</a
						>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
