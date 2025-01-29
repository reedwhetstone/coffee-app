<script lang="ts">
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import { navbarActions } from '$lib/stores/navbarStore';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import pkg from 'lodash';
	import { auth } from '$lib/stores/auth';
	import { signInWithGoogle, signOut } from '$lib/auth/supabase';
	const { debounce } = pkg;

	let routeId = $page.route.id;

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

	let searchQuery = '';
	let searchResults: SearchResult[] = [];
	let showResults = false;

	// Add search function
	const handleSearch = debounce(async () => {
		if (searchQuery.length < 2) {
			searchResults = [];
			return;
		}

		try {
			const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
			if (!response.ok) {
				throw new Error('Search request failed');
			}
			const data = await response.json();
			if (data.error) {
				throw new Error(data.error);
			}
			searchResults = Array.isArray(data) ? data : [];
			//	console.log('Search results:', searchResults);
		} catch (error) {
			console.error('Search error:', error);
			searchResults = [];
		}
	}, 300);

	// Close search results when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const searchContainer = document.getElementById('search-container');
		if (searchContainer && !searchContainer.contains(event.target as Node)) {
			showResults = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

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

<nav class="border-sky-800 bg-zinc-300 dark:bg-zinc-800">
	<div class="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between p-4">
		<!-- Left side buttons group -->
		<div class="flex space-x-2">
			<button
				class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
				on:click={handleAddNewBean}
			>
				New Bean
			</button>

			<button
				class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
				on:click={() => {
					if (routeId === '/ROAST') {
						// If already on ROAST page, just show the form
						$navbarActions.onShowRoastForm();
					} else {
						// Otherwise, navigate with state
						goto('/ROAST', {
							state: {
								showRoastForm: true
							}
						});
					}
				}}
			>
				New Roast
			</button>

			<button
				class="rounded border-2 border-green-800 px-3 py-1 text-zinc-500 hover:bg-green-900"
				on:click={() => {
					if (routeId === '/SALES') {
						// If already on SALES page, just show the form
						$navbarActions.onAddNewSale();
					} else {
						// Otherwise, navigate with state
						goto('/SALES', {
							state: {
								showSaleForm: true
							}
						});
					}
				}}
			>
				New Sale
			</button>
		</div>

		<!-- Add search bar here -->
		<div id="search-container" class="relative mx-4 flex-1">
			<input
				type="text"
				bind:value={searchQuery}
				on:input={handleSearch}
				on:focus={() => (showResults = true)}
				placeholder="Search..."
				class="w-full rounded-lg border border-zinc-400 bg-zinc-100 px-4 py-2 dark:border-zinc-600 dark:bg-zinc-700"
			/>

			{#if showResults && searchResults.length > 0}
				<div
					class="absolute z-50 mt-1 max-h-96 w-full overflow-y-auto rounded-lg bg-white shadow-lg dark:bg-zinc-700"
				>
					{#each searchResults as result}
						<button
							class="w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-600"
							on:click={() => {
								if (result.url === routeId) {
									// If already on the same page, manually trigger the appropriate store/action
									if (result.type === 'green') {
										$navbarActions.onSearchSelect?.(result.type, result.item_id);
									} else if (result.type === 'roast') {
										$navbarActions.onSearchSelect?.(result.type, result.item_id);
									}
								} else {
									// Navigate to new page with search state
									goto(result.url, {
										state: {
											searchType: result.type,
											searchId: result.item_id
										}
									});
								}
								showResults = false;
								searchQuery = '';
							}}
						>
							<div class="font-medium">{result.title}</div>
							<div class="text-sm text-zinc-600 dark:text-zinc-400">{result.description}</div>
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<!-- Auth LOGIN -->

		<button
			data-collapse-toggle="navbar-default"
			type="button"
			class="inline-flex h-10 w-10 items-center justify-center rounded-lg p-2 text-sm text-zinc-500 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-sky-800 md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:focus:ring-zinc-600"
			aria-controls="navbar-default"
			aria-expanded="false"
		>
			<span class="sr-only">Open main menu</span>
			<svg
				class="h-5 w-5"
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 17 14"
			>
				<path
					stroke="currentColor"
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M1 1h15M1 7h15M1 13h15"
				/>
			</svg>
		</button>
		<div class="hidden w-full md:block md:w-auto" id="navbar-default">
			<ul
				class="mt-4 flex flex-col rounded-lg border border-zinc-100 bg-zinc-50 p-4 font-medium md:mt-0 md:flex-row md:space-x-8 md:border-0 md:bg-zinc-300 md:p-0 rtl:space-x-reverse dark:border-zinc-800 dark:bg-zinc-800 md:dark:bg-zinc-800"
			>
				<li>
					<a
						href="/"
						class="px-3 py-2 hover:bg-zinc-100 {routeId === '/(home)'
							? ' text-sky-800'
							: 'text-zinc-600'}
							hover:bg-transparent hover:bg-zinc-800 hover:text-sky-800">PURCHASED</a
					>
				</li>
				<li>
					<a
						href="/ROAST"
						class="px-3 py-2 hover:bg-zinc-100 {routeId === '/ROAST'
							? ' text-sky-800'
							: 'text-zinc-600'}
							hover:bg-transparent hover:bg-zinc-800 hover:text-sky-800">ROAST</a
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

		<div class="flex items-center gap-2">
			{#if $auth.user}
				<span class="hidden text-sm text-zinc-400 md:inline">
					{$auth.user.email}
				</span>
				<button
					on:click={handleSignOut}
					class="rounded border-2 border-red-800 px-3 py-1 text-zinc-500 hover:bg-red-900"
				>
					Sign Out
				</button>
			{:else}
				<button
					on:click={handleSignIn}
					class="rounded border-2 border-blue-800 px-3 py-1 text-zinc-500 hover:bg-blue-900"
				>
					Sign In
				</button>
			{/if}
		</div>
	</div>
</nav>
