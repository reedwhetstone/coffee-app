<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ProfileComparison from '$lib/components/roast/ProfileComparison.svelte';
	import Skeleton from '$lib/components/ui/Skeleton.svelte';
	import { compareHref, readCompareSides, type CompareSides } from '$lib/roast/compare-sides';
	import type { RoastProfile } from '$lib/types/component.types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let roasts = $state<RoastProfile[]>([]);
	// True until the first attempt to load the roasts has finished, either way.
	let isLoading = $state(true);
	let loadFailed = $state(false);

	// The two sides live in the link, so a comparison can be shared and reopened.
	const sides = $derived(readCompareSides(page.url.searchParams));

	// A failure leaves the page usable: saved references need no roast, so they can still be
	// chosen and compared while the roasts are tried again.
	async function loadRoasts(initial?: PageData['initialRoasts']) {
		try {
			let result: { data: RoastProfile[] };
			if (initial) {
				const loaded = await initial;
				if (loaded.error || !loaded.data) throw new Error(loaded.error ?? 'Failed to load roasts');
				result = loaded.data;
			} else {
				const response = await fetch('/api/roast-profiles');
				if (!response.ok) throw new Error('Failed to load roasts');
				result = await response.json();
			}
			roasts = Array.isArray(result.data) ? result.data : [];
			loadFailed = false;
		} catch {
			loadFailed = true;
		} finally {
			isLoading = false;
		}
	}

	// Changing a side rewrites the link in place, so Back returns to wherever the
	// comparison was opened from.
	function changeSides(next: CompareSides) {
		void goto(compareHref(next), { replaceState: true, keepFocus: true, noScroll: true });
	}

	onMount(() => void loadRoasts(data.initialRoasts));
</script>

<div class="mx-auto w-full max-w-[100vw]">
	<div class="mb-6">
		<a href="/roast" class="text-sm text-link hover:text-accent">← Roasts</a>
		<h1 class="mt-2 text-2xl font-bold text-ink">Compare roasts</h1>
		<p class="mt-1 text-muted">
			Line up any two roasts or saved references. Both curves start at charge.
		</p>
	</div>

	{#if isLoading}
		<div class="animate-pulse rounded-xl border border-line bg-surface-panel p-4">
			<div class="grid gap-3 md:grid-cols-2">
				<Skeleton class="h-11 opacity-30" />
				<Skeleton class="h-11 opacity-30" />
			</div>
		</div>
	{:else}
		<ProfileComparison
			{roasts}
			roastsError={loadFailed}
			onRetryRoasts={() => loadRoasts()}
			a={sides.a}
			b={sides.b}
			onChange={changeSides}
		/>
	{/if}
</div>
