<script lang="ts">
	import { signOut } from '$lib/supabase';

	let { data } = $props();
	let { supabase } = $derived(data);

	async function handleSignOut() {
		try {
			await signOut(supabase);
		} catch (error) {
			console.error('Error signing out:', error);
		}
	}
</script>

<button on:click={handleSignOut}>Sign Out</button>
