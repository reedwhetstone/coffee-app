<script lang="ts">
	import { onMount, tick, untrack, type Snippet } from 'svelte';
	import type { components } from '@purveyors/sdk';
	import LibraryDialog from './LibraryDialog.svelte';
	import RowMenu, { type RowMenuItem } from './RowMenu.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import {
		clearIdempotencyKey,
		reserveIdempotencyKey,
		shouldRetainIdempotencyKey
	} from '$lib/idempotency';
	import { trackProfileStudioActivation } from '$lib/profileStudio/analytics';
	import {
		ARTISAN_BACKGROUND_STEPS,
		downloadFile,
		referenceFileReasonCopy
	} from '$lib/roast/artisan-download';
	import { compareHref, roastHref } from '$lib/roast/compare-sides';
	import { buildReferenceCurveChart } from '$lib/roast/profile-generation-model';
	import { planHref, type ReferenceChart, type SavedReference } from '$lib/roast/roast-plan';
	import {
		libraryRows,
		referenceNameFromFile,
		savedHref,
		type LibraryRow
	} from '$lib/roast/saved-library';

	type ChartAnswer = components['schemas']['ReferenceProfileChartResponse']['data'];
	type RowStatus = {
		/** `note` is a next step, not a failure. */
		tone: 'status' | 'note' | 'alert';
		message: string;
		link?: { href: string; label: string };
	};

	let {
		ownerId = null,
		openId = null,
		onCloseCurve,
		segments
	}: {
		ownerId?: string | null;
		/** The saved reference whose curve is open, from `/roast/saved?ref=<uuid>`. */
		openId?: string | null;
		/** Called when the reference whose curve is open is removed. */
		onCloseCurve?: () => void;
		/** Drawn between the heading and the list. */
		segments?: Snippet;
	} = $props();

	let profiles = $state<SavedReference[]>([]);
	// True until the first attempt to load the list has finished, either way.
	let isLoading = $state(true);
	let loadFailed = $state(false);
	let notice = $state<string | null>(null);
	let rowStatus = $state<Record<string, RowStatus>>({});

	const storage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
	const rows = $derived(libraryRows(profiles));

	async function loadReferences() {
		try {
			const response = await fetch('/api/reference-profiles');
			const body: { data?: SavedReference[] } | null = await response.json().catch(() => null);
			if (!response.ok || !body) throw new Error('Unable to load saved references');
			profiles = body.data ?? [];
			loadFailed = false;
		} catch {
			loadFailed = true;
		} finally {
			isLoading = false;
		}
	}

	function setStatus(id: string, status: RowStatus | null) {
		const next = { ...rowStatus };
		if (status) next[id] = status;
		else delete next[id];
		rowStatus = next;
	}

	// Up to two rows are ticked for comparison. A third tick replaces the earliest.
	let ticked = $state<string[]>([]);

	function toggleTick(id: string) {
		ticked = ticked.includes(id)
			? ticked.filter((entry) => entry !== id)
			: [...ticked, id].slice(-2);
	}

	// The newer of the two is side A, as it is when roasts are ticked in portfolio.
	const compareLink = $derived.by(() => {
		if (ticked.length !== 2) return null;
		const [a, b] = rows.filter((row) => ticked.includes(row.id));
		if (!a || !b) return null;
		return compareHref({ a: { type: 'ref', id: a.id }, b: { type: 'ref', id: b.id } });
	});

	// ---- Add an Artisan file ----
	const UPLOAD_SCOPE = 'profile-studio-upload';
	let adding = $state(false);
	let addName = $state('');
	let addFile = $state<File | null>(null);
	let addSaving = $state(false);
	let addError = $state<string | null>(null);
	let addButton = $state<HTMLButtonElement | null>(null);
	let addNameInput = $state<HTMLInputElement | null>(null);

	async function openAddForm() {
		adding = true;
		addError = null;
		notice = null;
		await tick();
		addNameInput?.focus();
	}

	function closeAddForm() {
		adding = false;
		addName = '';
		addFile = null;
		addError = null;
		addButton?.focus();
	}

	function chooseFile(event: Event) {
		addFile = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
		// The file's own name tells one upload from the next until the member types another.
		if (addFile && !addName.trim()) addName = referenceNameFromFile(addFile.name);
	}

	async function uploadReference() {
		if (!addFile || addSaving) return;
		const file = addFile;
		const title = addName.trim() || referenceNameFromFile(file.name);
		const fingerprint = [file.name, file.size, file.lastModified, title].join('|');
		const idempotencyKey = reserveIdempotencyKey(storage(), ownerId, UPLOAD_SCOPE, fingerprint);
		addSaving = true;
		addError = null;
		try {
			const form = new FormData();
			form.set('file', file);
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
					clearIdempotencyKey(storage(), ownerId, UPLOAD_SCOPE, fingerprint);
				throw new Error(body?.error || 'Unable to save this Artisan file');
			}
			if (!body?.data?.title) throw new Error('Unable to save this Artisan file');
			clearIdempotencyKey(storage(), ownerId, UPLOAD_SCOPE, fingerprint);
			trackProfileStudioActivation('artisan_file_accepted');
			trackProfileStudioActivation('reference_profile_saved');
			closeAddForm();
			notice = `${body.data.title} is saved as a reference. It is not counted as a roast.`;
			await loadReferences();
		} catch (cause) {
			addError = cause instanceof Error ? cause.message : 'Unable to save this Artisan file';
		} finally {
			addSaving = false;
		}
	}

	// ---- Download ----
	let downloading = $state<string | null>(null);

	function downloadedFileIs(row: LibraryRow): string {
		if (row.isPlan) return 'It is this plan as an Artisan file.';
		return row.profile.sourceClass === 'artisan_upload'
			? 'It is the Artisan file you added, unchanged.'
			: 'It is the Artisan file of the roast this reference was kept from, unchanged.';
	}

	async function download(row: LibraryRow) {
		if (downloading) return;
		downloading = row.id;
		setStatus(row.id, null);
		const result = await downloadFile(
			row.downloadHref,
			row.isPlan ? 'Purveyors-reference.alog' : `${row.option.title}.alog`
		);
		downloading = null;
		if (result.ok) {
			setStatus(row.id, {
				tone: 'status',
				message: `Downloading ${result.fileName}. ${downloadedFileIs(row)} ${ARTISAN_BACKGROUND_STEPS}`
			});
		} else if (!row.isPlan && result.reason) {
			const sourceRoastId = row.profile.sourceRoast?.id ?? null;
			setStatus(row.id, {
				tone: 'note',
				message: referenceFileReasonCopy(result.reason),
				...(result.reason === 'chart_snapshot' && sourceRoastId != null
					? { link: { href: roastHref(sourceRoastId), label: 'Open the roast' } }
					: {})
			});
		} else {
			setStatus(row.id, {
				tone: 'alert',
				message: 'This file could not be downloaded. Try again in a moment.'
			});
		}
	}

	// ---- Rename ----
	let renaming = $state<{
		id: string;
		value: string;
		saving: boolean;
		error: string | null;
	} | null>(null);
	let renameInput = $state<HTMLInputElement | null>(null);

	async function startRename(row: LibraryRow) {
		renaming = { id: row.id, value: row.option.title, saving: false, error: null };
		setStatus(row.id, null);
		await tick();
		renameInput?.focus();
		renameInput?.select();
	}

	async function saveRename(event: SubmitEvent) {
		event.preventDefault();
		const current = renaming;
		if (!current || current.saving) return;
		const title = current.value.trim();
		if (!title) {
			current.error = 'Enter a name.';
			return;
		}
		current.saving = true;
		current.error = null;
		try {
			const response = await fetch(`/api/reference-profiles/${encodeURIComponent(current.id)}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title })
			});
			const body = (await response.json().catch(() => null)) as {
				data?: { title?: string };
				error?: string;
			} | null;
			if (!response.ok) throw new Error(body?.error || 'Unable to rename this');
			const saved = body?.data?.title?.trim() || title;
			profiles = profiles.map((profile) =>
				profile.id === current.id ? { ...profile, title: saved } : profile
			);
			renaming = null;
			setStatus(current.id, { tone: 'status', message: `Renamed to ${saved}.` });
		} catch (cause) {
			current.saving = false;
			current.error = cause instanceof Error ? cause.message : 'Unable to rename this';
		}
	}

	// ---- Remove ----
	let removing = $state<{ row: LibraryRow; busy: boolean; error: string | null } | null>(null);

	async function confirmRemove() {
		const current = removing;
		if (!current || current.busy) return;
		current.busy = true;
		current.error = null;
		try {
			const response = await fetch(
				`/api/reference-profiles/${encodeURIComponent(current.row.id)}`,
				{
					method: 'DELETE'
				}
			);
			if (!response.ok) {
				const body = (await response.json().catch(() => null)) as { error?: string } | null;
				throw new Error(body?.error || 'Unable to remove this');
			}
			const { id } = current.row;
			profiles = profiles.filter((profile) => profile.id !== id);
			ticked = ticked.filter((entry) => entry !== id);
			setStatus(id, null);
			removing = null;
			notice = `${current.row.option.title} is removed. Your roasts are not changed.`;
			if (openId === id) onCloseCurve?.();
		} catch (cause) {
			current.busy = false;
			current.error = cause instanceof Error ? cause.message : 'Unable to remove this';
		}
	}

	// ---- Record as a roast I ran ----
	const RECORD_SCOPE = 'saved-library-record-roast';
	let recording = $state<{
		row: LibraryRow;
		coffeeId: string;
		busy: boolean;
		error: string | null;
	} | null>(null);
	let coffees = $state<{ id: number; name: string }[] | null>(null);
	let coffeesFailed = $state(false);

	async function loadCoffees() {
		coffeesFailed = false;
		try {
			const response = await fetch('/api/beans');
			const body = (await response.json().catch(() => null)) as {
				data?: { id: number; name?: string | null; coffee_catalog?: { name?: string | null } }[];
			} | null;
			if (!response.ok || !Array.isArray(body?.data)) throw new Error('Unable to load coffees');
			coffees = body.data
				.map((coffee) => ({
					id: coffee.id,
					name: coffee.coffee_catalog?.name?.trim() || coffee.name?.trim() || `Coffee #${coffee.id}`
				}))
				.sort((left, right) => left.name.localeCompare(right.name));
		} catch {
			coffeesFailed = true;
		}
	}

	function startRecording(row: LibraryRow) {
		recording = { row, coffeeId: '', busy: false, error: null };
		setStatus(row.id, null);
		if (!coffees) void loadCoffees();
	}

	async function recordRoast(event: SubmitEvent) {
		event.preventDefault();
		const current = recording;
		const coffeeId = Number(current?.coffeeId);
		if (!current || current.busy || !Number.isSafeInteger(coffeeId) || coffeeId <= 0) return;
		const { row } = current;
		const payload = JSON.stringify({ coffeeId, revisionId: row.profile.currentRevisionId });
		const fingerprint = `${row.id}|${payload}`;
		const idempotencyKey = reserveIdempotencyKey(storage(), ownerId, RECORD_SCOPE, fingerprint);
		current.busy = true;
		current.error = null;
		try {
			const response = await fetch(`/api/reference-profiles/${encodeURIComponent(row.id)}/roast`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
				body: payload
			});
			const body = (await response.json().catch(() => null)) as {
				data?: { roastId?: number; coffeeName?: string | null };
				error?: string;
			} | null;
			if (!response.ok) {
				if (!shouldRetainIdempotencyKey(response.status))
					clearIdempotencyKey(storage(), ownerId, RECORD_SCOPE, fingerprint);
				throw new Error(body?.error || 'Unable to record this as a roast');
			}
			const roastId = body?.data?.roastId;
			if (typeof roastId !== 'number') throw new Error('Unable to record this as a roast');
			clearIdempotencyKey(storage(), ownerId, RECORD_SCOPE, fingerprint);
			const coffeeName = body?.data?.coffeeName?.trim();
			recording = null;
			setStatus(row.id, {
				tone: 'status',
				message: `Recorded as roast #${roastId}${coffeeName ? ` of ${coffeeName}` : ''}. This saved reference is kept.`,
				link: { href: roastHref(roastId), label: 'Open the roast' }
			});
		} catch (cause) {
			current.busy = false;
			current.error = cause instanceof Error ? cause.message : 'Unable to record this as a roast';
		}
	}

	// ---- View curve ----
	let curve = $state<{ key: string; chart: ReferenceChart } | null>(null);
	let curveFailed = $state(false);

	const openRow = $derived(openId ? (rows.find((row) => row.id === openId) ?? null) : null);
	const curveKey = $derived(openRow ? `${openRow.id}@${openRow.profile.currentRevisionId}` : '');
	const openCurve = $derived(curve?.key === curveKey ? curve : null);
	const chartData = $derived(openCurve ? buildReferenceCurveChart(openCurve.chart) : null);

	const loadRoastChart = () => import('./chart/RoastChart.svelte');

	async function loadCurve(profile: SavedReference, requested: string) {
		curveFailed = false;
		try {
			const response = await fetch(
				`/api/reference-profiles/${encodeURIComponent(profile.id)}/revisions/${encodeURIComponent(profile.currentRevisionId)}/chart`
			);
			const body: { data?: ChartAnswer } | null = await response.json().catch(() => null);
			if (requested !== curveKey) return;
			if (!response.ok || !body?.data?.chart) throw new Error('No chart');
			curve = { key: requested, chart: body.data.chart };
		} catch {
			if (requested === curveKey) curveFailed = true;
		}
	}

	$effect(() => {
		const requested = curveKey;
		untrack(() => {
			if (openRow && curve?.key !== requested) void loadCurve(openRow.profile, requested);
		});
	});

	function menuItems(row: LibraryRow): RowMenuItem[] {
		const side = { type: 'ref' as const, id: row.id };
		return [
			row.id === openId
				? { label: 'Hide curve', href: savedHref() }
				: { label: 'View curve', href: savedHref(row.id) },
			{ label: 'Compare', href: compareHref({ a: side }) },
			...(row.canPlan ? [{ label: 'Plan from this', href: planHref({ from: side }) }] : []),
			{
				label: 'Download for Artisan',
				run: () => void download(row),
				disabled: downloading !== null
			},
			...(row.canRecordAsRoast
				? [{ label: 'Record as a roast I ran', run: () => startRecording(row) }]
				: []),
			{ label: 'Rename', run: () => void startRename(row) },
			{
				label: 'Remove',
				run: () => (removing = { row, busy: false, error: null }),
				destructive: true
			}
		];
	}

	const statusClass: Record<RowStatus['tone'], string> = {
		status: 'bg-success-subtle text-success-strong',
		note: 'bg-surface-panel text-muted ring-1 ring-line',
		alert: 'bg-danger-subtle text-danger-strong'
	};

	onMount(() => void loadReferences());
