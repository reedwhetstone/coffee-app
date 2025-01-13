<script lang="ts">
	let logs: string[] = [];

	async function runCoffeeScript() {
		try {
			logs = [...logs, 'Starting coffee script...'];
			const response = await fetch('/api/run-coffee', { method: 'POST' });
			if (!response.ok) throw new Error('Failed to run coffee script');
			logs = [...logs, 'Coffee script executed successfully'];
		} catch (error) {
			logs = [...logs, `Error running coffee script: ${error}`];
		}
	}

	async function runPlaywrightScript() {
		try {
			logs = [...logs, 'Starting playwright script...'];
			const response = await fetch('/api/run-playwright', { method: 'POST' });
			if (!response.ok) throw new Error('Failed to run playwright script');
			logs = [...logs, 'Playwright script executed successfully'];
		} catch (error) {
			logs = [...logs, `Error running playwright script: ${error}`];
		}
	}
	export let data: {
		data: {
			id: number;
			link: string;
			name: string;
			score_value: number;
			arrival_date: string;
			region: string;
			processing: string;
			drying_method: string;
			lot_size: string;
			bag_size: string;
			packaging: string;
			farm_gate: string;
			cultivar_detail: string;
			grade: string;
			appearance: string;
			roast_recs: string;
			type: string;
			bean_cost: number | null;
			last_updated: string;
		}[];
	};

	console.log('Component data:', data);

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

	// Computed sorted data
	$: sortedData = data?.data
		? [...data.data].sort((a, b) => {
				if (!sortField || !sortDirection) return 0;

				const aVal = a[sortField as keyof typeof a];
				const bVal = b[sortField as keyof typeof b];

				if (typeof aVal === 'string' && typeof bVal === 'string') {
					return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
				}

				return sortDirection === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
			})
		: [];
</script>

<div class="my-4 flex gap-4">
	<button
		on:click={runCoffeeScript}
		class="cursor-pointer rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
	>
		Run Coffee Script
	</button>
	<button
		on:click={runPlaywrightScript}
		class="cursor-pointer rounded bg-slate-600 px-4 py-2 text-white hover:bg-slate-700"
	>
		Run Playwright Script
	</button>
</div>

<div class="m-8 overflow-hidden overflow-x-auto rounded-lg">
	{#if !data?.data?.length}
		<p class="p-4 text-zinc-300">No coffee data available</p>
	{:else if data?.data?.length > 0}
		<table class="w-full table-auto bg-zinc-800">
			<thead class="bg-zinc-700 text-xs uppercase text-zinc-400">
				<tr>
					{#each Object.keys(data.data[0]) as header}
						<th
							class="group cursor-pointer px-6 py-3 hover:bg-zinc-600"
							on:click={() => toggleSort(header)}
						>
							<div class="flex items-center gap-2">
								{header.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}

								<!-- Sort indicators -->
								{#if sortField === header}
									{#if sortDirection === 'asc'}
										<span>↑</span>
									{:else if sortDirection === 'desc'}
										<span>↓</span>
									{/if}
								{:else}
									<span class="opacity-0 group-hover:opacity-50">↕</span>
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each sortedData as row}
					<tr class="border-b border-zinc-700 bg-zinc-800 transition-colors hover:bg-zinc-700">
						{#each Object.entries(row) as [key, value]}
							<td class="whitespace-nowrap px-6 py-4 text-xs text-zinc-300">
								{#if key === 'link' && value}
									<a href={value} target="_blank" class="text-blue-400 hover:underline">Link</a>
								{:else if value === null}
									-
								{:else}
									{value}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
