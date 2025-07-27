<script lang="ts">
	import { onMount } from 'svelte';
	import {
		validateCurrentPageSchemas,
		extractSchemasFromPage,
		validateSchema,
		generateTestingUrls,
		type ValidationResult
	} from '$lib/utils/schemaValidation';

	let { show = false } = $props<{ show?: boolean }>();

	let schemas = $state<any[]>([]);
	let validationResults = $state<ValidationResult[]>([]);
	let isExpanded = $state(false);
	let currentUrl = $state('');

	onMount(() => {
		if (show && typeof window !== 'undefined') {
			currentUrl = window.location.href;
			refreshSchemas();
		}
	});

	function refreshSchemas() {
		schemas = extractSchemasFromPage();
		validationResults = schemas.map((schema) => validateSchema(schema));

		// Also log to console for debugging
		validateCurrentPageSchemas();
	}

	function copySchemaToClipboard(schema: any) {
		navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
	}

	let testingUrls = $derived(currentUrl ? generateTestingUrls(currentUrl) : null);
	let hasErrors = $derived(validationResults.some((result) => !result.isValid));
	let totalWarnings = $derived(
		validationResults.reduce((sum, result) => sum + result.warnings.length, 0)
	);
</script>

{#if show}
	<div class="fixed bottom-4 right-4 z-50 max-w-md">
		<!-- Toggle Button -->
		<button
			class="mb-2 flex items-center space-x-2 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white shadow-lg hover:bg-gray-700"
			onclick={() => (isExpanded = !isExpanded)}
		>
			<span>🔍</span>
			<span>Schema Debug</span>
			{#if hasErrors}
				<span class="rounded-full bg-red-500 px-2 py-1 text-xs">!</span>
			{:else if totalWarnings > 0}
				<span class="rounded-full bg-yellow-500 px-2 py-1 text-xs">{totalWarnings}</span>
			{:else}
				<span class="rounded-full bg-green-500 px-2 py-1 text-xs">✓</span>
			{/if}
		</button>

		{#if isExpanded}
			<div class="max-h-96 overflow-y-auto rounded-lg bg-white p-4 shadow-xl ring-1 ring-black/5">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="font-semibold text-gray-900">Schema Validation</h3>
					<button
						class="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
						onclick={refreshSchemas}
					>
						Refresh
					</button>
				</div>

				<!-- Testing Links -->
				{#if testingUrls}
					<div class="mb-3 space-y-1">
						<a
							href={testingUrls.richResultsTest}
							target="_blank"
							rel="noopener noreferrer"
							class="block text-xs text-blue-600 hover:underline"
						>
							🧪 Test Rich Results
						</a>
						<a
							href={testingUrls.structuredDataTest}
							target="_blank"
							rel="noopener noreferrer"
							class="block text-xs text-blue-600 hover:underline"
						>
							📄 Validate Schema.org
						</a>
					</div>
				{/if}

				<!-- Schema Results -->
				<div class="space-y-2">
					{#each validationResults as result, index}
						{@const schema = schemas[index]}
						<div class="rounded border p-2 text-xs">
							<div class="mb-1 flex items-center justify-between">
								<span class="font-medium">
									{schema['@type'] || 'Unknown'} Schema
								</span>
								<div class="flex items-center space-x-1">
									{#if result.isValid}
										<span class="text-green-600">✓</span>
									{:else}
										<span class="text-red-600">✗</span>
									{/if}
									<button
										class="text-gray-400 hover:text-gray-600"
										onclick={() => copySchemaToClipboard(schema)}
										title="Copy to clipboard"
									>
										📋
									</button>
								</div>
							</div>

							{#if result.errors.length > 0}
								<div class="mb-1">
									<div class="font-medium text-red-600">Errors:</div>
									{#each result.errors as error}
										<div class="text-red-600">• {error}</div>
									{/each}
								</div>
							{/if}

							{#if result.warnings.length > 0}
								<div class="mb-1">
									<div class="font-medium text-yellow-600">Warnings:</div>
									{#each result.warnings as warning}
										<div class="text-yellow-600">• {warning}</div>
									{/each}
								</div>
							{/if}

							{#if result.isValid && result.warnings.length === 0}
								<div class="text-green-600">Schema is valid!</div>
							{/if}
						</div>
					{/each}

					{#if schemas.length === 0}
						<div class="text-center text-gray-500">No schemas found on page</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