</script>

<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
	<div>
		<h1 class="text-2xl font-bold text-ink">Saved references and plans</h1>
		<p class="mt-1 max-w-3xl text-muted">
			References you kept to repeat, and plans you made from them. They are never counted as roasts.
		</p>
	</div>
	<button
		bind:this={addButton}
		type="button"
		aria-expanded={adding}
		class="inline-flex shrink-0 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-accent/85"
		onclick={() => (adding ? closeAddForm() : void openAddForm())}
	>
		Add an Artisan file
	</button>
</div>

{@render segments?.()}

{#if adding}
	<form
		class="mb-4 rounded-xl border border-line bg-surface-panel p-4"
		aria-labelledby="add-artisan-file"
		onsubmit={(event) => {
			event.preventDefault();
			void uploadReference();
		}}
	>
		<h2 id="add-artisan-file" class="font-semibold text-ink">Add an Artisan file</h2>
		<p class="mt-1 max-w-2xl text-sm text-muted">
			Keeps the file as a reference to compare or plan from. To record it as a roast you ran, import
			it from Roasts.
		</p>
		<div class="mt-3 grid gap-3 sm:grid-cols-2">
			<label class="block text-sm font-medium text-ink"
				>Artisan file (.alog)<input
					type="file"
					accept=".alog,.alog.json,.json"
					class="mt-1 block w-full text-sm font-normal text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-ink"
					onchange={chooseFile}
				/></label
			>
			<label class="block text-sm font-medium text-ink"
				>Name<input
					bind:this={addNameInput}
					bind:value={addName}
					maxlength="120"
					class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 font-normal"
				/></label
			>
		</div>
		{#if addError}
			<p role="alert" class="mt-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong">
				{addError}
			</p>
		{/if}
		<div class="mt-3 flex flex-wrap gap-3">
			<button
				type="submit"
				class="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
				disabled={!addFile || addSaving}>{addSaving ? 'Saving…' : 'Save reference'}</button
			>
			<button
				type="button"
				class="rounded-md border border-line px-4 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-ink"
				onclick={closeAddForm}>Cancel</button
			>
		</div>
	</form>
{/if}

{#if notice}
	<p role="status" class="mb-4 rounded-lg bg-success-subtle p-3 text-sm text-success-strong">
		{notice}
	</p>
{/if}

{#if isLoading}
	<div class="animate-pulse rounded-lg bg-surface-canvas p-4 ring-1 ring-line">
		<Skeleton class="h-11 opacity-30" />
		<Skeleton class="mt-3 h-11 opacity-30" />
	</div>
{:else if loadFailed}
	<div
		role="alert"
		class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
	>
		<span>Saved references and plans could not be loaded.</span>
		<button
			type="button"
			class="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-danger hover:text-white"
			onclick={loadReferences}>Try again</button
		>
	</div>
{:else if rows.length === 0}
	<div class="rounded-lg bg-surface-canvas p-6 ring-1 ring-line">
		<p class="text-muted">
			<span class="font-semibold text-ink">Nothing saved yet.</span>
			Save a roast you want to repeat, add an Artisan file, or make a plan from a roast.
		</p>
		<p class="mt-3">
			<a href="/roast" class="text-sm font-semibold text-link hover:text-accent">Open Roasts</a>
		</p>
	</div>
{:else}
	{#if openId && !openRow}
		<p
			role="status"
			class="mb-4 rounded-lg bg-surface-panel p-3 text-sm text-muted ring-1 ring-line"
		>
			That saved reference could not be found. It may have been removed.
		</p>
	{/if}
	<ul
		aria-label="Saved references and plans, newest first"
		class="divide-y divide-line rounded-lg bg-surface-canvas ring-1 ring-line"
	>
		{#each rows as row (row.id)}
			{@const status = rowStatus[row.id]}
			{@const isOpen = row.id === openId}
			<li class="px-3 py-3">
				<div
					class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center"
				>
					<input
						type="checkbox"
						class="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent sm:mt-0"
						checked={ticked.includes(row.id)}
						onchange={() => toggleTick(row.id)}
						aria-label="Compare {row.option.title}"
					/>
					<div class="min-w-0">
						{#if renaming?.id === row.id}
							<form class="flex flex-wrap items-center gap-2" onsubmit={saveRename}>
								<label class="sr-only" for="rename-{row.id}">Name</label>
								<input
									id="rename-{row.id}"
									bind:this={renameInput}
									bind:value={renaming.value}
									maxlength="200"
									class="min-h-11 min-w-0 flex-1 rounded-md border border-line bg-surface-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
									onkeydown={(event) => {
										if (event.key === 'Escape') renaming = null;
									}}
								/>
								<button
									type="submit"
									class="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"
									disabled={renaming.saving}>{renaming.saving ? 'Saving…' : 'Save name'}</button
								>
								<button
									type="button"
									class="rounded-md border border-line px-3 py-2 text-sm font-semibold text-muted hover:border-accent hover:text-ink"
									onclick={() => (renaming = null)}>Cancel</button
								>
							</form>
							{#if renaming.error}
								<p role="alert" class="mt-2 text-sm text-danger-strong">{renaming.error}</p>
							{/if}
						{:else if row.isPlan}
							<a
								href={planHref({ plan: row.id })}
								class="break-words font-semibold text-link hover:text-accent">{row.option.title}</a
							>
						{:else}
							<p class="break-words font-semibold text-ink">{row.option.title}</p>
						{/if}
						<p class="text-sm text-muted">{row.option.detail}</p>
					</div>
					<div class="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1">
						{#if row.isPlan}
							<button
								type="button"
								class="inline-flex min-h-9 items-center text-sm font-semibold text-link hover:text-accent disabled:opacity-50"
								disabled={downloading !== null}
								aria-label="Download for Artisan: {row.option.title}"
								onclick={() => download(row)}
							>
								{downloading === row.id ? 'Downloading…' : 'Download for Artisan'}
							</button>
						{:else}
							<a
								href={isOpen ? savedHref() : savedHref(row.id)}
								data-sveltekit-noscroll
								aria-label="{isOpen ? 'Hide curve' : 'View curve'}: {row.option.title}"
								class="inline-flex min-h-9 items-center text-sm font-semibold text-link hover:text-accent"
							>
								{isOpen ? 'Hide curve' : 'View curve'}
							</a>
						{/if}
					</div>
					<div class="col-start-3 row-start-1 sm:col-start-4">
						<RowMenu label="More for {row.option.title}" items={menuItems(row)} />
					</div>
				</div>

				{#if status}
					<p
						role={status.tone === 'alert' ? 'alert' : 'status'}
						class="mt-3 rounded-lg p-3 text-sm {statusClass[status.tone]}"
					>
						{status.message}
						{#if status.link}
							<a href={status.link.href} class="font-semibold underline hover:no-underline"
								>{status.link.label}</a
							>
						{/if}
					</p>
				{/if}

				{#if isOpen}
					<div class="mt-3 rounded-xl bg-surface-panel p-3 sm:p-4">
						{#if chartData}
							<div class="h-[24rem] min-h-[20rem]">
								{#await loadRoastChart() then { default: RoastChart }}
									<RoastChart {chartData} />
								{:catch}
									<p class="text-sm text-muted">The chart could not load. Refresh to try again.</p>
								{/await}
							</div>
						{:else if curveFailed}
							<div
								role="alert"
								class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
							>
								<span>This curve could not be loaded.</span>
								<button
									type="button"
									class="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-danger hover:text-white"
									onclick={() => loadCurve(row.profile, curveKey)}>Try again</button
								>
							</div>
						{:else}
							<p role="status" class="text-sm text-muted">Loading the curve…</p>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>

	<!-- The bottom margin keeps the last row's menu clear of the chat button fixed to the corner. -->
	<div class="mb-20 mt-3 flex min-h-11 flex-wrap items-center justify-between gap-3">
		{#if rows.length > 1}
			<p class="text-sm text-muted" aria-live="polite">
				{ticked.length === 0 ? 'Tick two to compare them.' : `${ticked.length} selected`}
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
		{/if}
	</div>
{/if}

{#if removing}
	<LibraryDialog
		title="Remove {removing.row.option.title}?"
		urgent
		onCancel={() => {
			if (!removing?.busy) removing = null;
		}}
	>
		<p class="mt-2 text-sm text-muted">
			It will no longer be here to compare, plan from, or download. This cannot be undone. Your
			roasts are not changed.
		</p>
		{#if removing.error}
			<p role="alert" class="mt-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong">
				{removing.error}
			</p>
		{/if}
		<div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
			<button
				type="button"
				class="rounded-md bg-accent px-4 py-2 font-medium text-ink transition-all duration-200 hover:bg-accent/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
				disabled={removing.busy}
				onclick={() => (removing = null)}
			>
				Keep it
			</button>
			<button
				type="button"
				class="rounded-md border border-danger px-4 py-2 font-medium text-danger transition-all duration-200 hover:bg-danger hover:text-white focus:outline-none focus:ring-2 focus:ring-danger focus:ring-offset-2 disabled:opacity-50"
				disabled={removing.busy}
				onclick={confirmRemove}
			>
				{removing.busy ? 'Removing…' : 'Remove'}
			</button>
		</div>
	</LibraryDialog>
{/if}

{#if recording}
	<LibraryDialog
		title="Record as a roast I ran"
		onCancel={() => {
			if (!recording?.busy) recording = null;
		}}
	>
		<form onsubmit={recordRoast}>
			<p class="mt-2 text-sm text-muted">
				Adds {recording.row.option.title} to your roasts, with the curve from its Artisan file. It then
				counts as one of that coffee’s roasts. This saved reference is kept.
			</p>
			{#if coffeesFailed}
				<div
					role="alert"
					class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
				>
					<span>Your coffees could not be loaded.</span>
					<button
						type="button"
						class="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-danger hover:text-white"
						onclick={loadCoffees}>Try again</button
					>
				</div>
			{:else if coffees === null}
				<p role="status" class="mt-4 text-sm text-muted">Loading your coffees…</p>
			{:else if coffees.length === 0}
				<p class="mt-4 text-sm text-muted">
					A roast is recorded against a coffee in your portfolio, and yours has none yet.
					<a href="/beans" class="font-semibold text-link hover:text-accent">Add a coffee</a>
				</p>
			{:else}
				<label class="mt-4 block text-sm font-medium text-ink"
					>Coffee that was roasted<select
						value={recording.coffeeId}
						class="mt-1 min-h-11 w-full rounded-md border border-line bg-surface-canvas px-3 text-sm font-normal text-ink"
						onchange={(event) => {
							if (recording) recording.coffeeId = event.currentTarget.value;
						}}
					>
						<option value="">Choose a coffee</option>
						{#each coffees as coffee (coffee.id)}
							<option value={String(coffee.id)}>{coffee.name}</option>
						{/each}
					</select></label
				>
			{/if}
			{#if recording.error}
				<p role="alert" class="mt-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong">
					{recording.error}
				</p>
			{/if}
			<div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					class="rounded-md border border-line px-4 py-2 font-medium text-muted hover:border-accent hover:text-ink"
					disabled={recording.busy}
					onclick={() => (recording = null)}
				>
					Cancel
				</button>
				<button
					type="submit"
					class="rounded-md bg-accent px-4 py-2 font-medium text-ink transition-all duration-200 hover:bg-accent/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50"
					disabled={!recording.coffeeId || recording.busy}
				>
					{recording.busy ? 'Recording…' : 'Record roast'}
				</button>
			</div>
		</form>
	</LibraryDialog>
{/if}
