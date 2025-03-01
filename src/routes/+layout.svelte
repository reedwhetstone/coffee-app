<script lang="ts">
	import { error } from '@sveltejs/kit';
	import '../app.css';
	import Navbar from './Navbar.svelte';
	import Settingsbar from './Settingsbar.svelte';
	import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';
	import { injectAnalytics } from '@vercel/analytics/sveltekit';
	import { onMount } from 'svelte';

	interface LayoutData {
		session: {
			access_token: string;
			refresh_token: string;
			expires_in: number;
			expires_at: number | undefined;
			user: {
				id: string;
				email: string;
				role: string;
			};
		} | null;
		user: {
			id: string;
			email: string;
			role: string;
		} | null;
		role: 'viewer' | 'member' | 'admin';
		data?: any[];
	}

	let { data, children } = $props<{ data: LayoutData }>();

	// Global filtered data state
	let filteredData = $state<any[]>([]);

	function handleFilteredData(newFilteredData: any[]) {
		filteredData = newFilteredData;
	}

	onMount(() => {
		injectSpeedInsights();
		injectAnalytics();
	});
</script>

<Navbar {data} />
<Settingsbar data={data.data ?? []} {filteredData} onFilteredData={handleFilteredData} />
<div class="">
	{@render children()}
</div>
