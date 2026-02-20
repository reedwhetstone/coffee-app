<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children } = $props<{ children: Snippet }>();
</script>

<div class="mx-auto max-w-4xl px-6 py-12 sm:py-16 lg:px-8">
	{@render children()}
</div>
