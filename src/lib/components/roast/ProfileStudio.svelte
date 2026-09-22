<script lang="ts">
	import { onMount } from 'svelte';
	import type { components } from '@purveyors/sdk';
	import RoastChart from './chart/RoastChart.svelte';
	import {
		buildProfileComparisonChart,
		type ProfileComparison
	} from '$lib/roast/profile-comparison-model';
	import { trackProfileStudioActivation } from '$lib/profileStudio/analytics';
	import {
		clearIdempotencyKey,
		reserveIdempotencyKey,
		shouldRetainIdempotencyKey
	} from '$lib/idempotency';

	type RoastOption = {
		roast_id: number;
		batch_name?: string | null;
		coffee_name?: string | null;
		roast_date?: string | null;
		weight_loss_percent?: number | null;
		oz_in?: number | null;
		oz_out?: number | null;
	};
	type Selection = { kind: 'executed_roast' | 'reference_profile'; id: string; label: string };

	let {
		roasts,
		enabled,
		ownerId = null
	}: { roasts: RoastOption[]; enabled: boolean; ownerId?: string | null } = $props();
	type ReferenceProfileSummary = components['schemas']['ReferenceProfileSummary'];
	let profiles = $state<ReferenceProfileSummary[]>([]);
	let loading = $state(false);
	let saving = $state(false);
	let comparing = $state(false);
	let selectedFile = $state<File | null>(null);
	let referenceTitle = $state('Artisan reference');
	let selectedRoastId = $state('');
	let leftValue = $state('');
	let rightValue = $state('');
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let comparison = $state<ProfileComparison | null>(null);
	let comparisonLabels = $state<{ left: string; right: string } | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	const storage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
	const isExecutionEligible = (roast: RoastOption) =>
		(roast.weight_loss_percent ?? 0) > 0 || (roast.oz_out ?? 0) > 0;
	const executedRoasts = $derived(roasts.filter(isExecutionEligible));

	const options = $derived([
		...executedRoasts.map((roast) => ({
			value: `executed_roast:${roast.roast_id}`,
			label: `${roast.batch_name || roast.coffee_name || `Roast #${roast.roast_id}`} · executed roast`
		})),
		...profiles.map((profile) => ({
			value: `reference_profile:${profile.id}`,
			label: `${profile.title} · reference`
		}))
	]);

	const chartData = $derived(
		comparison && comparisonLabels
			? buildProfileComparisonChart(comparison, comparisonLabels.left, comparisonLabels.right)
			: null
	);
	const cherryHref = $derived.by(() => {
		if (!comparisonLabels) return '/chat';
		const left = parseSelection(leftValue);
		const right = parseSelection(rightValue);
		if (!left || !right) return '/chat';
		const prompt = `Discuss the measured differences between ${comparisonLabels.left} and ${comparisonLabels.right} and help me decide what to preserve or change.`;
		return `/chat?${new URLSearchParams({
			source: 'profile-studio',
			prompt,
			left_kind: left.kind,
			left_id: left.id,
			right_kind: right.kind,
			right_id: right.id
		}).toString()}`;
	});

	function parseSelection(value: string): Selection | null {
		const option = options.find((candidate) => candidate.value === value);
		if (!option) return null;
		const separator = value.indexOf(':');
		return {
			kind: value.slice(0, separator) as Selection['kind'],
			id: value.slice(separator + 1),
			label: option.label.replace(/ · (executed roast|reference)$/, '')
		};
	}

	async function loadProfiles() {
		if (!enabled) return;
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/reference-profiles');
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || 'Unable to load reference profiles');
			profiles = body.data ?? [];
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to load reference profiles';
		} finally {
			loading = false;
		}
	}

	async function uploadReference() {
		if (!selectedFile || saving) return;
		const title = referenceTitle.trim() || 'Artisan reference';
		const payloadFingerprint = [
			selectedFile.name,
			selectedFile.size,
			selectedFile.lastModified,
			title
		].join('|');
		const idempotencyKey = reserveIdempotencyKey(
			storage(),
			ownerId,
			'profile-studio-upload',
			payloadFingerprint
		);
		saving = true;
		error = null;
		notice = null;
		try {
			const form = new FormData();
			form.set('file', selectedFile);
			form.set('title', title);
			const response = await fetch('/api/reference-profiles', {
				method: 'POST',
				headers: { 'Idempotency-Key': idempotencyKey },
				body: form
			});
			const body = (await response.json().catch(() => null)) as {
				data?: { title?: string };
				error?: string;
			} | null;
			if (!response.ok) {
				if (!shouldRetainIdempotencyKey(response.status))
					clearIdempotencyKey(storage(), ownerId, 'profile-studio-upload', payloadFingerprint);
				throw new Error(body?.error || 'Unable to save this Artisan profile');
			}
			if (!body?.data?.title) throw new Error('Unable to save this Artisan profile');
			clearIdempotencyKey(storage(), ownerId, 'profile-studio-upload', payloadFingerprint);
			selectedFile = null;
			if (fileInput) fileInput.value = '';
			referenceTitle = 'Artisan reference';
			notice = `${body.data.title} is saved as a reference profile, separate from executed roast history.`;
			trackProfileStudioActivation('artisan_file_accepted');
			trackProfileStudioActivation('reference_profile_saved');
			await loadProfiles();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to save this Artisan profile';
		} finally {
			saving = false;
		}
	}

	async function saveRoastReference() {
		const roastId = Number(selectedRoastId);
		if (!Number.isSafeInteger(roastId) || roastId <= 0 || saving) return;
		const roast = executedRoasts.find((candidate) => candidate.roast_id === roastId);
		if (!roast) return;
		const title = `${roast.batch_name || roast.coffee_name || `Roast #${roastId}`} reference`;
		const payload = JSON.stringify({ source: 'executed_roast', roastId, title });
		const idempotencyKey = reserveIdempotencyKey(
			storage(),
			ownerId,
			'profile-studio-snapshot',
			payload
		);
		saving = true;
		error = null;
		notice = null;
		try {
			const response = await fetch('/api/reference-profiles', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Idempotency-Key': idempotencyKey
				},
				body: payload
			});
			const body = (await response.json().catch(() => null)) as {
				data?: { title?: string };
				error?: string;
			} | null;
			if (!response.ok) {
				if (!shouldRetainIdempotencyKey(response.status))
					clearIdempotencyKey(storage(), ownerId, 'profile-studio-snapshot', payload);
				throw new Error(body?.error || 'Unable to save this roast as a reference');
			}
			if (!body?.data?.title) throw new Error('Unable to save this roast as a reference');
			clearIdempotencyKey(storage(), ownerId, 'profile-studio-snapshot', payload);
			notice = `${body.data.title} is saved as an immutable reference snapshot.`;
			selectedRoastId = '';
			trackProfileStudioActivation('reference_profile_saved');
			await loadProfiles();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to save this roast as a reference';
		} finally {
			saving = false;
		}
	}

	async function compareProfiles() {
		const left = parseSelection(leftValue);
		const right = parseSelection(rightValue);
		if (!left || !right || leftValue === rightValue || comparing) return;
		comparing = true;
		error = null;
		comparison = null;
		try {
			const response = await fetch('/api/reference-profiles/compare', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ left, right, targetUnit: 'F' })
			});
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || 'Unable to compare these profiles');
			comparison = body.data;
			comparisonLabels = { left: left.label, right: right.label };
			trackProfileStudioActivation('profile_comparison_completed');
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to compare these profiles';
		} finally {
			comparing = false;
		}
	}

	onMount(() => void loadProfiles());
