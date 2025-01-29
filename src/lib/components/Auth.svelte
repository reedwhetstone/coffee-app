<script lang="ts">
	import { signInWithGoogle, signOut } from '$lib/auth/supabase';
	import { auth } from '$lib/stores/auth';

	async function handleSignIn() {
		const { error } = await signInWithGoogle();
		if (error) {
			console.error('Error signing in:', error.message);
		}
	}

	async function handleSignOut() {
		const { error } = await signOut();
		if (error) {
			console.error('Error signing out:', error.message);
		}
	}
</script>

<div class="flex gap-4">
	{#if $auth.session?.user}
		<button
			on:click={handleSignOut}
			class="rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
		>
			Sign Out
		</button>
	{:else}
		<button
			on:click={handleSignIn}
			class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
		>
			Sign in with Google
		</button>
	{/if}
</div>
