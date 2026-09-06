<script lang="ts">
	import NewsletterPage from '../market-wire/+page.svelte';
	import type { PageData } from './$types';
	let { data } = $props<{ data: PageData }>();
</script>

<NewsletterPage {data} />
