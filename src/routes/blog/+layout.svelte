<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children } = $props<{ children: Snippet }>();
</script>

<div class="mx-auto max-w-4xl px-6 py-8 sm:py-12 lg:px-8">
	{@render children()}
</div>
