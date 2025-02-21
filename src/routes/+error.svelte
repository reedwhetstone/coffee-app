<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="flex min-h-[50vh] items-center justify-center">
	<div class="text-center">
		<h1 class="text-4xl font-bold text-red-600">
			{$page.status}: {$page.error?.message || 'Error'}
		</h1>
		<p class="mt-4 text-zinc-600">
			{#if $page.status === 404}
				The page you're looking for doesn't exist.
			{:else if $page.status === 403}
				You don't have permission to access this page.
			{:else}
				Something went wrong. Please try again later.
			{/if}
		</p>
		<a
			href="/"
			class="mt-6 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
		>
			Go Home
		</a>
	</div>
</div>
