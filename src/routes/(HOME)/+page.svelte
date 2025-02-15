<script lang="ts">
	import type { PageData } from './$types';
	import { GoogleGenerativeAI } from '@google/generative-ai';
	import { onMount } from 'svelte';

	export let data: PageData;

	// Add search functionality
	let searchQuery = '';
	let chatResponse = '';
	let isLoading = false;

	// Initialize Gemini
	const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
	const model = genAI.getGenerativeModel({
		model: 'gemini-2.0-flash-exp',
		generationConfig: {
			temperature: 0,
			topP: 0.95,
			topK: 40,
			maxOutputTokens: 8192
		}
	});

	let chatSession = model.startChat({
		history: [
			{
				role: 'user',
				parts: [
					{
						text: 'You are a coffee expert. Please help users find the perfect coffee based on their preferences and questions.'
					}
				]
			},
			{
				role: 'model',
				parts: [
					{
						text: "I'll help users find their perfect coffee match by leveraging my expertise and the available coffee data. I will only recommend coffees that are currently stocked. When possible, I will make recommendations based on the initial user request, without additional information from the user."
					}
				]
			}
		]
	});

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

	// Update sorted data (removed search filtering)
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
		return [
			'id',
			'source',
			'name',
			'processing',
			'region',
			'cost_lb',
			'score_value',
			'arrival_date',
			'harvest_date',
			'cultivar_detail',
			'description_short',
			'cupping_notes',
			'last_updated'
		];
	}

	// Add recommendation state
	let recommendedCoffees: any[] = [];
	let isLoadingRecommendations = false;

	// Remove the separate handleChat function and modify handleSearch to only use getRecommendations
	async function handleSearch() {
		if (!searchQuery.trim()) return;

		isLoading = true;
		isLoadingRecommendations = true;
		try {
			const result = await getRecommendations(searchQuery);
			const responseText = result.response.text();

			// Find JSON content between ```json and ``` markers
			const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
			// Everything before the JSON is the natural language response
			chatResponse = responseText.split('```json')[0].trim();

			if (jsonMatch && jsonMatch[1]) {
				try {
					const recommendations = JSON.parse(jsonMatch[1].trim());
					recommendedCoffees = recommendations.recommendations.map((rec) => ({
						...data.data.find((coffee) => coffee.id === rec.id),
						reason: rec.reason
					}));
				} catch (jsonError) {
					console.error('JSON parsing error:', jsonError);
					recommendedCoffees = [];
				}
			} else {
				recommendedCoffees = [];
			}
		} catch (error) {
			console.error('Search error:', error);
			chatResponse = 'An error occurred while processing your request.';
			recommendedCoffees = [];
		} finally {
			isLoading = false;
			isLoadingRecommendations = false;
			searchQuery = '';
		}
	}

	// Update getRecommendations to return the result instead of processing it
	async function getRecommendations(query: string) {
		return await chatSession.sendMessage(`
			You are a coffee expert. Use the following information to make informed recommendations:

			COFFEE KNOWLEDGE BASE:
			${JSON.stringify(data.trainingData)}

			CURRENTLY STOCKED COFFEES:
			${JSON.stringify(data.data.map((coffee) => coffee.id))}

			COFFEE EXPERTISE GUIDELINES:
			1. Higher scoring coffees generally indicate superior quality. Sweet Maria's coffee scores are the only true scores. The other sources do not provide ranking out of 100 and are therefore calibrated based on sentiment. They should be considered with a grain of salt.
			2. Price per pound is both an indicator of quality and value.
			2. Fresh arrival dates are preferred (within the last 6 months) but coffees without arrival dates should not be excluded.
			3. Consider this source ranking when weighting recommendations:
			Sweet Maria's: 93/100
				• Reputation: Often called the "gold standard" for green coffee; praised for excellent farm‐and‐bean information.
				• Strengths: Consistent quality, broad range of origins, trusted by home roasters worldwide.
				• Minor Criticisms: Occasional reports of beans arriving slightly past their prime.

			Bodhi Leaf: 90/100
				• Reputation: Known for its Q-Grader–certified approach and fresh, interesting beans.
				• Strengths: Emphasis on quality and careful sourcing; appeals to a niche of specialty roasters looking for a modern, curated selection. 
				• Minor Criticisms: Slightly higher price point can affect perceived value for some consumers.There are a few isolated reports—such as one reviewer noting excessive defects (e.g. holes from bugs)—which might affect consistency for some batches.

			The Captain's Coffee: 87/100
				• Reputation: Well‐regarded for its unique selections and detailed bean/farm notes.
				• Strengths: High-quality, with a loyal following among roasters who appreciate its curated offerings.
				• Minor Criticisms: Some regional preferences noted, and while quality is high, it's sometimes seen as less "iconic" than Sweet Maria's. Mixed regional sentiment (for example, some West Coast roasters lean toward Sweet Maria's for shipping speed and reputation) 

			USER QUERY: ${query}

			TASK:
			Recommend 3 currently stocked coffees that best match the query.
			Consider freshness, scores, processing methods, and value.
			First, provide a natural language response to the user's query.
			Then, provide specific recommendations in the JSON format below.

			FORMAT RESPONSE AS:
			[Natural language response to the query]

			json
			{
				"recommendations": [
					{
						"id": "coffee_id",
						"reason": "Detailed explanation including quality, freshness, value, and flavor profile"
					}
				]
			}
			
		`);
	}

	// Add default query constant
	const DEFAULT_QUERY =
		'What are the best value coffees available right now? Consider the price per pound and quality scores to find coffees that offer the most bang for the buck.';

	// Add initial load function
	async function loadInitialRecommendations() {
		if (!isLoading && !chatResponse) {
			searchQuery = DEFAULT_QUERY;
			await handleSearch();
		}
	}

	onMount(() => {
		loadInitialRecommendations();
	});
