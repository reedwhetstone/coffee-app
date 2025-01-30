<script lang="ts">
	import { signOut } from '$lib/supabase';
	import type { LayoutData } from './$types';

	let { data } = $props<{ data: LayoutData }>();
	let { supabase } = $derived(data);

	async function handleSignOut() {
		try {
			await signOut(supabase);
		} catch (error) {
			console.error('Error signing out:', error);
		}
	}
</script>

<button onclick={handleSignOut}>Sign Out</button>
