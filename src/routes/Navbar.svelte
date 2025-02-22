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
			goto('/roast');
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
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			// Force a page reload to clear any cached state
			window.location.href = '/';
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

	// Add state for mobile menu
	let isMenuOpen = $state(false);

	// Function to toggle mobile menu
	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}

	// Close menu when route changes
	afterNavigate(() => {
		routeId = $page.route.id;
		isMenuOpen = false;
	});
</script>

<nav class="sticky top-0 z-50 bg-zinc-900 px-4 py-2 shadow-lg">
	<div class="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<!-- Mobile Menu Button -->
		<div class="flex items-center justify-between md:hidden">
			<div id="search-container" class="relative w-full">
				<input
					type="text"
					bind:value={searchQuery}
					oninput={handleSearch}
					onfocus={() => (showResults = true)}
					placeholder="Search..."
					class="w-full rounded bg-zinc-800 px-3 py-1 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
			<button onclick={toggleMenu} class="ml-2 rounded p-2 text-zinc-400 hover:bg-zinc-800">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-6 w-6"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					{#if isMenuOpen}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					{:else}
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 6h16M4 12h16M4 18h16"
						/>
					{/if}
				</svg>
			</button>
		</div>

		<!-- Desktop Search -->
		<div id="search-container" class="relative hidden w-64 md:block">
			<input
				type="text"
				bind:value={searchQuery}
				oninput={handleSearch}
				onfocus={() => (showResults = true)}
				placeholder="Search..."
				class="w-full rounded bg-zinc-800 px-3 py-1 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
		<div
			class="flex flex-col md:flex-row md:items-center md:gap-4 {isMenuOpen
				? 'block'
				: 'hidden md:flex'}"
		>
			<ul class="flex flex-wrap items-center gap-2">
				<li class="w-full md:w-auto">
					<a
						href="/"
						class="block w-full px-3 py-2 text-center md:inline md:w-auto {routeId === '/'
							? 'text-sky-800'
							: 'text-zinc-600'} hover:bg-zinc-800 hover:text-sky-800"
					>
						CATALOG
					</a>
				</li>
				<li class="w-full md:w-auto">
					<a
						href="/beans"
						class="block w-full px-3 py-2 text-center md:inline md:w-auto {routeId === '/beans'
							? 'text-sky-800'
							: 'text-zinc-600'}
							hover:bg-zinc-800 hover:text-sky-800"
					>
						BEANS
					</a>
				</li>
				{#if data.role === 'admin'}
					<li class="w-full md:w-auto">
						<a
							href="/roast"
							class="block w-full px-3 py-2 text-center md:inline md:w-auto {routeId === '/roast'
								? 'text-sky-800'
								: 'text-zinc-600'}
								hover:bg-zinc-800 hover:text-sky-800"
						>
							ROAST
						</a>
					</li>
					<li class="w-full md:w-auto">
						<a
							href="/profit"
							class="block w-full px-3 py-2 text-center md:inline md:w-auto {routeId === '/profit'
								? 'text-sky-800'
								: 'text-zinc-600'}
								hover:bg-zinc-800 hover:text-sky-800"
						>
							PROFIT
						</a>
					</li>
				{/if}
			</ul>
		</div>

		<!-- Auth Section -->
		<div class="flex items-center gap-2 {isMenuOpen ? 'block' : 'hidden md:flex'}">
			{#if session?.user}
				<span class="hidden text-sm text-zinc-400 md:inline">
					{session.user.email}
				</span>
				<button
					onclick={handleSignOut}
					class="w-full rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-900 md:w-auto"
				>
					Sign Out
				</button>
			{:else}
				<button
					onclick={handleSignIn}
					class="w-full rounded border-2 border-blue-800 px-3 py-1 text-zinc-500 hover:bg-blue-900 md:w-auto"
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
