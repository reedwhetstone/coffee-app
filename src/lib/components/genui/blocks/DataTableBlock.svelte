<script lang="ts">
	import type { DataTableBlock, BlockAction } from '$lib/types/genui';

	let { block, onAction: _onAction } = $props<{
		block: DataTableBlock;
		onAction?: (action: BlockAction) => void;
	}>();

	let sortKey = $state<string | null>(null);
	let sortDir = $state<'asc' | 'desc'>('asc');

	function handleSort(key: string, sortable?: boolean) {
		if (!sortable) return;
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	let sortedRows = $derived.by(() => {
		const rows = [...block.data.rows];
		if (!sortKey) return rows;
		return rows.sort((a, b) => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const aVal = (a as any)[sortKey!];
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const bVal = (b as any)[sortKey!];
			if (aVal == null && bVal == null) return 0;
			if (aVal == null) return 1;
			if (bVal == null) return -1;
			const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
			return sortDir === 'asc' ? cmp : -cmp;
		});
	});
</script>

<div class="my-4">
	<div class="overflow-x-auto rounded-lg ring-1 ring-border-light">
		<table class="w-full text-sm">
			<thead>
				<tr
					class="border-b border-border-light bg-background-secondary-light text-left text-xs font-medium text-text-secondary-light"
				>
					{#each block.data.columns as col}
						<th
							class="px-3 py-2 {col.align === 'right'
								? 'text-right'
								: col.align === 'center'
									? 'text-center'
									: 'text-left'} {col.sortable
								? 'cursor-pointer select-none hover:text-text-primary-light'
								: ''}"
							style={col.width ? `width: ${col.width}` : ''}
							onclick={() => handleSort(String(col.key), col.sortable)}
						>
							{col.label}
							{#if col.sortable && sortKey === String(col.key)}
								<span class="ml-1">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each sortedRows as row, i (i)}
					<tr
						class="border-b border-border-light last:border-0 hover:bg-background-secondary-light/50"
					>
						{#each block.data.columns as col}
							{@const val = (row as Record<string, unknown>)[String(col.key)]}
							<td
								class="px-3 py-2 {col.align === 'right'
									? 'text-right'
									: col.align === 'center'
										? 'text-center'
										: 'text-left'} text-text-primary-light"
							>
								{#if col.render}
									{col.render(val, row)}
								{:else}
									{val ?? '-'}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
