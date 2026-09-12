<script lang="ts">
	import RootLayout from '../../../src/routes/+layout.svelte';
	import ChatPage from '../../../src/routes/chat/+page.svelte';
	import { data } from './fixtures';
	import type { ComponentProps } from 'svelte';
	const layoutData = data as unknown as ComponentProps<typeof RootLayout>['data'];
	const pageData = data as unknown as ComponentProps<typeof ChatPage>['data'];
	const drawer = new URLSearchParams(location.search).get('surface') === 'drawer';
</script>

<RootLayout data={layoutData}>
	{#if drawer}
		<h1 class="text-2xl">Fixture inventory</h1>
		<p>This synthetic host page verifies the real Cherry drawer and app navigation.</p>
	{:else}
		<ChatPage data={pageData} />
	{/if}
</RootLayout>
