<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import RoastLocked from './RoastLocked.svelte';

	let { children } = $props<{ children: Snippet }>();
</script>

<!-- An account without Mallard Studio gets the locked page in place of the roast page, so
     the roast page never mounts and none of its roast, coffee, or chart requests run. -->
{#if page.data.roastsLocked}
	<RoastLocked />
{:else}
	{@render children()}
{/if}
