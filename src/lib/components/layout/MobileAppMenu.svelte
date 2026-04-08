<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import { workspaceStore, type Workspace } from '$lib/stores/workspaceStore.svelte';
	import {
		getAuthenticatedNavSections,
		isNavItemActive
	} from '$lib/components/layout/appNavigation';

	let { data, onClose = () => {} } = $props<{
		data: Record<string, unknown>;
		onClose?: () => void;
	}>();

	let pathname = $derived(page.url.pathname);
	let userRole = $derived(((data?.role as UserRole | undefined) ?? 'viewer') as UserRole);
	let userEmail = $derived(((data?.user as { email?: string } | undefined)?.email ?? '') as string);
	let supabase = $derived(
		(
			data as {
				supabase?: {
					auth: {
						signOut: () => Promise<{ error?: Error | null }>;
					};
				};
			}
		).supabase
	);
	let isMember = $derived(checkRole(userRole, 'member'));
	let navSections = $derived(getAuthenticatedNavSections(userRole));

	let showCreateForm = $state(false);
	let newWorkspaceName = $state('');
	let newWorkspaceType = $state<Workspace['type']>('general');
	let workspacesBootstrapped = $state(false);

	onMount(async () => {
		if (!isMember) return;

		if (!workspaceStore.workspaces.length && !workspaceStore.loading) {
			await workspaceStore.loadWorkspaces();
		}

		if (!workspaceStore.currentWorkspaceId && workspaceStore.workspaces.length > 0) {
			const persistedId = workspaceStore.getPersistedWorkspaceId();
			const targetId =
				persistedId && workspaceStore.workspaces.some((workspace) => workspace.id === persistedId)
					? persistedId
					: workspaceStore.workspaces[0].id;
			await workspaceStore.activateWorkspace(targetId);
		}

		workspacesBootstrapped = true;
	});

	async function navigateTo(href: string) {
		onClose();
		await goto(href);
	}

	async function handleWorkspaceSelect(workspaceId: string) {
		const switched = await workspaceStore.activateWorkspace(workspaceId);
		if (!switched) return;

		onClose();

		if (pathname !== '/chat') {
			await goto('/chat');
		}
	}

	async function handleCreateWorkspace() {
		const createdWorkspace = await workspaceStore.createAndActivateWorkspace(
			newWorkspaceName,
			newWorkspaceType
		);
		if (!createdWorkspace) return;

		newWorkspaceName = '';
		newWorkspaceType = 'general';
		showCreateForm = false;
		onClose();

		if (pathname !== '/chat') {
			await goto('/chat');
		}
	}

	async function handleSignOut() {
		try {
			if (!supabase) {
				window.location.href = '/';
				return;
			}

			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			window.location.href = '/';
		} catch (error) {
			console.error('Error signing out:', error);
		}
	}

	const workspaceTypeOptions: Array<{ value: Workspace['type']; label: string }> = [
		{ value: 'general', label: 'General' },
		{ value: 'sourcing', label: 'Sourcing' },
		{ value: 'roasting', label: 'Roasting' },
		{ value: 'inventory', label: 'Inventory' },
		{ value: 'analysis', label: 'Analysis' }
	];

	const workspaceToneClasses: Record<Workspace['type'], string> = {
		general: 'bg-slate-400',
		sourcing: 'bg-emerald-500',
		roasting: 'bg-amber-500',
		inventory: 'bg-sky-500',
		analysis: 'bg-violet-500'
	};
</script>

