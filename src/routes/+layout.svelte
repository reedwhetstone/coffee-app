<script lang="ts">
	import { error } from '@sveltejs/kit';
	import '../app.css';
	import Navbar from './Navbar.svelte';
	import Settingsbar from './Settingsbar.svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	// Global filter state
	let filters = $state<Record<string, any>>({
		sortField: null,
		sortDirection: null,
		source: [],
		uniqueSources: [],
		score_value: { min: '', max: '' },
		uniquePurchaseDates: []
	});

	function handleFilterChange(newFilters: Record<string, any>) {
		filters = { ...filters, ...newFilters };
	}

	onMount(() => {
		injectSpeedInsights();
		injectAnalytics();
	});
</script>

<Navbar {data} />
<Settingsbar {filters} onFilterChange={handleFilterChange} />
<div class="">
	{@render children()}
</div>
