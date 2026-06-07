<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import {
		getAuthenticatedNavSections,
		isNavItemActive,
		type NavItem,
		type NavSection
	} from '$lib/components/layout/appNavigation';

	let { data, onClose = () => {} } = $props<{
		data: Record<string, unknown>;
		onClose?: () => void;
	}>();

	let currentPath = $state(page.url.pathname);
	let userRole = $derived(
		(((data as { role?: string }).role as UserRole | undefined) ?? 'viewer') as UserRole
	);
	let ppiAccess = $derived(Boolean((data as { ppiAccess?: boolean }).ppiAccess));
	let navSections = $derived(getAuthenticatedNavSections(userRole, { ppiAccess }));
	let canAccessAdminRoutes = $derived(checkRole(userRole, 'admin'));

	afterNavigate(() => {
		currentPath = page.url.pathname;
	});

	function handleNavClick() {
		onClose();
	}

	const preloadCache = new Set<string>();

	async function preloadRouteData(route: string) {
		if (preloadCache.has(route)) return;
		preloadCache.add(route);

		try {
			if (route === '/beans') {
				await fetch('/api/beans');
			} else if (route === '/roast') {
				await fetch('/api/roast-profiles');
			}
		} catch (error) {
			console.log('Preload failed for', route, ':', error);
			preloadCache.delete(route);
		}
	}

	function handleMouseEnter(item: NavItem) {
		if (item.href === '/beans' || item.href === '/roast') {
			void preloadRouteData(item.href);
		}
	}

	function sectionIntro(section: NavSection): string {
		switch (section.id) {
			case 'parchment':
				return 'Market intelligence and sourcing decisions';
			case 'portfolio':
				return 'Saved, purchased, and owned coffees';
			case 'maillard':
				return 'Roasting add-on workflows';
			case 'developer':
				return 'API, docs, and machine access';
			case 'admin':
				return 'Administration';
		}
	}
</script>

<div class="flex h-full flex-col">
	<header
		class="flex items-center justify-between border-b border-text-primary-light border-opacity-20 p-4"
	>
		<div>
			<h2 class="text-lg font-semibold text-text-primary-light" id="nav-dialog-title">
				Navigation
			</h2>
			<p class="mt-1 text-sm text-text-secondary-light">
				Mobile and desktop share the same route map now.
			</p>
		</div>
		<button
			onclick={(event) => {
				event.stopPropagation();
				onClose();
			}}
			onkeydown={(event) => event.key === 'Escape' && onClose()}
			class="p-2 hover:opacity-80"
			aria-label="Close navigation panel"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					fill-rule="evenodd"
					d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>
	</header>

	<main class="flex-grow overflow-y-auto p-4">
		<div class="space-y-6">
			{#each navSections as section (section.id)}
				<section>
					<div class="mb-3">
						<h3 class="text-xs font-semibold uppercase tracking-wide text-text-secondary-light">
							{section.label}
						</h3>
						<p class="mt-1 text-xs text-text-secondary-light/80">{sectionIntro(section)}</p>
					</div>
					<ul class="space-y-2">
						{#each section.items as item (item.href)}
							<li>
								<a
									href={item.locked ? (item.upgradeHref ?? '/subscription') : item.href}
									onclick={handleNavClick}
									onmouseenter={() => handleMouseEnter(item)}
									class="block rounded-md px-3 py-2 text-left text-sm ring-1 ring-border-light transition-all duration-200 {isNavItemActive(
										item,
										currentPath
									)
										? 'bg-background-tertiary-light text-white'
										: item.locked
											? 'bg-background-secondary-light text-text-secondary-light opacity-70 hover:bg-background-secondary-light'
											: 'bg-background-secondary-light text-text-primary-light hover:bg-background-tertiary-light hover:text-white'}"
								>
									<div class="flex items-center gap-2 font-medium">
										<span>{item.label}</span>
										{#if item.locked}<span aria-label="Locked">🔒</span>{/if}
									</div>
									{#if item.description}
										<p class="mt-1 text-xs opacity-80">{item.description}</p>
									{/if}
									{#if item.locked && item.lockedReason}
										<p class="mt-1 text-[11px] opacity-75">{item.lockedReason}</p>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}

			{#if canAccessAdminRoutes}
				<p
					class="rounded-md border border-border-light px-3 py-2 text-xs text-text-secondary-light"
				>
					Admin tools remain grouped separately so the main navigation stays readable on mobile.
				</p>
			{/if}
		</div>
	</main>
</div>
