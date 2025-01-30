<script lang="ts">
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import { navbarActions } from '$lib/stores/navbarStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import pkg from 'lodash';
	import { signInWithGoogle, signOut } from '$lib/supabase';
	const { debounce } = pkg;

	// Add props for data
	let { data } = $props();
	let { supabase, session } = $derived(data);

	let routeId = $state($page.route.id);

	// Update `routeId` after each navigation
	afterNavigate(() => {
		routeId = $page.route.id;
	});

	// Function to handle Add New Bean click
	function handleAddNewBean() {
		goto('/').then(() => {
			$navbarActions.onAddNewBean();
		});
	}

	// Add these variables
	interface SearchResult {
		id: number;
		title: string;
		description: string;
		url: string;
		type: string;
		item_id: number;
	}

	// Make searchQuery reactive with $state
	let searchQuery = $state('');
	let searchResults: SearchResult[] = $state([]);
	let showResults = $state(false);

	// Add search function
	const handleSearch = debounce(async () => {
		if (searchQuery.length < 2) {
			searchResults = [];
			return;
		}

		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
			if (!response.ok) throw new Error('Search failed');
			searchResults = await response.json();
		} catch (error) {
			console.error('Search error:', error);
			searchResults = [];
		}
	}, 300);

	// Handle search result selection
	function handleSearchSelect(result: SearchResult) {
		if (result.type === 'green') {
			$navbarActions.onSearchSelect?.(result.type, result.item_id);
			goto('/');
		} else if (result.type === 'roast') {
			goto('/ROAST');
			$navbarActions.onSearchSelect?.(result.type, result.item_id);
		}
		searchQuery = '';
		searchResults = [];
		showResults = false;
	}

	async function handleSignIn() {
		try {
			await signInWithGoogle(supabase);
		} catch (error) {
			console.error('Error signing in:', error);
		}
	}

	async function handleSignOut() {
		try {
			await signOut(supabase);
		} catch (error) {
			console.error('Error signing out:', error);
		}
	}

	// Close search results when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const searchContainer = document.getElementById('search-container');
		if (searchContainer && !searchContainer.contains(event.target as Node)) {
			showResults = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<nav class="sticky top-0 z-50 bg-zinc-900 px-4 py-2 shadow-lg">
	<div class="mx-auto flex max-w-7xl items-center justify-between">
		<!-- Search Section -->
		<div id="search-container" class="relative">
			<input
				type="text"
				bind:value={searchQuery}
				oninput={handleSearch}
				onfocus={() => (showResults = true)}
				placeholder="Search..."
				class="w-64 rounded bg-zinc-800 px-3 py-1 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
			/>
			{#if showResults && searchResults.length > 0}
				<div class="absolute mt-1 w-full rounded border border-zinc-700 bg-zinc-800 shadow-lg">
					{#each searchResults as result}
						<button
							class="block w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700"
							onclick={() => handleSearchSelect(result)}
						>
							<div class="font-medium">{result.title}</div>
							<div class="text-xs text-zinc-500">{result.description}</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Navigation Links -->
		<div class="flex items-center gap-4">
			<ul class="flex items-center gap-2">
				<li>
					<a
						href="/"
						class="px-3 py-2 hover:bg-zinc-100 {routeId === '/' ? ' text-sky-800' : 'text-zinc-600'}
							hover:text-drop-shadow-sm hover:bg-transparent hover:bg-zinc-800 hover:text-sky-800">BEANS</a
					>
				</li>
				<li>
					<a
						href="/ROAST"
						class="px-3 py-2 hover:bg-zinc-100 {routeId === '/ROAST'
							? ' text-sky-800'
							: 'text-zinc-600'}
							hover:text-drop-shadow-sm hover:bg-transparent hover:bg-zinc-800 hover:text-sky-800">ROAST</a
					>
				</li>
				<li>
					<a
						href="/PROFIT"
						class="px-3 py-2 hover:bg-zinc-100 {routeId === '/PROFIT'
							? ' text-sky-800'
							: 'text-zinc-600'}
							hover:bg-transparent hover:bg-zinc-800 hover:text-sky-800">PROFIT</a
					>
				</li>
				<li>
					<a
						href="/SALES"
						class="px-3 py-2 hover:bg-zinc-100 {routeId === '/SALES'
							? ' text-sky-800'
							: 'text-zinc-600'}
							hover:text-drop-shadow-sm hover:bg-transparent hover:bg-zinc-800 hover:text-sky-800">SALES</a
					>
				</li>
				<li>
					<a
						href="/SWEET"
						class="px-3 py-2 hover:bg-zinc-100 {routeId === '/SWEET'
							? ' text-sky-800'
							: 'text-zinc-600'}
							hover:text-drop-shadow-sm hover:bg-transparent hover:bg-zinc-800 hover:text-sky-800"
						>SWEET.SCRIPTS</a
					>
				</li>
			</ul>
		</div>

		<!-- Auth Section -->
		<div class="flex items-center gap-2">
			{#if session?.user}
				<span class="hidden text-sm text-zinc-400 md:inline">
					{session.user.email}
				</span>
				<button
					onclick={handleSignOut}
					class="rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-900"
				>
					Sign Out
				</button>
			{:else}
				<button
					onclick={handleSignIn}
					class="rounded border-2 border-blue-800 px-3 py-1 text-zinc-500 hover:bg-blue-900"
				>
					Sign In
				</button>
			{/if}
		</div>
	</div>
</nav>

<style>
	:global(html) {
		background-color: rgb(24 24 27);
	}
</style>
