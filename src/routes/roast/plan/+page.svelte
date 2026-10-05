<script lang="ts">
	import { page } from '$app/state';
	import ProfileGeneration from '$lib/components/roast/ProfileGeneration.svelte';
	import { readPlanLink } from '$lib/roast/plan-link';

	const link = $derived(readPlanLink(page.url.searchParams));
</script>

<div class="mx-auto w-full max-w-[100vw]">
	<div class="mb-6">
		<a href="/roast" class="text-sm text-link hover:text-accent">← Roasts</a>
		<h1 class="mt-2 text-2xl font-bold text-ink">Plan your next roast</h1>
		<p class="mt-1 text-muted">
			Start from a roast or reference you liked, adjust it, and save the result as a curve to follow
			in Artisan. Your roast history is not changed.
		</p>
	</div>
	<ProfileGeneration {link} ownerId={page.data.auth?.user?.id ?? null} />
</div>
