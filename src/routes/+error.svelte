<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="flex min-h-[50vh] items-center justify-center px-4">
	<div class="rounded-lg border border-line bg-surface-panel p-8 text-center shadow-sm">
		<h1 class="text-4xl font-bold text-danger">
			{page.status}: {page.error?.message || 'Error'}
		</h1>
		<p class="mt-4 text-muted">
			{#if page.status === 404}
				The page you're looking for doesn't exist.
			{:else if page.status === 403}
				You don't have permission to access this page.
			{:else}
				Something went wrong. Please try again later.
			{/if}
		</p>
		<a
			href="/"
			class="mt-6 inline-block rounded-md bg-accent px-4 py-2 font-medium text-ink transition-opacity hover:opacity-90"
		>
			Go home
		</a>
	</div>
</div>
