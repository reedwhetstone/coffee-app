<script lang="ts">
	import { error } from '@sveltejs/kit';
	import '../app.css';
	import Navbar from './Navbar.svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	onMount(() => {
		injectSpeedInsights();
		injectAnalytics();
	});
</script>

<Navbar {data} />
<div class="m-10">
	{@render children()}
</div>
