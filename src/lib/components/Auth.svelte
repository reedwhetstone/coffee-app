<script lang="ts">
	import { signInWithGoogle } from '$lib/supabase';
	import { getContext } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { Database } from '$lib/types/database.types';

	const supabase = getContext('supabase') as SupabaseClient<Database>;

	async function handleGoogleSignIn() {
		try {
			await signInWithGoogle(supabase);
		} catch (error) {
			console.error('Error signing in with Google:', error);
		}
	}
</script>

<button on:click={handleGoogleSignIn}> Sign in with Google </button>
