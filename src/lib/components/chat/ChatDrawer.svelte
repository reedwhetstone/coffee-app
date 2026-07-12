<script lang="ts">
	import ChatWorkspace from '$lib/components/chat/ChatWorkspace.svelte';
	import MobileOverlayShell from '$lib/components/layout/MobileOverlayShell.svelte';
	import { checkRole, type UserRole } from '$lib/types/auth.types';

	let {
		open = $bindable(false),
		role,
		ppiAccess
	} = $props<{
		open?: boolean;
		role: UserRole;
		ppiAccess: boolean;
	}>();

	let canUseMallardWorkspaces = $derived(checkRole(role, 'member'));
	let canUseChat = $derived(ppiAccess || canUseMallardWorkspaces);

	// Mount the chat on first open and keep it mounted (hidden) afterwards so
	// the conversation survives closing and reopening the drawer.
	let hasOpened = $state(false);
	$effect(() => {
		if (open) hasOpened = true;
	});
</script>

{#if hasOpened && canUseChat}
	<MobileOverlayShell
		{open}
		variant="drawer"
		onClose={() => (open = false)}
		label="Ask Parchment"
		hideOnDesktop={false}
		keepMounted={true}
	>
		<div class="flex h-full min-h-0 flex-col border-l border-line bg-surface-canvas">
			<div class="flex items-center justify-between border-b border-line px-4 py-2.5">
				<div class="min-w-0">
					<p class="text-sm font-semibold text-ink">Ask Parchment</p>
					<p class="truncate text-xs text-muted">Knows what you're looking at on this page</p>
				</div>
				<div class="flex shrink-0 items-center gap-2">
					<a
						href="/chat"
						class="rounded-md border border-line px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
					>
						Open full workspace
					</a>
					<button
						type="button"
						onclick={() => (open = false)}
						class="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-panel hover:text-ink"
						aria-label="Close Ask Parchment"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
							stroke-width="1.5"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>
			</div>
			<div class="min-h-0 flex-1">
				<ChatWorkspace variant="drawer" {canUseChat} {canUseMallardWorkspaces} />
			</div>
		</div>
	</MobileOverlayShell>
{/if}
