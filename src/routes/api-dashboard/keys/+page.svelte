<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props<{ data: PageData }>();

	// Component state
	let showCreateForm = $state(false);
	let newKeyName = $state('');
	let isCreatingKey = $state(false);
	let createdKey = $state<string | null>(null);
	let error = $state<string | null>(null);

	// Set page title
	onMount(() => {
		document.title = 'API Keys - Purveyors Dashboard';
	});

	async function createApiKey() {
		if (!newKeyName.trim()) {
			error = 'Please provide a name for your API key';
			return;
		}

		isCreatingKey = true;
		error = null;

		try {
			const response = await fetch('/api-dashboard/keys/generate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: newKeyName.trim()
				})
			});

			const result = await response.json();

			if (response.ok && result.success) {
				createdKey = result.apiKey;
				newKeyName = '';
				showCreateForm = false;
				// Refresh the page data
				await invalidateAll();
			} else {
				error = result.error || 'Failed to create API key';
			}
		} catch (err) {
			error = 'Failed to create API key';
			console.error('Create API key error:', err);
		} finally {
			isCreatingKey = false;
		}
	}

	async function deactivateKey(keyId: string) {
		if (
			!confirm('Are you sure you want to deactivate this API key? This action cannot be undone.')
		) {
			return;
		}

		try {
			const response = await fetch('/api-dashboard/keys/deactivate', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ keyId })
			});

			if (response.ok) {
				await invalidateAll();
			} else {
				const result = await response.json();
				error = result.error || 'Failed to deactivate API key';
			}
		} catch (err) {
			error = 'Failed to deactivate API key';
			console.error('Deactivate key error:', err);
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text).then(() => {
			// Could add a toast notification here
			console.log('API key copied to clipboard');
		});
	}
</script>

<svelte:head>
	<title>API Keys - Purveyors Dashboard</title>
	<meta name="description" content="Manage your Purveyors API keys" />
</svelte:head>

