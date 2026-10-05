<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ProfileGeneration from '$lib/components/roast/ProfileGeneration.svelte';
	import SavedPlan from '$lib/components/roast/SavedPlan.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import type { CompareSide } from '$lib/roast/compare-sides';
	import { referenceOption } from '$lib/roast/profile-picker-model';
	import {
		planDownloadHref,
		planHref,
		readPlanLink,
		savedPlans,
		type RoastCandidates,
		type SavedReference
	} from '$lib/roast/roast-plan';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let profiles = $state<SavedReference[]>([]);
	let candidates = $state<RoastCandidates | null>(null);
	// True until the first attempt to load both lists has finished, either way.
	let isLoading = $state(true);
	let referencesFailed = $state(false);
	let roastsFailed = $state(false);
	let savedPlanId = $state<string | null>(null);

	// What is being planned lives in the link, so a plan can be shared and reopened.
	const link = $derived(readPlanLink(page.url.searchParams));
	const plans = $derived(savedPlans(profiles));

	async function loadReferences() {
		try {
			const response = await fetch('/api/reference-profiles');
			const body: { data?: SavedReference[] } | null = await response.json().catch(() => null);
			if (!response.ok || !body) throw new Error('Unable to load saved references');
			profiles = body.data ?? [];
			referencesFailed = false;
		} catch {
			referencesFailed = true;
		}
	}

	// A failure leaves the page usable: a plan from a saved reference needs no roast.
	async function loadRoasts() {
		try {
			const response = await fetch('/api/reference-profiles/from-roast/candidates');
			const body: { data?: RoastCandidates } | null = await response.json().catch(() => null);
			if (!response.ok || !body?.data) throw new Error('Unable to load roasts');
			candidates = body.data;
			roastsFailed = false;
		} catch {
			roastsFailed = true;
		}
	}

	// Choosing what to start from rewrites the link in place, so Back returns to wherever
	// the plan was opened from.
	function changeStart(side: CompareSide) {
		void goto(planHref({ from: side }), { replaceState: true, keepFocus: true, noScroll: true });
	}

	// The saved plan is its own entry: Back returns to the form it was made in.
	async function openSavedPlan(plan: { id: string }) {
		await loadReferences();
		savedPlanId = plan.id;
		await goto(planHref({ plan: plan.id }));
	}

	onMount(async () => {
		await Promise.all([loadReferences(), loadRoasts()]);
		isLoading = false;
	});
</script>

<div class="mx-auto w-full max-w-[100vw]">
	<div class="mb-6">
		<a href="/roast" class="text-sm text-link hover:text-accent">← Roasts</a>
		<h1 class="mt-2 text-2xl font-bold text-ink">Plan your next roast</h1>
		<p class="mt-1 max-w-3xl text-muted">
			Start from a roast or reference you liked, adjust it, and save the result as a curve to follow
			in Artisan. Your roast history is not changed.
		</p>
	</div>

	{#if isLoading}
		<div class="animate-pulse rounded-xl border border-line bg-surface-panel p-4 sm:p-6">
			<Skeleton class="h-11 max-w-2xl opacity-30" />
			<Skeleton class="mt-6 h-11 max-w-2xl opacity-30" />
		</div>
	{:else}
		{#if referencesFailed}
			<div
				role="alert"
				class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
			>
				<span>Saved references and plans could not be loaded.</span>
				<button
					type="button"
					class="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-danger hover:text-white"
					onclick={loadReferences}>Try again</button
				>
			</div>
		{/if}
		{#if link.plan}
			{#if !referencesFailed}
				<SavedPlan planId={link.plan} {profiles} justSaved={savedPlanId === link.plan} />
			{/if}
		{:else}
			{#if roastsFailed}
				<div
					role="alert"
					class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-subtle p-3 text-sm text-danger-strong"
				>
					<span>Roasts could not be loaded.</span>
					<button
						type="button"
						class="rounded-md border border-danger px-3 py-1 font-medium text-danger hover:bg-danger hover:text-white"
						onclick={loadRoasts}>Try again</button
					>
				</div>
			{/if}
			<ProfileGeneration
				candidates={candidates?.roasts ?? []}
				{profiles}
				ineligibleRoastCount={candidates?.ineligibleRoastCount ?? 0}
				eligibleRoastCount={candidates?.eligibleCount ?? 0}
				{referencesFailed}
				{roastsFailed}
				from={link.from}
				ownerId={data.auth?.user?.id ?? null}
				onStartChange={changeStart}
				onSaved={openSavedPlan}
			/>
			{#if plans.length > 0}
				<!-- The bottom margin keeps the last download clear of the chat button fixed to the corner. -->
				<section
					class="mb-20 mt-6 rounded-xl border border-line bg-surface-panel p-4 sm:p-6"
					aria-labelledby="saved-plans"
				>
					<h2 id="saved-plans" class="font-semibold text-ink">Saved plans</h2>
					<ul class="mt-2 divide-y divide-line text-sm">
						{#each plans as plan (plan.id)}
							{@const option = referenceOption(plan)}
							<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
								<div class="min-w-0">
									<a
										href={planHref({ plan: plan.id })}
										class="break-words font-semibold text-link hover:text-accent">{option.title}</a
									>
									<p class="text-muted">{option.detail}</p>
								</div>
								<a
									href={planDownloadHref(plan)}
									download
									aria-label="Download for Artisan (.alog): {option.title}"
									class="inline-flex min-h-11 shrink-0 items-center font-semibold text-link hover:text-accent"
									>Download for Artisan (.alog)</a
								>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/if}
	{/if}
</div>
