<script lang="ts">
	import type { ActionCardBlock, ActionField, BlockAction } from '$lib/types/genui';

	let { block, onAction, onExecute } = $props<{
		block: ActionCardBlock;
		onAction?: (action: BlockAction) => void;
		onExecute?: (actionType: string, fields: Record<string, unknown>) => Promise<void>;
	}>();

	let editing = $state(false);
	let localFields = $state<ActionField[]>([]);
	let status = $state(block.data.status);
	let errorMsg = $state(block.data.error || '');

	// Initialize local fields from block data
	$effect(() => {
		localFields = block.data.fields.map((f: ActionField) => ({ ...f }));
		status = block.data.status;
		errorMsg = block.data.error || '';
	});

	function getFieldValue(key: string): unknown {
		return localFields.find((f) => f.key === key)?.value;
	}

	function setFieldValue(key: string, value: unknown) {
		localFields = localFields.map((f) => (f.key === key ? { ...f, value } : f));

		// Coupled field updates for add_bean_to_inventory
		if (block.data.actionType === 'add_bean_to_inventory') {
			// When coffee_bean dropdown changes, update the hidden catalog_id
			if (key === 'coffee_bean') {
				localFields = localFields.map((f) =>
					f.key === 'catalog_id' ? { ...f, value: Number(value) } : f
				);
			}

			// When cost_per_lb or purchased_qty_lbs changes, recompute total_bean_cost
			if (key === 'cost_per_lb' || key === 'purchased_qty_lbs') {
				const perLb = Number(localFields.find((f) => f.key === 'cost_per_lb')?.value) || 0;
				const qty = Number(localFields.find((f) => f.key === 'purchased_qty_lbs')?.value) || 0;
				localFields = localFields.map((f) =>
					f.key === 'total_bean_cost' ? { ...f, value: Math.round(perLb * qty * 100) / 100 } : f
				);
			}
		}
	}

	async function handleExecute() {
		status = 'executing';
		errorMsg = '';
		try {
			const params: Record<string, unknown> = {};
			for (const f of localFields) {
				params[f.key] = f.value;
			}
			if (onExecute) {
				await onExecute(block.data.actionType, params);
				status = 'success';
			}
		} catch (err) {
			status = 'failed';
			errorMsg = (err as Error).message || 'Execution failed';
		}
	}

	async function handleRetry() {
		await handleExecute();
	}

	function handleCancel() {
		status = 'proposed';
		editing = false;
		// Reset fields to original
		localFields = block.data.fields.map((f: ActionField) => ({ ...f }));
	}

	const statusColors: Record<string, string> = {
		proposed: 'bg-amber-50 ring-amber-300',
		executing: 'bg-blue-50 ring-blue-300',
		success: 'bg-green-50 ring-green-300',
		failed: 'bg-red-50 ring-red-300'
	};

	const statusLabels: Record<string, string> = {
		proposed: 'Proposed',
		executing: 'Executing...',
		success: 'Completed',
		failed: 'Failed'
	};

	const statusIcons: Record<string, string> = {
		proposed: 'M12 9v2m0 4h.01',
		executing: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
		success: 'M5 13l4 4L19 7',
		failed: 'M6 18L18 6M6 6l12 12'
	};
</script>

<div class="rounded-lg p-4 ring-1 {statusColors[status] || statusColors.proposed}">
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<svg class="h-5 w-5 {status === 'success' ? 'text-green-600' : status === 'failed' ? 'text-red-600' : status === 'executing' ? 'text-blue-600 animate-spin' : 'text-amber-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={statusIcons[status] || statusIcons.proposed} />
			</svg>
			<span class="text-sm font-medium text-text-primary-light">
				{block.data.summary}
			</span>
		</div>
		<span class="rounded-full px-2 py-0.5 text-xs font-medium {
			status === 'proposed' ? 'bg-amber-100 text-amber-700' :
			status === 'executing' ? 'bg-blue-100 text-blue-700' :
			status === 'success' ? 'bg-green-100 text-green-700' :
			'bg-red-100 text-red-700'
		}">
			{statusLabels[status]}
		</span>
	</div>

	<!-- Fields -->
	<div class="space-y-2">
		{#each localFields as field (field.key)}
			<div class="flex items-center gap-2 text-sm">
				<span class="w-32 shrink-0 text-text-secondary-light">{field.label}</span>
				{#if editing && field.editable && status === 'proposed'}
					{#if field.type === 'textarea'}
						<textarea
							value={String(field.value || '')}
							oninput={(e) => setFieldValue(field.key, (e.target as HTMLTextAreaElement).value)}
							class="flex-1 rounded border border-border-light bg-white px-2 py-1 text-sm focus:border-background-tertiary-light focus:outline-none"
							rows="2"
						></textarea>
					{:else if field.type === 'select' && (field.selectOptions || field.options)}
						<select
							value={String(field.value)}
							onchange={(e) => setFieldValue(field.key, (e.target as HTMLSelectElement).value)}
							class="flex-1 rounded border border-border-light bg-white px-2 py-1 text-sm focus:border-background-tertiary-light focus:outline-none"
						>
							{#if field.selectOptions}
								{#each field.selectOptions as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							{:else if field.options}
								{#each field.options as opt}
									<option value={opt}>{opt}</option>
								{/each}
							{/if}
						</select>
					{:else}
						<input
							type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
							value={String(field.value || '')}
							oninput={(e) => {
								const val = (e.target as HTMLInputElement).value;
								setFieldValue(field.key, field.type === 'number' ? Number(val) : val);
							}}
							class="flex-1 rounded border border-border-light bg-white px-2 py-1 text-sm focus:border-background-tertiary-light focus:outline-none"
						/>
					{/if}
				{:else}
					<span class="flex-1 text-text-primary-light">
						{field.value ?? '—'}
					</span>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Error message -->
	{#if status === 'failed' && errorMsg}
		<div class="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
			{errorMsg}
		</div>
	{/if}

	<!-- Action buttons -->
	{#if status === 'proposed'}
		<div class="mt-3 flex items-center gap-2">
			<button
				onclick={handleExecute}
				class="rounded-md bg-background-tertiary-light px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-opacity-90"
			>
				Execute
			</button>
			{#if !editing}
				<button
					onclick={() => (editing = true)}
					class="rounded-md border border-border-light px-3 py-1.5 text-sm text-text-secondary-light transition-all hover:text-text-primary-light"
				>
					Edit
				</button>
			{:else}
				<button
					onclick={() => (editing = false)}
					class="rounded-md border border-border-light px-3 py-1.5 text-sm text-text-secondary-light transition-all hover:text-text-primary-light"
				>
					Done Editing
				</button>
			{/if}
			<button
				onclick={handleCancel}
				class="rounded-md px-3 py-1.5 text-sm text-text-secondary-light transition-all hover:text-red-500"
			>
				Cancel
			</button>
		</div>
	{:else if status === 'failed'}
		<div class="mt-3 flex items-center gap-2">
			<button
				onclick={handleRetry}
				class="rounded-md bg-background-tertiary-light px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-opacity-90"
			>
				Retry
			</button>
			<button
				onclick={handleCancel}
				class="rounded-md px-3 py-1.5 text-sm text-text-secondary-light transition-all hover:text-red-500"
			>
				Cancel
			</button>
		</div>
	{:else if status === 'executing'}
		<div class="mt-3 flex items-center gap-2">
			<div class="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
			<span class="text-sm text-text-secondary-light">Processing...</span>
		</div>
	{:else if status === 'success'}
		<div class="mt-3 text-sm text-green-600">
			Action completed successfully.
		</div>
	{/if}
</div>
