<script lang="ts">
	import DocsShell from '$lib/components/docs/DocsShell.svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<svelte:head>
	<title>{data.page.title} | Purveyors Docs</title>
	<meta name="description" content={data.page.summary} />
</svelte:head>

<DocsShell page={data.page} section={data.section} slug={data.slug} />
