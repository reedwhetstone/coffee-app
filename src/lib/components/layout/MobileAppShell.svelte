<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { filterStore } from '$lib/stores/filterStore';
	import type { PageAuthView } from '$lib/types/auth.types';
	import { canManagePortfolio } from '$lib/services/portfolioAccess';
	import Actionsbar from '$lib/components/layout/Actionsbar.svelte';
	import Settingsbar from '$lib/components/layout/Settingsbar.svelte';
	import Navbar from '$lib/components/layout/Navbar.svelte';
	import AuthSidebar from '$lib/components/layout/AuthSidebar.svelte';
	import DesktopShellIcon from '$lib/components/layout/DesktopShellIcon.svelte';
	import PurveyorsCircleMark from '$lib/components/layout/PurveyorsCircleMark.svelte';
	import MobileOverlayShell from '$lib/components/layout/MobileOverlayShell.svelte';
	import { getCurrentRouteLabel } from '$lib/components/layout/appNavigation';
	import { countActiveCatalogFilters } from '$lib/components/layout/desktopShellState';

	let { data } = $props<{
		data: Record<string, unknown>;
	}>();

	let currentPath = $state(page.url.pathname);
	let trackedCatalogRoute = $state(Boolean((page.data as { trackedOnly?: boolean }).trackedOnly));
	let activeOverlay = $state<null | 'menu' | 'actions' | 'settings' | 'auth'>(null);

	let auth = $derived((data as { auth: PageAuthView }).auth);
	let userRole = $derived(auth.role);
	let ppiAccess = $derived(auth.ppiAccess);
	let canUseActions = $derived(canManagePortfolio(userRole, ppiAccess));
	let showSettings = $derived(
		['/catalog', '/beans', '/roast'].includes(currentPath) && !trackedCatalogRoute
	);
	let routeLabel = $derived(getCurrentRouteLabel(currentPath, userRole, { ppiAccess }));
	let activeFilterCount = $derived(
		$filterStore.routeId === currentPath
			? countActiveCatalogFilters({ ...$filterStore, routeId: currentPath })
			: 0
	);

	$effect(() => {
		const nextPath = page.url.pathname;
		if (nextPath !== currentPath) {
			currentPath = nextPath;
			activeOverlay = null;
		}

		const nextTrackedCatalogRoute = Boolean((page.data as { trackedOnly?: boolean }).trackedOnly);
		if (nextTrackedCatalogRoute !== trackedCatalogRoute) {
			trackedCatalogRoute = nextTrackedCatalogRoute;
			activeOverlay = null;
		}
	});

	function closeOverlay() {
		activeOverlay = null;
	}

	function openAccount() {
		activeOverlay = 'auth';
	}
</script>

<div
	class="fixed inset-x-0 top-0 z-30 border-b border-line bg-surface-canvas/95 backdrop-blur md:hidden"
>
	<div class="flex h-16 items-center justify-between gap-2 px-3">
		<div class="flex min-w-0 items-center gap-2">
			<button
				type="button"
				onclick={() => (activeOverlay = 'menu')}
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-panel hover:text-ink"
				aria-label="Open app menu"
			>
				<PurveyorsCircleMark />
			</button>

			<button
				type="button"
				onclick={() => goto('/dashboard')}
				class="min-w-0 rounded-md px-1.5 py-2 text-left transition-colors hover:bg-surface-panel"
			>
				<p class="truncate text-sm font-semibold text-ink">{routeLabel}</p>
			</button>
		</div>

		<div class="flex shrink-0 items-center gap-1">
			<button
				type="button"
				onclick={() => goto('/chat')}
				class="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-panel text-ink ring-1 ring-accent/50 transition-colors hover:bg-accent/15"
				style="box-shadow: 0 0 18px rgba(249, 165, 123, 0.42);"
				aria-label="Open chat"
			>
				<DesktopShellIcon name="chat" />
			</button>

			{#if showSettings}
				<button
					type="button"
					onclick={() => (activeOverlay = 'settings')}
					class="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-panel hover:text-ink"
					aria-label="Open filters"
				>
					<DesktopShellIcon name="filters" />
					{#if activeFilterCount > 0}
						<span
							class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-ink"
							aria-label={`${activeFilterCount} active filters`}>{activeFilterCount}</span
						>
					{/if}
				</button>
			{/if}

			{#if canUseActions}
				<button
					type="button"
					onclick={() => (activeOverlay = 'actions')}
					class="flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-panel hover:text-ink"
					aria-label="Open actions"
				>
					<DesktopShellIcon name="actions" />
				</button>
			{/if}
		</div>
	</div>
</div>

<MobileOverlayShell
	open={activeOverlay === 'menu'}
	variant="full"
	onClose={closeOverlay}
	label="App menu"
	labelledBy="nav-dialog-title"
>
	<Navbar {data} onClose={closeOverlay} onOpenAccount={openAccount} variant="rail" />
</MobileOverlayShell>

<MobileOverlayShell
	open={activeOverlay === 'settings'}
	variant="sheet"
	onClose={closeOverlay}
	label="Filters"
	labelledBy="filters-dialog-title"
>
	<Settingsbar {data} isOpen={true} onClose={closeOverlay} variant="rail" />
</MobileOverlayShell>

<MobileOverlayShell
	open={activeOverlay === 'actions'}
	variant="sheet"
	onClose={closeOverlay}
	label="Actions"
	labelledBy="actions-dialog-title"
>
	<Actionsbar {data} onClose={closeOverlay} variant="rail" />
</MobileOverlayShell>

<MobileOverlayShell
	open={activeOverlay === 'auth'}
	variant="sheet"
	onClose={closeOverlay}
	label="Account"
	labelledBy="auth-dialog-title"
>
	<AuthSidebar {data} onClose={closeOverlay} variant="rail" />
</MobileOverlayShell>