<div class="flex h-full flex-col">
	<header class="flex items-center justify-between border-b border-border-light px-4 py-4">
		<div>
			<p class="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary-light">
				Purveyors
			</p>
			<h2 class="mt-1 text-lg font-semibold text-text-primary-light" id="app-menu-dialog-title">
				App menu
			</h2>
		</div>
		<button
			type="button"
			onclick={onClose}
			class="rounded-full p-2 text-text-secondary-light transition-colors hover:bg-background-secondary-light hover:text-text-primary-light"
			aria-label="Close app menu"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.8"
					d="M6 18 18 6M6 6l12 12"
				></path>
			</svg>
		</button>
	</header>

	<div class="flex-1 overflow-y-auto px-4 pb-6 pt-4">
		<div class="space-y-6">
			<section class="rounded-2xl border border-border-light bg-background-secondary-light/60 p-4">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary-light">
							Signed in
						</p>
						<p class="mt-1 text-sm font-medium text-text-primary-light">
							{userEmail || 'Purveyors member'}
						</p>
					</div>
					<button
						type="button"
						onclick={handleSignOut}
						class="rounded-full border border-border-light px-3 py-1.5 text-xs font-medium text-text-secondary-light transition-colors hover:border-red-300 hover:text-red-500"
					>
						Sign out
					</button>
				</div>

				<div class="mt-4 grid grid-cols-2 gap-2">
					<button
						type="button"
						onclick={() => navigateTo('/subscription')}
						class="rounded-xl bg-background-primary-light px-3 py-3 text-left text-sm font-medium text-text-primary-light ring-1 ring-border-light transition-colors hover:bg-background-secondary-light"
					>
						Subscription
					</button>
					<button
						type="button"
						onclick={() => navigateTo('/contact')}
						class="rounded-xl bg-background-primary-light px-3 py-3 text-left text-sm font-medium text-text-primary-light ring-1 ring-border-light transition-colors hover:bg-background-secondary-light"
					>
						Contact
					</button>
				</div>
			</section>

			{#if isMember}
				<section
					class="space-y-3 rounded-2xl border border-border-light bg-background-secondary-light/40 p-4"
				>
					<div class="flex items-center justify-between gap-3">
						<div>
							<h3 class="text-sm font-semibold text-text-primary-light">Workspaces</h3>
							<p class="mt-1 text-xs text-text-secondary-light">
								Switch chat context without a dedicated sidebar button.
							</p>
						</div>
						<button
							type="button"
							onclick={() => navigateTo('/chat')}
							class="rounded-full border border-border-light px-3 py-1.5 text-xs font-medium text-text-secondary-light transition-colors hover:text-text-primary-light"
						>
							Open Chat
						</button>
					</div>

					{#if workspaceStore.loading && !workspacesBootstrapped}
						<div
							class="rounded-xl border border-dashed border-border-light px-4 py-6 text-center text-sm text-text-secondary-light"
						>
							Loading workspaces...
						</div>
					{:else if workspaceStore.workspaces.length > 0}
						<div class="space-y-2">
							{#each workspaceStore.workspaces as workspace (workspace.id)}
								{@const isActive = workspace.id === workspaceStore.currentWorkspaceId}
								<button
									type="button"
									onclick={() => handleWorkspaceSelect(workspace.id)}
									class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left ring-1 ring-border-light transition-colors {isActive
										? 'bg-background-primary-light text-text-primary-light'
										: 'bg-background-primary-light/70 text-text-secondary-light hover:text-text-primary-light'}"
								>
									<span
										class="h-2.5 w-2.5 shrink-0 rounded-full {workspaceToneClasses[workspace.type]}"
									></span>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-sm font-medium">{workspace.title}</span>
										<span class="mt-1 block text-xs text-text-secondary-light">
											{workspace.type}
										</span>
									</span>
									{#if isActive}
										<span
											class="rounded-full bg-background-tertiary-light/15 px-2 py-1 text-[11px] font-semibold text-background-tertiary-light"
										>
											Active
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{:else}
						<div
							class="rounded-xl border border-dashed border-border-light px-4 py-5 text-sm text-text-secondary-light"
						>
							No workspaces yet. Create one to start a focused Coffee Chat session.
						</div>
					{/if}

					{#if showCreateForm}
						<div
							class="space-y-2 rounded-xl border border-border-light bg-background-primary-light p-3"
						>
							<input
								type="text"
								bind:value={newWorkspaceName}
								placeholder="Workspace name"
								class="w-full rounded-lg border border-border-light bg-background-secondary-light px-3 py-2 text-sm text-text-primary-light placeholder-text-secondary-light focus:border-background-tertiary-light focus:outline-none"
								onkeydown={(event) => {
									if (event.key === 'Enter') handleCreateWorkspace();
									if (event.key === 'Escape') showCreateForm = false;
								}}
							/>
							<select
								bind:value={newWorkspaceType}
								class="w-full rounded-lg border border-border-light bg-background-secondary-light px-3 py-2 text-sm text-text-primary-light focus:border-background-tertiary-light focus:outline-none"
							>
								{#each workspaceTypeOptions as option}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
							<div class="flex gap-2">
								<button
									type="button"
									onclick={handleCreateWorkspace}
									class="flex-1 rounded-lg bg-background-tertiary-light px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
								>
									Create workspace
								</button>
								<button
									type="button"
									onclick={() => (showCreateForm = false)}
									class="rounded-lg border border-border-light px-3 py-2 text-sm font-medium text-text-secondary-light transition-colors hover:text-text-primary-light"
								>
									Cancel
								</button>
							</div>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => (showCreateForm = true)}
							class="w-full rounded-xl border border-dashed border-border-light px-4 py-3 text-left text-sm font-medium text-text-secondary-light transition-colors hover:border-background-tertiary-light hover:text-text-primary-light"
						>
							+ Create workspace
						</button>
					{/if}
				</section>
			{/if}

			{#each navSections as section (section.id)}
				<section class="space-y-3">
					<div>
						<h3 class="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary-light">
							{section.label}
						</h3>
					</div>
					<div class="space-y-2">
						{#each section.items as item (item.href)}
							<button
								type="button"
								onclick={() => navigateTo(item.href)}
								class="block w-full rounded-2xl border px-4 py-3 text-left transition-colors {isNavItemActive(
									item,
									pathname
								)
									? 'border-background-tertiary-light bg-background-tertiary-light/10 text-text-primary-light'
									: 'border-border-light bg-background-secondary-light/50 text-text-primary-light hover:bg-background-secondary-light'}"
							>
								<div class="flex items-start justify-between gap-3">
									<div>
										<div class="text-sm font-medium">{item.label}</div>
										{#if item.description}
											<p class="mt-1 text-xs text-text-secondary-light">{item.description}</p>
										{/if}
									</div>
									<svg
										class="mt-0.5 h-4 w-4 shrink-0 text-text-secondary-light"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="1.8"
											d="m9 6 6 6-6 6"
										></path>
									</svg>
								</div>
							</button>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	</div>
</div>
