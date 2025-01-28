<script lang="ts">
	import { i18n } from '$lib/i18n';
	import { ParaglideJS } from '@inlang/paraglide-sveltekit';
	import '../app.css';
	import Navbar from './Navbar.svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';

	onMount(() => {
		injectSpeedInsights();
		injectAnalytics();
	});

	let { children } = $props();
</script>

<Navbar />

<ParaglideJS {i18n}>
	{@render children()}
</ParaglideJS>