</script>

<!-- Add search and chat interface -->
<div class="mx-8 mt-8 space-y-4">
	<div class="flex gap-4">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="Search coffees or ask a question..."
			class="flex-1 rounded-lg bg-zinc-700 px-4 py-2 text-zinc-100 placeholder-zinc-400"
		/>
		<button
			on:click={handleSearch}
			class="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
			disabled={isLoading}
		>
			{isLoading ? 'Processing...' : 'Ask AI'}
		</button>
	</div>

	{#if chatResponse}
		<div class="rounded-lg bg-zinc-700 p-4 text-zinc-100">
			<p class="whitespace-pre-wrap">{chatResponse}</p>
		</div>
	{/if}
</div>

<!-- Add recommendations UI -->
{#if recommendedCoffees.length > 0}
	<div class="mt-8">
		<h3 class="mb-4 text-xl font-semibold">Recommended Coffees</h3>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
			{#each recommendedCoffees as coffee}
				<a
					href={coffee.link}
					target="_blank"
					class="block rounded-lg border bg-zinc-700 p-4 transition-colors hover:bg-zinc-800 hover:shadow-md"
				>
					<h4 class="font-semibold">{coffee.name}</h4>
					<p class="mt-2 text-sm text-zinc-100">{coffee.reason}</p>
					<div class="mt-4">
						<span class="text-sm text-zinc-100">Score: {coffee.score_value}</span>
						<span class="ml-4 text-sm text-zinc-100">${coffee.cost_lb}/lb</span>
					</div>
				</a>
			{/each}
		</div>
	</div>
{/if}

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
						<tr
							class="cursor-pointer border-b border-zinc-700 bg-zinc-800 transition-colors hover:bg-zinc-700"
							on:click={() => {
								if (row.link) {
									window.open(row.link, '_blank');
								}
							}}
						>
							{#each getOrderedKeys(row) as key}
								<td class="max-w-[200px] px-6 py-4 text-xs text-zinc-300">
									<div class="break-words">
										{#if key === 'link' && row[key as keyof typeof row]}
											<a
												href={String(row[key as keyof typeof row])}
												target="_blank"
												class="text-blue-400 hover:underline"
												on:click|stopPropagation>Link</a
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
