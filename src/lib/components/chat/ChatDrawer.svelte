<script lang="ts">
	import ChatWorkspace from '$lib/components/chat/ChatWorkspace.svelte';
	import MobileOverlayShell from '$lib/components/layout/MobileOverlayShell.svelte';
	import { checkRole, type UserRole } from '$lib/types/auth.types';
	import { resolveCherryAgent } from '$lib/cherry/identity';

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
	let agent = $derived(resolveCherryAgent({ ppiAccess, memberAccess: canUseMallardWorkspaces }));

	// Mount the chat on first open and keep it mounted (hidden) afterwards so
	// the conversation survives closing and reopening the drawer.
	let hasOpened = $state(false);
	$effect(() => {
		if (open) hasOpened = true;
	});
</script>

{#if hasOpened && canUseChat && agent}
	<MobileOverlayShell
		{open}
		variant="drawer"
		onClose={() => (open = false)}
		label={agent.name}
		hideOnDesktop={false}
		keepMounted={true}
	>
		<ChatWorkspace
			variant="drawer"
			{canUseChat}
			{canUseMallardWorkspaces}
			agentName={agent.name}
			onCloseDrawer={() => (open = false)}
		/>
	</MobileOverlayShell>
{/if}
