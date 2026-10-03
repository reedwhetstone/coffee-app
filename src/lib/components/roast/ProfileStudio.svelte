<script lang="ts">
	import { onMount } from 'svelte';
	import type { components } from '@purveyors/sdk';
	import {
		COMPARISON_SIDES,
		buildProfileComparisonChart,
		describeMilestoneTimings,
		type ProfileComparison
	} from '$lib/roast/profile-comparison-model';
	import {
		buildProfileOptionGroups,
		findProfileOption,
		recordedRoasts,
		roastOption,
		type PickerRoast,
		type ProfileOption
	} from '$lib/roast/profile-picker-model';
	import { trackProfileStudioActivation } from '$lib/profileStudio/analytics';
	import ProfileGeneration from './ProfileGeneration.svelte';
	import ProfilePicker from './ProfilePicker.svelte';
	import {
		clearIdempotencyKey,
		reserveIdempotencyKey,
		shouldRetainIdempotencyKey
	} from '$lib/idempotency';

	type Selection = ProfileOption;

	let {
		roasts,
		enabled,
		ownerId = null
	}: { roasts: PickerRoast[]; enabled: boolean; ownerId?: string | null } = $props();
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
	let compareError = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let comparison = $state<ProfileComparison | null>(null);
	let comparisonSelections = $state<{ left: Selection; right: Selection } | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	const storage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
	// Every roast with something recorded, most recent first.
	const executedRoasts = $derived(recordedRoasts(roasts));
	const unrecordedRoastCount = $derived(roasts.length - executedRoasts.length);
	const optionGroups = $derived(buildProfileOptionGroups(roasts, profiles));

	// The roast page defers the LayerCake/D3 chart bundle; load it only once a
	// comparison is ready to draw.
	const loadRoastChart = () => import('./chart/RoastChart.svelte');

	const chartData = $derived(comparison ? buildProfileComparisonChart(comparison) : null);
	const milestoneTimings = $derived(comparison ? describeMilestoneTimings(comparison) : []);
	const comparedProfiles = $derived(
		comparisonSelections
			? [
					{ tag: COMPARISON_SIDES.left, lines: 'Solid lines', ...comparisonSelections.left },
					{ tag: COMPARISON_SIDES.right, lines: 'Dashed lines', ...comparisonSelections.right }
				]
			: []
	);
	const cherryHref = $derived.by(() => {
		if (!comparisonSelections) return '/chat';
		const prompt = `Discuss the measured differences between ${comparisonSelections.left.spoken} and ${comparisonSelections.right.spoken}, and help me decide what to preserve or change.`;
		return `/chat?${new URLSearchParams({
			source: 'profile-studio',
			prompt,
			left_kind: comparisonSelections.left.kind,
			left_id: comparisonSelections.left.id,
			right_kind: comparisonSelections.right.kind,
			right_id: comparisonSelections.right.id
		}).toString()}`;
	});

	function parseSelection(value: string): Selection | null {
		return findProfileOption(optionGroups, value);
	}

	/** Say what the user can do about a comparison that Parchment could not line up. */
	function comparisonError(message: unknown): string {
		if (typeof message !== 'string' || !message) return 'Unable to compare these profiles';
		return /charge milestone/i.test(message)
			? 'One of these profiles has no charge time recorded, so the two curves cannot be lined up. Choose a profile with a recorded curve.'
			: message;
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
		compareError = null;
		comparison = null;
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
			if (!response.ok) throw new Error(comparisonError(body.error));
			comparison = body.data;
			comparisonSelections = { left, right };
			trackProfileStudioActivation('profile_comparison_completed');
		} catch (cause) {
			compareError = cause instanceof Error ? cause.message : 'Unable to compare these profiles';
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
							>{roastOption(roast).label}</option
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

		<ProfileGeneration {profiles} {ownerId} onSaved={loadProfiles} />

		<div class="mt-5 rounded-xl border border-line p-4">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h3 class="font-semibold text-ink">Compare profiles</h3>
					<p class="mt-1 text-sm text-muted">
						Choose any two saved references or roasts. Search by coffee, date, batch, or roast
						number.
					</p>
				</div>
				<span class="text-xs text-muted"
					>{loading
						? 'Loading references…'
						: `${profiles.length} saved ${profiles.length === 1 ? 'reference' : 'references'} · ${executedRoasts.length} ${executedRoasts.length === 1 ? 'roast' : 'roasts'}`}</span
				>
			</div>
			<div class="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-start">
				<ProfilePicker
					label="First profile (A)"
					groups={optionGroups}
					bind:value={leftValue}
					unavailableValue={rightValue}
					{loading}
				/>
				<ProfilePicker
					label="Second profile (B)"
					groups={optionGroups}
					bind:value={rightValue}
					unavailableValue={leftValue}
					{loading}
				/>
				<button
					type="button"
					class="min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-ink disabled:opacity-50 md:mt-6"
					disabled={!leftValue || !rightValue || leftValue === rightValue || comparing}
					onclick={compareProfiles}>{comparing ? 'Comparing…' : 'Compare'}</button
				>
			</div>
			{#if compareError}
				<p role="alert" class="mt-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong">
					{compareError}
				</p>
			{/if}
			{#if unrecordedRoastCount > 0}
				<p class="mt-3 text-xs text-muted">
					{unrecordedRoastCount === 1
						? '1 roast with nothing recorded yet is not listed.'
						: `${unrecordedRoastCount} roasts with nothing recorded yet are not listed.`}
				</p>
			{/if}
		</div>

		{#if comparison && comparisonSelections && chartData}
			<div class="mt-5 rounded-xl border border-line bg-surface-canvas p-4">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div class="min-w-0">
						<p class="text-xs font-semibold uppercase tracking-wide text-muted">
							Measured comparison
						</p>
						<dl class="mt-2 space-y-2">
							{#each comparedProfiles as profile (profile.tag)}
								<div class="flex items-start gap-3">
									<dt
										class="flex shrink-0 items-center gap-2 pt-0.5 text-sm font-semibold text-ink"
									>
										<svg width="28" height="8" aria-hidden="true">
											<line
												x1="0"
												y1="4"
												x2="28"
												y2="4"
												stroke="currentColor"
												stroke-width="2"
												stroke-dasharray={profile.tag === COMPARISON_SIDES.right ? '5,4' : 'none'}
											/>
										</svg>
										{profile.tag}
									</dt>
									<dd class="min-w-0">
										<span class="block text-sm font-semibold text-ink">{profile.title}</span>
										<span class="block text-xs text-muted">{profile.detail} · {profile.lines}</span>
									</dd>
								</div>
							{/each}
						</dl>
						<p class="mt-3 text-sm text-muted">
							Both curves start at charge and are shown in °{comparison.targetUnit}. The chart
							covers the time both profiles were recording. A break in a line means no reading was
							recorded there.
						</p>
					</div>
					<a href={cherryHref} class="shrink-0 text-sm font-semibold text-link hover:text-accent"
						>Discuss with Cherry →</a
					>
				</div>
				<div class="mt-4 h-[24rem] min-h-[20rem]">
					{#await loadRoastChart() then { default: RoastChart }}
						<RoastChart {chartData} />
					{:catch}
						<p class="text-sm text-muted">
							The comparison chart could not load. Refresh to try again.
						</p>
					{/await}
				</div>
				{#if milestoneTimings.length > 0}
					<div class="mt-4">
						<h4 class="text-sm font-semibold text-ink">Milestone timing</h4>
						<p class="mt-1 text-xs text-muted">
							Time from charge to each milestone, and how much earlier or later
							{COMPARISON_SIDES.right} reached it than {COMPARISON_SIDES.left}.
						</p>
						<div class="mt-2 overflow-x-auto">
							<table class="w-full text-left text-sm">
								<thead>
									<tr class="text-xs text-muted">
										<th scope="col" class="py-1 pr-4 font-medium">Milestone</th>
										<th scope="col" class="py-1 pr-4 font-medium">{COMPARISON_SIDES.left}</th>
										<th scope="col" class="py-1 pr-4 font-medium">{COMPARISON_SIDES.right}</th>
										<th scope="col" class="py-1 font-medium">Difference</th>
									</tr>
								</thead>
								<tbody>
									{#each milestoneTimings as timing (timing.name)}
										<tr class="border-t border-line">
											<th scope="row" class="py-1.5 pr-4 font-medium text-ink">{timing.label}</th>
											<td class="py-1.5 pr-4 tabular-nums text-ink">{timing.leftTime}</td>
											<td class="py-1.5 pr-4 tabular-nums text-ink">{timing.rightTime}</td>
											<td class="py-1.5 text-ink">{timing.difference}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
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