</script>

<section
	id="profile-studio"
	class="scroll-mt-24 rounded-2xl border border-line bg-surface-panel p-5 sm:p-6"
>
	<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
		<div class="max-w-2xl">
			<p class="text-sm font-semibold text-accent">Profile Studio</p>
			<h2 class="mt-1 font-serif text-2xl font-medium text-ink">
				Compare what happened with what you want to repeat.
			</h2>
			<p class="mt-2 text-sm leading-6 text-muted">
				Reference profiles are saved plans or comparison sources. They stay separate from executed
				roast history, production counts, and margin evidence.
			</p>
		</div>
		{#if !enabled}
			<a
				href="/subscription?plan=studio-monthly"
				class="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink"
				>Unlock Mallard Studio</a
			>
		{/if}
	</div>

	{#if enabled}
		<ol class="mt-5 grid gap-3 text-sm sm:grid-cols-3" aria-label="Profile Studio onboarding">
			<li class="rounded-xl bg-surface-canvas p-3">
				<strong class="text-ink">1. Save a reference</strong><span class="mt-1 block text-muted"
					>Drop in an Artisan file or snapshot a successful roast.</span
				>
			</li>
			<li class="rounded-xl bg-surface-canvas p-3">
				<strong class="text-ink">2. Compare profiles</strong><span class="mt-1 block text-muted"
					>Review charge-aligned curves and milestone timing.</span
				>
			</li>
			<li class="rounded-xl bg-surface-canvas p-3">
				<strong class="text-ink">3. Ask Cherry</strong><span class="mt-1 block text-muted"
					>Discuss measured differences and the goal for the next batch.</span
				>
			</li>
		</ol>

		{#if error}<p
				role="alert"
				class="mt-4 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
			>
				{error}
			</p>{/if}
		{#if notice}<p
				role="status"
				class="mt-4 rounded-lg bg-success-subtle p-3 text-sm text-success-strong"
			>
				{notice}
			</p>{/if}

		<div class="mt-5 grid gap-4 lg:grid-cols-2">
			<div class="rounded-xl border border-line p-4">
				<h3 class="font-semibold text-ink">Upload an Artisan reference</h3>
				<p class="mt-1 text-sm text-muted">
					Accepted files are validated by Parchment. The raw file never enters Cherry messages or
					model context.
				</p>
				<label class="mt-3 block text-sm font-medium text-ink"
					>Reference name<input
						bind:value={referenceTitle}
						maxlength="120"
						class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
					/></label
				>
				<input
					type="file"
					bind:this={fileInput}
					accept=".alog,.alog.json,.json"
					class="mt-3 block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-ink"
					onchange={(event) =>
						(selectedFile = (event.currentTarget as HTMLInputElement).files?.[0] ?? null)}
				/>
				<button
					type="button"
					class="mt-3 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
					disabled={!selectedFile || saving}
					onclick={uploadReference}>{saving ? 'Saving…' : 'Save reference'}</button
				>
			</div>
			<div class="rounded-xl border border-line p-4">
				<h3 class="font-semibold text-ink">Save a historical roast</h3>
				<p class="mt-1 text-sm text-muted">
					Creates an immutable reference snapshot without changing the executed roast.
				</p>
				<select
					bind:value={selectedRoastId}
					class="mt-3 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 text-sm text-ink"
				>
					<option value="">Choose an executed roast</option>
					{#each executedRoasts as roast (roast.roast_id)}<option value={String(roast.roast_id)}
							>{roast.batch_name || roast.coffee_name || `Roast #${roast.roast_id}`}</option
						>{/each}
				</select>
				<button
					type="button"
					class="mt-3 rounded-md border border-ink px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
					disabled={!selectedRoastId || saving}
					onclick={saveRoastReference}>{saving ? 'Saving…' : 'Save snapshot'}</button
				>
			</div>
		</div>

		<div class="mt-5 rounded-xl border border-line p-4">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h3 class="font-semibold text-ink">Compare profiles</h3>
					<p class="mt-1 text-sm text-muted">
						Executed and reference series remain clearly labeled.
					</p>
				</div>
				<span class="text-xs text-muted"
					>{loading ? 'Loading references…' : `${profiles.length} saved references`}</span
				>
			</div>
			<div class="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
				<label class="text-sm font-medium text-ink"
					>First profile<select
						bind:value={leftValue}
						class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
						><option value="">Choose a profile</option
						>{#each options as option (option.value)}<option value={option.value}
								>{option.label}</option
							>{/each}</select
					></label
				>
				<label class="text-sm font-medium text-ink"
					>Comparison profile<select
						bind:value={rightValue}
						class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
						><option value="">Choose a profile</option
						>{#each options as option (option.value)}<option value={option.value}
								>{option.label}</option
							>{/each}</select
					></label
				>
				<button
					type="button"
					class="min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-ink disabled:opacity-50 md:self-end"
					disabled={!leftValue || !rightValue || leftValue === rightValue || comparing}
					onclick={compareProfiles}>{comparing ? 'Comparing…' : 'Compare'}</button
				>
			</div>
		</div>

		{#if comparison && comparisonLabels && chartData}
			<div class="mt-5 rounded-xl border border-line bg-surface-canvas p-4">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">
							Measured comparison
						</p>
						<h3 class="mt-1 font-semibold text-ink">
							{comparisonLabels.left} vs. {comparisonLabels.right}
						</h3>
						<p class="mt-1 text-sm text-muted">
							Charge-aligned in °{comparison.targetUnit}. Solid lines are the first profile; dashed
							lines are the comparison.
						</p>
					</div>
					<a href={cherryHref} class="text-sm font-semibold text-link hover:text-accent"
						>Discuss with Cherry →</a
					>
				</div>
				<div class="mt-4 h-[24rem] min-h-[20rem]"><RoastChart {chartData} /></div>
				{#if comparison.milestones.length > 0}<div class="mt-4 flex flex-wrap gap-2">
						{#each comparison.milestones as milestone (milestone.name)}<span
								class="rounded-full border border-line px-3 py-1 text-xs text-muted"
								>{milestone.name}: {milestone.deltaMilliseconds > 0 ? '+' : ''}{(
									milestone.deltaMilliseconds / 1000
								).toFixed(1)}s</span
							>{/each}
					</div>{/if}
			</div>
		{/if}
	{:else}
		<div class="mt-5 rounded-xl bg-surface-canvas p-4 text-sm text-muted">
			Mallard Studio includes Artisan reference uploads, immutable roast snapshots, profile
			comparison, and Cherry guidance. Parchment Intelligence alone does not unlock private roast
			files.
		</div>
	{/if}
</section>
