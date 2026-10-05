<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import SavedLibrary from '$lib/components/roast/SavedLibrary.svelte';
	import { readOpenReference, savedHref } from '$lib/roast/saved-library';
	import RoastSegments from '../RoastSegments.svelte';
	import type { PageData } from './$types';

	// Member access is enforced for every path under `/roast` by the guard in hooks.server.ts.
	let { data }: { data: PageData } = $props();

	// The reference whose curve is open lives in the link, so Back closes it.
	const openId = $derived(readOpenReference(page.url.searchParams));
</script>

<div class="mx-auto w-full max-w-[100vw]">
	<SavedLibrary
		ownerId={data.auth?.user?.id ?? null}
		{openId}
		onCloseCurve={() =>
			void goto(savedHref(), { replaceState: true, keepFocus: true, noScroll: true })}
	>
		{#snippet segments()}
			<RoastSegments current="saved" />
		{/snippet}
	</SavedLibrary>
</div>
