<script lang="ts">
	import type { PageData } from './$types';

	export let data: PageData;

	// Add sorting functionality
	let sortField: string | null = 'arrival_date';
	let sortDirection: 'asc' | 'desc' | null = 'desc';

	// Sorting function
	function toggleSort(field: string) {
		if (sortField === field) {
			if (sortDirection === 'asc') sortDirection = 'desc';
			else if (sortDirection === 'desc') {
				sortField = null;
				sortDirection = null;
			}
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
	}

	// Add helper function for date parsing
	function parseMonthYear(dateStr: string | null): Date {
		if (!dateStr) return new Date(0); // Return earliest possible date if null
		const [month, year] = dateStr.split(' ');
		const monthIndex = new Date(Date.parse(month + ' 1, 2000')).getMonth();
		return new Date(parseInt(year), monthIndex);
	}

	// Computed sorted data with reordered columns
	$: sortedData = data?.data
		? [...data.data].sort((a, b) => {
				if (!sortField || !sortDirection) return 0;

				const aVal = a[sortField as keyof typeof a];
				const bVal = b[sortField as keyof typeof b];

				// Special handling for arrival_date
				if (sortField === 'arrival_date') {
					// Handle null values in sorting
					if (!aVal && !bVal) return 0;
					if (!aVal) return sortDirection === 'asc' ? -1 : 1;
					if (!bVal) return sortDirection === 'asc' ? 1 : -1;

					const dateA = parseMonthYear(aVal as string);
					const dateB = parseMonthYear(bVal as string);
					return sortDirection === 'asc'
						? dateA.getTime() - dateB.getTime()
						: dateB.getTime() - dateA.getTime();
				}

				if (typeof aVal === 'string' && typeof bVal === 'string') {
					return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
				}

				return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
			})
		: [];

	// Add function to get ordered keys
	function getOrderedKeys(obj: any): string[] {
		if (!obj) return [];
		const keys = Object.keys(obj);
		const idIndex = keys.indexOf('id');
		const linkIndex = keys.indexOf('link');
		const nameIndex = keys.indexOf('name');

		// Remove the keys from their current positions
		keys.splice(linkIndex, 1);
		keys.splice(nameIndex, 1);

		// Insert them in the desired order after id
		keys.splice(1, 0, 'link', 'name');

		return keys;
	}
</script>

<div class="my-8 mt-8">
	{#if !data?.data || data.data.length === 0}
		<p class="p-4 text-zinc-300">No coffee data available</p>
	{:else}
		<div class="m-8 overflow-hidden overflow-x-auto rounded-lg">
			<table class="w-full table-auto bg-zinc-800">
				<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
					<tr>
						{#each getOrderedKeys(data.data[0]) as header}
							<th
								class="group max-w-[200px] cursor-pointer px-6 py-3 hover:bg-zinc-600"
								on:click={() => toggleSort(header)}
							>
								<div class="flex items-center gap-2">
									<span class="truncate">
										{header.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
									</span>

									<!-- Sort indicators -->
									{#if sortField === header}
										{#if sortDirection === 'asc'}
											<span class="flex-shrink-0">↑</span>
										{:else if sortDirection === 'desc'}
											<span class="flex-shrink-0">↓</span>
										{/if}
									{:else}
										<span class="flex-shrink-0 opacity-0 group-hover:opacity-50">↕</span>
									{/if}
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sortedData as row}
						<tr class="border-b border-zinc-700 bg-zinc-800 transition-colors hover:bg-zinc-700">
							{#each getOrderedKeys(row) as key}
								<td class="max-w-[200px] px-6 py-4 text-xs text-zinc-300">
									<div class="break-words">
										{#if key === 'link' && row[key as keyof typeof row]}
											<a
												href={String(row[key as keyof typeof row])}
												target="_blank"
												class="text-blue-400 hover:underline">Link</a
											>
										{:else if row[key as keyof typeof row] === null}
											-
										{:else}
											{typeof row[key as keyof typeof row] === 'string'
												? String(row[key as keyof typeof row]).slice(0, 250) +
													(String(row[key as keyof typeof row]).length > 250 ? '...' : '')
												: row[key as keyof typeof row]}
										{/if}
									</div>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
