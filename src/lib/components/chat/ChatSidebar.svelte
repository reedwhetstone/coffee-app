<script lang="ts">
	import type { Workspace } from '$lib/stores/workspaceStore.svelte';

	type WorkspaceType = Workspace['type'];

	let {
		workspaces,
		currentWorkspaceId,
		collapsed,
		onSwitch,
		onCreate,
		onDelete,
		onRename,
		onCollapsedChange
	} = $props<{
		workspaces: Workspace[];
		currentWorkspaceId: string | null;
		collapsed: boolean;
		onSwitch: (id: string) => void;
		onCreate: (name: string, type: WorkspaceType) => void;
		onDelete: (id: string) => void;
		onRename: (id: string, title: string) => void;
		onCollapsedChange: (collapsed: boolean) => void;
	}>();

	let showCreateForm = $state(false);
	let newName = $state('');
	let newType = $state<WorkspaceType>('general');
	let editingId = $state<string | null>(null);
	let editValue = $state('');

	const typeColors: Record<WorkspaceType, string> = {
		general: 'bg-gray-400',
		sourcing: 'bg-green-500',
		roasting: 'bg-orange-500',
		inventory: 'bg-blue-500',
		analysis: 'bg-purple-500'
	};

	const typeLabels: Record<WorkspaceType, string> = {
		general: 'General',
		sourcing: 'Sourcing',
		roasting: 'Roasting',
		inventory: 'Inventory',
		analysis: 'Analysis'
	};

	function handleCreate() {
		const name = newName.trim() || 'New Workspace';
		onCreate(name, newType);
		newName = '';
		newType = 'general';
		showCreateForm = false;
	}

	function startRename(ws: Workspace) {
		editingId = ws.id;
		editValue = ws.title;
	}

	function saveRename() {
		if (editingId && editValue.trim()) {
			onRename(editingId, editValue.trim());
		}
		editingId = null;
	}

	function toggleCollapsed() {
		const next = !collapsed;
		onCollapsedChange(next);
		try {
			localStorage.setItem('coffee-chat-sidebar-collapsed', String(next));
		} catch {
			// ignore
		}
	}
</script>

<div
	class="flex h-full flex-col border-r border-border-light bg-background-secondary-light transition-all duration-200"
	style="width: {collapsed ? '3rem' : '14rem'};"
>
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border-light px-2 py-2">
		{#if !collapsed}
			<span class="text-xs font-semibold uppercase tracking-wider text-text-secondary-light"
				>Workspaces</span
			>
		{/if}
		<button
			onclick={toggleCollapsed}
			class="rounded p-1 text-text-secondary-light transition-colors hover:text-text-primary-light"
			title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				{#if collapsed}
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				{:else}
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				{/if}
			</svg>
		</button>
	</div>

	<!-- Workspace list -->
	<div class="flex-1 overflow-y-auto py-1">
		{#each workspaces as ws (ws.id)}
			{@const isActive = ws.id === currentWorkspaceId}
			{@const wsType = ws.type as WorkspaceType}
			<div
				role="button"
				tabindex="0"
				onclick={() => onSwitch(ws.id)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') onSwitch(ws.id);
				}}
				class="group flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm transition-colors {isActive
					? 'bg-background-primary-light font-medium text-text-primary-light'
					: 'text-text-secondary-light hover:bg-background-primary-light/50 hover:text-text-primary-light'}"
				title={collapsed ? `${ws.title} (${typeLabels[wsType]})` : ''}
			>
				<!-- Type dot -->
				<span class="h-2 w-2 shrink-0 rounded-full {typeColors[wsType]}"></span>

				{#if !collapsed}
					{#if editingId === ws.id}
						<input
							type="text"
							bind:value={editValue}
							onblur={saveRename}
							onkeydown={(e) => {
								if (e.key === 'Enter') saveRename();
								if (e.key === 'Escape') editingId = null;
							}}
							onclick={(e) => e.stopPropagation()}
							class="min-w-0 flex-1 rounded border border-border-light bg-transparent px-1 text-sm focus:outline-none"
						/>
					{:else}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<span class="min-w-0 flex-1 truncate" ondblclick={() => startRename(ws)}>
							{ws.title}
						</span>
					{/if}

					<!-- Delete button (hover-visible) -->
					<button
						onclick={(e) => {
							e.stopPropagation();
							onDelete(ws.id);
						}}
						class="shrink-0 rounded p-0.5 text-text-secondary-light opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
						title="Delete workspace"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Footer: New workspace -->
	<div class="border-t border-border-light p-2">
		{#if showCreateForm && !collapsed}
			<div class="space-y-2">
				<input
					type="text"
					bind:value={newName}
					placeholder="Workspace name"
					class="w-full rounded border border-border-light bg-background-primary-light px-2 py-1 text-sm text-text-primary-light placeholder-text-secondary-light focus:border-background-tertiary-light focus:outline-none"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleCreate();
						if (e.key === 'Escape') showCreateForm = false;
					}}
				/>
				<select
					bind:value={newType}
					class="w-full rounded border border-border-light bg-background-primary-light px-2 py-1 text-sm text-text-primary-light focus:border-background-tertiary-light focus:outline-none"
				>
					<option value="general">General</option>
					<option value="sourcing">Sourcing</option>
					<option value="roasting">Roasting</option>
					<option value="inventory">Inventory</option>
					<option value="analysis">Analysis</option>
				</select>
				<div class="flex gap-1">
					<button
						onclick={handleCreate}
						class="flex-1 rounded bg-background-tertiary-light px-2 py-1 text-xs font-medium text-white transition-all hover:bg-opacity-90"
					>
						Create
					</button>
					<button
						onclick={() => (showCreateForm = false)}
						class="flex-1 rounded border border-border-light px-2 py-1 text-xs text-text-secondary-light transition-all hover:text-text-primary-light"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<button
				onclick={() => {
					if (collapsed) {
						onCollapsedChange(false);
						try {
							localStorage.setItem('coffee-chat-sidebar-collapsed', 'false');
						} catch {
							/* ignore */
						}
					}
					showCreateForm = true;
				}}
				class="flex w-full items-center justify-center gap-1.5 rounded px-2 py-1.5 text-sm text-text-secondary-light transition-colors hover:bg-background-primary-light hover:text-text-primary-light"
				title="New workspace"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				{#if !collapsed}
					<span>New Workspace</span>
				{/if}
			</button>
		{/if}
	</div>
</div>
