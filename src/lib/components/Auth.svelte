<script lang="ts">
	import { signInWithGoogle, createClient } from '$lib/supabase';
	import { getContext } from 'svelte';

	const supabase = getContext('supabase') as ReturnType<typeof createClient>;

	async function handleGoogleSignIn() {
		try {
			await signInWithGoogle(supabase);
		} catch (error) {
			console.error('Error signing in with Google:', error);
		}
	}
</script>

<button on:click={handleGoogleSignIn}> Sign in with Google </button>
