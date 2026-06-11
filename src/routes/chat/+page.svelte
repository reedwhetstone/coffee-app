<script lang="ts">
	import type { PageData } from './$types';
	import { checkRole } from '$lib/types/auth.types';
	import type { UserRole } from '$lib/types/auth.types';
	import ChatWorkspace from '$lib/components/chat/ChatWorkspace.svelte';

	let { data } = $props<{ data: PageData }>();

	// Destructure with default values to prevent undefined errors
	let { session, role = 'viewer', ppiAccess = false } = $derived(data);

	// User role management
	let userRole: UserRole = $derived(role as UserRole);
	let canUseChat = $derived(Boolean(ppiAccess) || checkRole(userRole, 'member'));
	let canUseMallardWorkspaces = $derived(checkRole(userRole, 'member'));
</script>

<svelte:head>
	<title>Parchment Intelligence Chat | Purveyors</title>
	<meta
		name="description"
		content="Chat with Parchment Intelligence for sourcing, catalog, portfolio, and coffee market guidance."
	/>
</svelte:head>

{#if !session}
	<!-- Unauthenticated state -->
	<div class="flex min-h-screen items-center justify-center bg-background-primary-light">
		<div
			class="mx-auto max-w-md rounded-lg bg-background-secondary-light p-8 text-center shadow-lg"
		>
			<h1 class="mb-4 text-2xl font-bold text-text-primary-light">Parchment Intelligence Chat</h1>
			<p class="mb-6 text-text-secondary-light">
				Sign in to access Parchment Intelligence for sourcing, catalog, portfolio, and coffee market
				guidance.
			</p>
			<a
				href="/auth"
				class="rounded-md bg-background-tertiary-light px-6 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
			>
				Sign in
			</a>
		</div>
	</div>
{:else if !canUseChat}
	<!-- Parchment Intelligence or Mallard Studio access required -->
	<div class="flex min-h-screen items-center justify-center bg-background-primary-light">
		<div
			class="mx-auto max-w-md rounded-lg bg-background-secondary-light p-8 text-center shadow-lg"
		>
			<h1 class="mb-4 text-2xl font-bold text-text-primary-light">Parchment Intelligence Chat</h1>
			<p class="mb-6 text-text-secondary-light">
				Chat is available with Parchment Intelligence or Mallard Studio. Upgrade to ask market,
				catalog, portfolio, and roasting questions with the right tool depth.
			</p>
			<div class="space-y-3">
				<a
					href="/subscription"
					class="block rounded-md bg-background-tertiary-light px-6 py-3 font-medium text-white transition-all duration-200 hover:bg-opacity-90"
				>
					View plans
				</a>
				<a
					href="/"
					class="block rounded-md border border-background-tertiary-light px-6 py-3 text-background-tertiary-light transition-all duration-200 hover:bg-background-tertiary-light hover:text-white"
				>
					Back to Home
				</a>
			</div>
		</div>
	</div>
{:else}
	<ChatWorkspace
		{canUseChat}
		{canUseMallardWorkspaces}
		initialWorkspaceData={data.initialWorkspaceData ?? null}
	/>
{/if}
