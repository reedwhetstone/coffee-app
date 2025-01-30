<script lang="ts">
	import { signInWithGoogle } from '$lib/supabase';
	import { getContext } from 'svelte';

	const supabase = getContext('supabase');

	async function handleGoogleSignIn() {
		try {
			await signInWithGoogle(supabase);
		} catch (error) {
			console.error('Error signing in with Google:', error);
		}
	}
</script>

<button on:click={handleGoogleSignIn}> Sign in with Google </button>
