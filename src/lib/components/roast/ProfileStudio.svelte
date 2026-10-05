<script lang="ts">
	import { onMount } from 'svelte';
	import type { components } from '@purveyors/sdk';
	import { recordedRoasts, roastOption, type PickerRoast } from '$lib/roast/profile-picker-model';
	import { compareHref } from '$lib/roast/compare-sides';
	import { saveRoastAsReference } from '$lib/roast/save-reference';
	import { trackProfileStudioActivation } from '$lib/profileStudio/analytics';
	import ProfileGeneration from './ProfileGeneration.svelte';
	import {
		clearIdempotencyKey,
		reserveIdempotencyKey,
		shouldRetainIdempotencyKey
	} from '$lib/idempotency';

	let {
		roasts,
		enabled,
		ownerId = null
	}: { roasts: PickerRoast[]; enabled: boolean; ownerId?: string | null } = $props();
	type ReferenceProfileSummary = components['schemas']['ReferenceProfileSummary'];
	let profiles = $state<ReferenceProfileSummary[]>([]);
	let saving = $state(false);
	let selectedFile = $state<File | null>(null);
	let referenceTitle = $state('Artisan reference');
	let selectedRoastId = $state('');
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	const storage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
	// Every roast with something recorded, most recent first.
	const executedRoasts = $derived(recordedRoasts(roasts));

	async function loadProfiles() {
		if (!enabled) return;
		error = null;
		try {
			const response = await fetch('/api/reference-profiles');
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || 'Unable to load reference profiles');
			profiles = body.data ?? [];
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to load reference profiles';
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
		saving = true;
		error = null;
		notice = null;
		try {
			const title = await saveRoastAsReference(roast, ownerId, storage());
			notice = `${title} is saved as an immutable reference snapshot.`;
			selectedRoastId = '';
			trackProfileStudioActivation('reference_profile_saved');
			await loadProfiles();
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Unable to save this roast as a reference';
		} finally {
			saving = false;
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

		<div
			class="mt-5 flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<h3 class="font-semibold text-ink">Compare roasts</h3>
				<p class="mt-1 text-sm text-muted">
					Line up any two roasts or saved references. Both curves start at charge.
				</p>
			</div>
			<a
				href={compareHref()}
				class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-ink"
				>Compare roasts</a
			>
		</div>
	{:else}
		<div class="mt-5 rounded-xl bg-surface-canvas p-4 text-sm text-muted">
			Mallard Studio includes Artisan reference uploads, immutable roast snapshots, profile
			comparison, and Cherry guidance. Parchment Intelligence alone does not unlock private roast
			files.
		</div>
	{/if}
</section>
