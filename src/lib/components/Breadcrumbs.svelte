<script lang="ts">
	interface BreadcrumbItem {
		name: string;
		url: string;
	}

	let { breadcrumbs, className = '' } = $props<{
		breadcrumbs: BreadcrumbItem[];
		className?: string;
	}>();
</script>

<nav aria-label="Breadcrumb" class="breadcrumb-nav {className}">
	<ol class="flex items-center space-x-2 text-sm text-text-secondary-light">
		{#each breadcrumbs as breadcrumb, index}
			<li class="flex items-center">
				{#if index > 0}
					<svg
						class="mx-2 h-4 w-4 text-text-secondary-light"
						fill="currentColor"
						viewBox="0 0 20 20"
						aria-hidden="true"
					>
						<path
							fill-rule="evenodd"
							d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
				{#if index === breadcrumbs.length - 1}
					<!-- Current page - not a link -->
					<span class="font-medium text-text-primary-light" aria-current="page">
						{breadcrumb.name}
					</span>
				{:else}
					<!-- Breadcrumb link -->
					<a
						href={breadcrumb.url}
						class="font-medium text-background-tertiary-light transition-colors hover:text-background-tertiary-light/80"
					>
						{breadcrumb.name}
					</a>
				{/if}
			</li>
		{/each}
	</ol>
</nav>

<style>
	.breadcrumb-nav {
		padding-top: 0.5rem;
		padding-bottom: 0.5rem;
	}
</style>