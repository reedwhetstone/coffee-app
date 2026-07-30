<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import {
		getAnalyticsSectionLinks,
		getAuthenticatedNavSections,
		isNavItemActive,
		type NavItem,
		type NavSection
	} from '$lib/components/layout/appNavigation';

	let {
		data,
		onClose = () => {},
		onOpenAccount,
		variant = 'default'
	} = $props<{
		data: Record<string, unknown>;
		onClose?: () => void;
		onOpenAccount?: () => void;
		variant?: 'default' | 'rail';
	}>();

	let currentPath = $state(page.url.pathname);
	let userRole = $derived(
		(((data as { role?: string }).role as UserRole | undefined) ?? 'viewer') as UserRole
	);
	let ppiAccess = $derived(Boolean((data as { ppiAccess?: boolean }).ppiAccess));
	let navSections = $derived(getAuthenticatedNavSections(userRole, { ppiAccess }));
	let canAccessAdminRoutes = $derived(checkRole(userRole, 'admin'));
	let isSignedIn = $derived(Boolean((data as { user?: unknown }).user));
	let isAnalyticsPage = $derived(currentPath.startsWith('/analytics'));
	let analyticsSectionLinks = $derived(
		getAnalyticsSectionLinks({ includeDisclosureIndex: isSignedIn })
	);

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
	<header class="flex items-center justify-between border-b border-line px-5 py-4">
		<div>
			<h2 class="text-lg font-semibold text-ink" id="nav-dialog-title">
				{variant === 'rail' ? 'Menu' : 'Navigation'}
			</h2>
			{#if variant !== 'rail'}
				<p class="mt-1 text-sm text-muted">Mobile and desktop share the same route map now.</p>
			{/if}
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

	<main class="flex-grow overflow-y-auto px-3 py-4">
		<div class={variant === 'rail' ? 'space-y-5' : 'space-y-6'}>
			{#if isAnalyticsPage}
				<section
					class={variant === 'rail' ? '' : 'rounded-lg border border-line bg-surface-panel/40 p-3'}
				>
					<div class={variant === 'rail' ? 'mb-1 px-3' : 'mb-3'}>
						<h3
							class={variant === 'rail'
								? 'text-[11px] font-semibold uppercase tracking-wide text-muted'
								: 'text-xs font-semibold text-ink'}
						>
							On this report
						</h3>
						{#if variant !== 'rail'}
							<p class="mt-1 text-xs text-muted">Jump to a Market Index section.</p>
						{/if}
					</div>
					<ul class={variant === 'rail' ? 'space-y-0.5' : 'space-y-1'}>
						{#each analyticsSectionLinks as link}
							<li>
								<a
									href={link.menuHref}
									onclick={handleNavClick}
									class="block rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-panel hover:text-ink"
								>
									{link.label}
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			{#each navSections as section (section.id)}
				<section>
					<div class={variant === 'rail' ? 'mb-1 px-3' : 'mb-3'}>
						<h3 class="text-[11px] font-semibold uppercase tracking-wide text-muted">
							{section.label}
						</h3>
						{#if variant !== 'rail'}
							<p class="mt-1 text-xs text-muted/80">{sectionIntro(section)}</p>
						{/if}
					</div>
					<ul class={variant === 'rail' ? 'space-y-0.5' : 'space-y-2'}>
						{#each section.items as item (item.href)}
							<li>
								<a
									href={item.locked ? (item.upgradeHref ?? '/subscription') : item.href}
									onclick={handleNavClick}
									onmouseenter={() => handleMouseEnter(item)}
									class="block rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 {isNavItemActive(
										item,
										currentPath
									)
										? variant === 'rail'
											? 'bg-surface-panel font-medium text-ink'
											: 'bg-accent text-ink ring-1 ring-line'
										: item.locked
											? variant === 'rail'
												? 'text-muted opacity-70 hover:bg-surface-panel'
												: 'bg-surface-panel text-muted opacity-70 ring-1 ring-line hover:bg-surface-panel'
											: variant === 'rail'
												? 'text-ink hover:bg-surface-panel'
												: 'bg-surface-panel text-ink ring-1 ring-line hover:bg-accent hover:text-ink'}"
								>
									<div class="flex items-center gap-2 font-medium">
										<span>{item.label}</span>
										{#if item.locked}<svg
												class="h-3.5 w-3.5"
												fill="none"
												viewBox="0 0 24 24"
												stroke-width="1.5"
												stroke="currentColor"
												aria-label="Locked"
												role="img"
												><path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
												/></svg
											>{/if}
									</div>
									{#if item.description && variant !== 'rail'}
										<p class="mt-1 text-xs opacity-80">{item.description}</p>
									{/if}
									{#if item.locked && item.lockedReason && variant !== 'rail'}
										<p class="mt-1 text-[11px] opacity-75">{item.lockedReason}</p>
									{/if}
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/each}

			{#if onOpenAccount}
				<section>
					<div class="mb-1 px-3">
						<h3 class="text-[11px] font-semibold uppercase tracking-wide text-muted">Account</h3>
					</div>
					<button
						type="button"
						onclick={onOpenAccount}
						class="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-panel"
					>
						Account settings
					</button>
				</section>
			{/if}

			{#if canAccessAdminRoutes && variant !== 'rail'}
				<p class="rounded-md border border-line px-3 py-2 text-xs text-muted">
					Admin tools remain grouped separately so the main navigation stays readable on mobile.
				</p>
			{/if}
		</div>
	</main>
</div>
