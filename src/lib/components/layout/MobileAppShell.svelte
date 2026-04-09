<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import Actionsbar from '$lib/components/layout/Actionsbar.svelte';
	import Settingsbar from '$lib/components/layout/Settingsbar.svelte';
	import MobileOverlayShell from '$lib/components/layout/MobileOverlayShell.svelte';
	import MobileAppMenu from '$lib/components/layout/MobileAppMenu.svelte';
	import { getCurrentRouteLabel } from '$lib/components/layout/appNavigation';

	let { data } = $props<{
		data: Record<string, unknown>;
	}>();

	let currentPath = $state(page.url.pathname);
	let activeOverlay = $state<null | 'menu' | 'actions' | 'settings'>(null);

	let userRole = $derived(((data?.role as UserRole | undefined) ?? 'viewer') as UserRole);
	let canUseActions = $derived(checkRole(userRole, 'member'));
	let showSettings = $derived(['/catalog', '/beans', '/roast', '/profit'].includes(currentPath));
	let routeLabel = $derived(getCurrentRouteLabel(currentPath, userRole));

	$effect(() => {
		const nextPath = page.url.pathname;
		if (nextPath !== currentPath) {
			currentPath = nextPath;
			activeOverlay = null;
		}
	});

	function closeOverlay() {
		activeOverlay = null;
	}
</script>

<div
	class="fixed inset-x-0 top-0 z-30 border-b border-border-light bg-background-primary-light/95 backdrop-blur md:hidden"
>
	<div class="flex items-center justify-between gap-3 px-4 py-3">
		<div class="flex min-w-0 items-center gap-3">
			<button
				type="button"
				onclick={() => (activeOverlay = 'menu')}
				class="rounded-full p-2 text-text-secondary-light transition-colors hover:bg-background-secondary-light hover:text-text-primary-light"
				aria-label="Open app menu"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.8"
						d="M4 7h16M4 12h16M4 17h16"
					></path>
				</svg>
			</button>

			<button
				type="button"
				onclick={() => goto('/dashboard')}
				class="flex items-center gap-3 text-left transition-opacity hover:opacity-90"
			>
				<img src="/purveyors_logo_mark.svg" alt="purveyors.io" class="h-8 w-auto" />
				<div class="min-w-0">
					<p class="truncate text-sm font-semibold text-text-primary-light">{routeLabel}</p>
					<p class="truncate text-xs text-text-secondary-light">Mobile workspace shell</p>
				</div>
			</button>
		</div>

		<div class="flex items-center gap-1.5">
			{#if showSettings}
				<button
					type="button"
					onclick={() => (activeOverlay = 'settings')}
					class="rounded-full p-2 text-text-secondary-light transition-colors hover:bg-background-secondary-light hover:text-text-primary-light"
					aria-label="Open filters"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.8"
							d="M4 6h10M18 6h2M10 12h10M4 12h2M4 18h14M20 18h0"
						></path>
						<circle cx="16" cy="6" r="2" fill="currentColor"></circle>
						<circle cx="8" cy="12" r="2" fill="currentColor"></circle>
						<circle cx="18" cy="18" r="2" fill="currentColor"></circle>
					</svg>
				</button>
			{/if}

			{#if canUseActions}
				<button
					type="button"
					onclick={() => (activeOverlay = 'actions')}
					class="rounded-full bg-background-tertiary-light p-2 text-white shadow-sm transition-opacity hover:opacity-90"
					aria-label="Open actions"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1.8"
							d="M12 5v14M5 12h14"
						></path>
					</svg>
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
	labelledBy="app-menu-dialog-title"
>
	<MobileAppMenu {data} onClose={closeOverlay} />
</MobileOverlayShell>

<MobileOverlayShell
	open={activeOverlay === 'settings'}
	variant="sheet"
	onClose={closeOverlay}
	label="Filters"
	labelledBy="filters-dialog-title"
>
	<Settingsbar {data} isOpen={true} onClose={closeOverlay} />
</MobileOverlayShell>

<MobileOverlayShell
	open={activeOverlay === 'actions'}
	variant="sheet"
	onClose={closeOverlay}
	label="Actions"
	labelledBy="actions-dialog-title"
>
	<Actionsbar {data} onClose={closeOverlay} />
</MobileOverlayShell>
