<script lang="ts">
	import ChatWorkspace from '$lib/components/chat/ChatWorkspace.svelte';
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

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			open = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open && canUseChat}
	<aside
		class="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border-light bg-background-primary-light shadow-xl md:w-[32rem]"
		aria-label="Ask Parchment"
	>
		<div class="flex items-center justify-between border-b border-border-light px-4 py-2.5">
			<div class="min-w-0">
				<p class="text-sm font-semibold text-text-primary-light">Ask Parchment</p>
				<p class="truncate text-xs text-text-secondary-light">
					Knows what you're looking at on this page
				</p>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				<a
					href="/chat"
					class="rounded-md border border-border-light px-2 py-1 text-xs text-text-secondary-light transition-colors hover:text-text-primary-light"
				>
					Open full workspace
				</a>
				<button
					type="button"
					onclick={() => (open = false)}
					class="rounded-md p-1.5 text-text-secondary-light transition-colors hover:bg-background-secondary-light hover:text-text-primary-light"
					aria-label="Close Ask Parchment"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</div>
		<div class="min-h-0 flex-1">
			<ChatWorkspace variant="drawer" {canUseChat} {canUseMallardWorkspaces} />
		</div>
	</aside>
{/if}