<div class="min-h-screen bg-background-primary-light">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<nav class="mb-4">
				<a
					href="/api-dashboard"
					class="text-sm text-text-secondary-light hover:text-text-primary-light"
				>
					← Back to Dashboard
				</a>
			</nav>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary-light">API Keys</h1>
			<p class="mt-2 text-lg text-text-secondary-light">
				Create and manage your API keys for accessing the Purveyors catalog API
			</p>
		</div>

		<!-- Success Alert for New Key -->
		{#if createdKey}
			<div class="mb-6 rounded-md bg-green-50 p-4 ring-1 ring-green-200">
				<div class="flex">
					<div class="flex-1">
						<h3 class="text-sm font-medium text-green-800">API Key Created Successfully!</h3>
						<div class="mt-2">
							<p class="text-sm text-green-700">
								Your new API key has been created. Make sure to copy it now - you won't be able to
								see it again.
							</p>
							<div class="mt-3 flex items-center space-x-3">
								<div
									class="flex-1 rounded-md bg-white p-3 font-mono text-sm text-gray-900 ring-1 ring-green-200"
								>
									{createdKey}
								</div>
								<button
									onclick={() => copyToClipboard(createdKey!)}
									class="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
								>
									Copy
								</button>
							</div>
						</div>
					</div>
					<div class="ml-4">
						<button onclick={() => (createdKey = null)} class="text-green-400 hover:text-green-600">
							<span class="sr-only">Dismiss</span>
							<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
								<path
									fill-rule="evenodd"
									d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
									clip-rule="evenodd"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Error Alert -->
		{#if error}
			<div class="mb-6 rounded-md bg-red-50 p-4 ring-1 ring-red-200">
				<div class="flex">
					<div class="flex-1">
						<h3 class="text-sm font-medium text-red-800">Error</h3>
						<p class="mt-1 text-sm text-red-700">{error}</p>
					</div>
					<button onclick={() => (error = null)} class="ml-4 text-red-400 hover:text-red-600">
						<span class="sr-only">Dismiss</span>
						<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
							<path
								fill-rule="evenodd"
								d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
								clip-rule="evenodd"
							/>
						</svg>
					</button>
				</div>
			</div>
		{/if}

		<!-- Create API Key Section -->
		<div class="mb-8 rounded-lg bg-background-secondary-light p-6 ring-1 ring-border-light">
			{#if !showCreateForm}
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-text-primary-light">Create New API Key</h2>
						<p class="mt-1 text-sm text-text-secondary-light">
							Generate a new API key to access the Purveyors catalog API
						</p>
					</div>
					<button
						onclick={() => (showCreateForm = true)}
						class="rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
					>
						Create API Key
					</button>
				</div>
			{:else}
				<div>
					<h2 class="mb-4 text-lg font-semibold text-text-primary-light">Create New API Key</h2>
					<div class="space-y-4">
						<div>
							<label for="keyName" class="block text-sm font-medium text-text-primary-light">
								API Key Name
							</label>
							<input
								id="keyName"
								type="text"
								bind:value={newKeyName}
								placeholder="e.g., Production App, Development, Mobile App"
								class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-background-tertiary-light focus:outline-none focus:ring-1 focus:ring-background-tertiary-light"
								disabled={isCreatingKey}
							/>
							<p class="mt-1 text-xs text-text-secondary-light">
								Choose a descriptive name to help you identify this key later
							</p>
						</div>
						<div class="flex space-x-3">
							<button
								onclick={createApiKey}
								disabled={isCreatingKey || !newKeyName.trim()}
								class="rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isCreatingKey ? 'Creating...' : 'Create Key'}
							</button>
							<button
								onclick={() => {
									showCreateForm = false;
									newKeyName = '';
									error = null;
								}}
								class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-text-primary-light transition-all duration-200 hover:bg-gray-50"
								disabled={isCreatingKey}
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- API Keys List -->
		<div class="rounded-lg bg-background-secondary-light ring-1 ring-border-light">
			<div class="border-b border-border-light px-6 py-4">
				<h2 class="text-lg font-semibold text-text-primary-light">Your API Keys</h2>
				<p class="mt-1 text-sm text-text-secondary-light">
					{data.apiKeys?.length || 0}
					{(data.apiKeys?.length || 0) === 1 ? 'key' : 'keys'} total
				</p>
			</div>

			{#if data.apiKeys && data.apiKeys.length > 0}
				<div class="divide-y divide-border-light">
					{#each data.apiKeys as apiKey}
						<div class="px-6 py-4">
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<div class="flex items-center space-x-3">
										<h3 class="text-base font-medium text-text-primary-light">
											{apiKey.name}
										</h3>
										{#if apiKey.is_active}
											<span
												class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
											>
												Active
											</span>
										{:else}
											<span
												class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
											>
												Inactive
											</span>
										{/if}
									</div>
									<div class="mt-1 text-sm text-text-secondary-light">
										<p>Created {new Date(apiKey.created_at).toLocaleDateString()}</p>
										{#if apiKey.last_used_at}
											<p>Last used {new Date(apiKey.last_used_at).toLocaleDateString()}</p>
										{:else}
											<p>Never used</p>
										{/if}
									</div>
								</div>
								<div class="flex items-center space-x-2">
									{#if apiKey.is_active}
										<button
											onclick={() => deactivateKey(apiKey.id)}
											class="rounded-md border border-red-300 px-3 py-1 text-sm font-medium text-red-700 transition-all duration-200 hover:bg-red-50"
										>
											Deactivate
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="px-6 py-12 text-center">
					<svg
						class="mx-auto h-12 w-12 text-text-secondary-light"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="1"
							d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
						/>
					</svg>
					<h3 class="mt-2 text-sm font-medium text-text-primary-light">No API keys</h3>
					<p class="mt-1 text-sm text-text-secondary-light">
						Get started by creating your first API key.
					</p>
					<div class="mt-4">
						<button
							onclick={() => (showCreateForm = true)}
							class="rounded-md bg-background-tertiary-light px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-opacity-90"
						>
							Create API Key
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- API Usage Guidelines -->
		<div class="mt-8 rounded-lg bg-blue-50 p-6 ring-1 ring-blue-200">
			<h3 class="mb-4 text-lg font-medium text-blue-900">API Key Security Guidelines</h3>
			<div class="space-y-2 text-sm text-blue-800">
				<p>
					• <strong>Keep your API keys secure:</strong> Never share your API keys publicly or commit
					them to version control
				</p>
				<p>
					• <strong>Use environment variables:</strong> Store API keys in environment variables, not
					in your code
				</p>
				<p>
					• <strong>Rotate keys regularly:</strong> Create new keys and deactivate old ones periodically
				</p>
				<p>
					• <strong>Use descriptive names:</strong> Name your keys clearly to identify their purpose
					and environment
				</p>
				<p>
					• <strong>Monitor usage:</strong> Check the usage analytics to detect any unusual activity
				</p>
			</div>
		</div>
	</div>
</div>
