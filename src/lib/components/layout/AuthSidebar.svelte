<!-- src/lib/components/layout/AuthSidebar.svelte -->
<script lang="ts">
	import { signInWithGoogle, createClient } from '$lib/supabase';
	import { goto } from '$app/navigation';

	import type { User } from '@supabase/supabase-js';

	// Props with default values to prevent undefined errors
	let { data, onClose = () => {} } = $props<{
		data: Record<string, unknown>;
		onClose?: () => void;
	}>();

	// Destructure with default values
	let { supabase, user } = $derived(
		data as { supabase: ReturnType<typeof createClient>; user: User | null }
	);

	async function handleSignIn() {
		try {
			await signInWithGoogle(supabase);
		} catch (error) {
			console.error('Error signing in:', error);
		}
	}

	async function handleSignOut() {
		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			// Force a page reload to clear any cached state
			window.location.href = '/';
		} catch (error) {
			console.error('Error signing out:', error);
		}
	}

	function navigateToSubscription() {
		onClose();
		goto('/subscription');
	}
</script>

<!-- Authentication menu panel - full height -->
<div class="flex h-full flex-col">
	<!-- Header with close button that handles keyboard events -->
	<header class="flex items-center justify-between border-b border-line p-4">
		<h2 class="text-lg font-semibold text-ink" id="auth-dialog-title">Account</h2>
		<button
			onclick={(e) => {
				e.stopPropagation();
				onClose();
			}}
			onkeydown={(e) => e.key === 'Escape' && onClose()}
			class="p-2 hover:opacity-80"
			aria-label="Close authentication panel"
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
		{#if user}
			<div class="mb-4">
				<h3 class="mb-2 font-medium text-ink">Signed in as:</h3>
				<p class="mb-4 text-sm text-muted">{user.email}</p>

				<button
					onclick={handleSignOut}
					class="w-full rounded-md border border-danger px-4 py-2 text-left text-sm text-danger transition-all duration-200 hover:bg-danger hover:text-white"
				>
					Sign out
				</button>
			</div>
		{:else}
			<div class="mb-4">
				<h3 class="mb-2 font-medium text-ink">Not signed in</h3>
				<p class="mb-4 text-sm text-muted">Sign in to access your account</p>

				<button
					onclick={handleSignIn}
					class="w-full rounded-md bg-accent px-4 py-2 text-left text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
				>
					Sign in with Google
				</button>
			</div>
		{/if}
		<button
			onclick={navigateToSubscription}
			class="mb-3 w-full rounded-md border border-accent px-4 py-2 text-left text-sm text-accent transition-all duration-200 hover:bg-accent hover:text-ink"
		>
			Subscription
		</button>
	</main>
</div>
