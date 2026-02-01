<script lang="ts">
	import { type Snippet } from 'svelte';
	import { signOut } from '$lib/supabase';
	import type { LayoutData } from './$types';

	let { data, children } = $props<{ data: LayoutData; children: Snippet }>();
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

{@render children()}
