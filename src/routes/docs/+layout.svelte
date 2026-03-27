<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';

	let { children } = $props<{ children: Snippet }>();

	let currentPath = $derived(page.url.pathname);

	const apiNav = [
		{ href: '/docs/api/overview', label: 'Overview' },
		{ href: '/docs/api/catalog', label: 'Catalog API' },
		{ href: '/docs/api/analytics', label: 'Analytics' },
		{ href: '/docs/api/roast-profiles', label: 'Roast Profiles' },
		{ href: '/docs/api/inventory', label: 'Inventory' },
		{ href: '/docs/api/errors', label: 'Errors and Rate Limits' }
	];

	const cliNav = [
		{ href: '/docs/cli/overview', label: 'Overview' },
		{ href: '/docs/cli/catalog', label: 'Catalog' },
		{ href: '/docs/cli/inventory', label: 'Inventory' },
		{ href: '/docs/cli/roast', label: 'Roast' },
		{ href: '/docs/cli/sales', label: 'Sales' },
		{ href: '/docs/cli/tasting', label: 'Tasting' },
		{ href: '/docs/cli/agent-integration', label: 'Agent Integration' }
	];

	function isActive(href: string): boolean {
		return currentPath === href;
	}
</script>

<div class="min-h-screen bg-background-primary-light">
	<div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
		<div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
			<!-- Sidebar navigation -->
			<div class="lg:col-span-1">
				<nav class="sticky top-8 space-y-6">
					<div>
						<div class="mb-2 flex items-center gap-2">
							<span class="text-xs font-semibold uppercase tracking-wider text-text-secondary-light"
								>Platform</span
							>
						</div>
						<ul class="space-y-1">
							<li>
								<button
									onclick={() => goto('/docs')}
									class="w-full rounded px-3 py-1.5 text-left text-sm transition-colors duration-150 {currentPath ===
									'/docs'
										? 'bg-background-tertiary-light/10 font-medium text-background-tertiary-light'
										: 'text-text-secondary-light hover:text-text-primary-light'}"
								>
									Introduction
								</button>
							</li>
						</ul>
					</div>

					<!-- API section -->
					<div>
						<div class="mb-2 flex items-center gap-2">
							<span class="text-xs font-semibold uppercase tracking-wider text-text-secondary-light"
								>REST API</span
							>
						</div>
						<ul class="space-y-1">
							{#each apiNav as item}
								<li>
									<button
										onclick={() => goto(item.href)}
										class="w-full rounded px-3 py-1.5 text-left text-sm transition-colors duration-150 {isActive(
											item.href
										)
											? 'bg-background-tertiary-light/10 font-medium text-background-tertiary-light'
											: 'text-text-secondary-light hover:text-text-primary-light'}"
									>
										{item.label}
									</button>
								</li>
							{/each}
						</ul>
					</div>

					<!-- CLI section -->
					<div>
						<div class="mb-2 flex items-center gap-2">
							<span class="text-xs font-semibold uppercase tracking-wider text-text-secondary-light"
								>CLI</span
							>
						</div>
						<ul class="space-y-1">
							{#each cliNav as item}
								<li>
									<button
										onclick={() => goto(item.href)}
										class="w-full rounded px-3 py-1.5 text-left text-sm transition-colors duration-150 {isActive(
											item.href
										)
											? 'bg-background-tertiary-light/10 font-medium text-background-tertiary-light'
											: 'text-text-secondary-light hover:text-text-primary-light'}"
									>
										{item.label}
									</button>
								</li>
							{/each}
						</ul>
					</div>

					<!-- External links -->
					<div class="border-t border-border-light pt-4">
						<ul class="space-y-1">
							<li>
								<a
									href="/api"
									class="flex items-center gap-1 rounded px-3 py-1.5 text-sm text-text-secondary-light transition-colors duration-150 hover:text-text-primary-light"
								>
									Parchment API
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
										/>
									</svg>
								</a>
							</li>
							<li>
								<a
									href="/api-dashboard/keys"
									class="flex items-center gap-1 rounded px-3 py-1.5 text-sm text-text-secondary-light transition-colors duration-150 hover:text-text-primary-light"
								>
									API Key Management
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
										/>
									</svg>
								</a>
							</li>
						</ul>
					</div>
				</nav>
			</div>

			<!-- Main content -->
			<div class="min-w-0 lg:col-span-3">
				{@render children()}
			</div>
		</div>
	</div>
</div>
