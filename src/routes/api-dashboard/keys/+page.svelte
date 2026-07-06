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
		document.title = 'API Keys - Parchment Console';
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
	<title>API Keys - Parchment Console</title>
	<meta name="description" content="Manage your Parchment API keys in Parchment Console" />
</svelte:head>

<div class="min-h-screen bg-surface-canvas">
	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<nav class="mb-4">
				<a href="/api-dashboard" class="text-sm text-muted hover:text-ink">
					← Back to Parchment Console
				</a>
			</nav>
			<h1 class="text-3xl font-bold tracking-tight text-ink">API Keys</h1>
			<p class="mt-2 text-lg text-muted">
				Create and manage your API keys for accessing the Purveyors catalog API
			</p>
		</div>

		<!-- Success Alert for New Key -->
		{#if createdKey}
			<div class="mb-6 rounded-md bg-success-subtle p-4 ring-1 ring-success/30">
				<div class="flex">
					<div class="flex-1">
						<h3 class="text-sm font-medium text-success-strong">API key created</h3>
						<div class="mt-2">
							<p class="text-sm text-success-strong">
								Your new API key has been created. Make sure to copy it now - you won't be able to
								see it again.
							</p>
							<div class="mt-3 flex items-center space-x-3">
								<div
									class="flex-1 rounded-md bg-surface-raised p-3 font-mono text-sm text-ink ring-1 ring-success/30"
								>
									{createdKey}
								</div>
								<button
									onclick={() => copyToClipboard(createdKey!)}
									class="rounded-md bg-success px-3 py-2 text-sm font-medium text-white hover:bg-success-strong"
								>
									Copy
								</button>
							</div>
						</div>
					</div>
					<div class="ml-4">
						<button
							onclick={() => (createdKey = null)}
							class="text-success hover:text-success-strong"
						>
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
			<div class="mb-6 rounded-md bg-danger-subtle p-4 ring-1 ring-danger/30">
				<div class="flex">
					<div class="flex-1">
						<h3 class="text-sm font-medium text-danger-strong">Error</h3>
						<p class="mt-1 text-sm text-danger">{error}</p>
					</div>
					<button onclick={() => (error = null)} class="ml-4 text-danger hover:text-danger-strong">
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
		<div class="mb-8 rounded-lg bg-surface-panel p-6 ring-1 ring-line">
			{#if !showCreateForm}
				<div class="flex items-center justify-between">
					<div>
						<h2 class="text-lg font-semibold text-ink">Create New API Key</h2>
						<p class="mt-1 text-sm text-muted">
							Generate a new API key to access the Purveyors catalog API
						</p>
					</div>
					<button
						onclick={() => (showCreateForm = true)}
						class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
					>
						Create API Key
					</button>
				</div>
			{:else}
				<div>
					<h2 class="mb-4 text-lg font-semibold text-ink">Create New API Key</h2>
					<div class="space-y-4">
						<div>
							<label for="keyName" class="block text-sm font-medium text-ink"> API Key Name </label>
							<input
								id="keyName"
								type="text"
								bind:value={newKeyName}
								placeholder="e.g., Production App, Development, Mobile App"
								class="mt-1 block w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
								disabled={isCreatingKey}
							/>
							<p class="mt-1 text-xs text-muted">
								Choose a descriptive name to help you identify this key later
							</p>
						</div>
						<div class="flex space-x-3">
							<button
								onclick={createApiKey}
								disabled={isCreatingKey || !newKeyName.trim()}
								class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{isCreatingKey ? 'Creating...' : 'Create Key'}
							</button>
							<button
								onclick={() => {
									showCreateForm = false;
									newKeyName = '';
									error = null;
								}}
								class="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-all duration-200 hover:bg-surface-panel"
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
		<div class="rounded-lg bg-surface-panel ring-1 ring-line">
			<div class="border-b border-line px-6 py-4">
				<h2 class="text-lg font-semibold text-ink">Your API Keys</h2>
				<p class="mt-1 text-sm text-muted">
					{data.apiKeys?.length || 0}
					{(data.apiKeys?.length || 0) === 1 ? 'key' : 'keys'} total
				</p>
			</div>

			{#if data.apiKeys && data.apiKeys.length > 0}
				<div class="divide-y divide-line">
					{#each data.apiKeys as apiKey}
						<div class="px-6 py-4">
							<div class="flex items-center justify-between">
								<div class="flex-1">
									<div class="flex items-center space-x-3">
										<h3 class="text-base font-medium text-ink">
											{apiKey.name}
										</h3>
										{#if apiKey.is_active}
											<span
												class="inline-flex items-center rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success-strong"
											>
												Active
											</span>
										{:else}
											<span
												class="inline-flex items-center rounded-full bg-danger-subtle px-2.5 py-0.5 text-xs font-medium text-danger-strong"
											>
												Inactive
											</span>
										{/if}
									</div>
									<div class="mt-1 text-sm text-muted">
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
											class="rounded-md border border-danger/40 px-3 py-1 text-sm font-medium text-danger transition-all duration-200 hover:bg-danger-subtle"
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
						class="mx-auto h-12 w-12 text-muted"
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
					<h3 class="mt-2 text-sm font-medium text-ink">No API keys</h3>
					<p class="mt-1 text-sm text-muted">Get started by creating your first API key.</p>
					<div class="mt-4">
						<button
							onclick={() => (showCreateForm = true)}
							class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-all duration-200 hover:bg-opacity-90"
						>
							Create API Key
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- API Usage Guidelines -->
		<div class="mt-8 rounded-lg bg-info-subtle p-6 ring-1 ring-info/30">
			<h3 class="mb-4 text-lg font-medium text-info-strong">API key security guidelines</h3>
			<div class="space-y-2 text-sm text-info-strong">
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
