<script lang="ts">
	import { untrack } from 'svelte';
	import FilterChips from '$lib/components/catalog/filters/FilterChips.svelte';
	import type { RoastCoffeeOption } from '$lib/roast/roast-coffee-options';
	import {
		hasRoastListFilters,
		MAX_ROAST_SEARCH_LENGTH,
		NO_ROAST_LIST_FILTERS,
		ROAST_RANGES,
		type RoastListFilters
	} from '$lib/roast/roast-list-filters';

	interface Props {
		filters: RoastListFilters;
		/** The member's portfolio coffees. */
		coffeeOptions: RoastCoffeeOption[];
		/** The name of the coffee the list is narrowed to, when it is known. */
		coffeeName?: string | null;
		onChange: (filters: RoastListFilters) => void;
	}

	let { filters, coffeeOptions, coffeeName = null, onChange }: Props = $props();

	const SEARCH_DELAY_MS = 300;
	const MARKETS = [
		{ value: 'all', label: 'All' },
		{ value: 'retail', label: 'Retail' },
		{ value: 'wholesale', label: 'Wholesale' }
	];

	// What is typed is applied a moment after the last key, or at once on Enter.
	let searchText = $state(untrack(() => filters.q));
	let searchTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const applied = filters.q;
		untrack(() => {
			if (applied !== searchText.trim()) searchText = applied;
		});
	});
	$effect(() => () => clearTimeout(searchTimer));

	function applySearch() {
		clearTimeout(searchTimer);
		const q = searchText.trim();
		if (q !== filters.q) onChange({ ...filters, q });
	}

	function typeSearch(value: string) {
		searchText = value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(applySearch, SEARCH_DELAY_MS);
	}

	// The list may be narrowed to a coffee that is no longer in the portfolio's choices.
	let coffeeChoices = $derived(
		filters.coffee === null || coffeeOptions.some((option) => option.id === filters.coffee)
			? coffeeOptions
			: [{ id: filters.coffee, name: coffeeName ?? 'This coffee' }, ...coffeeOptions]
	);

	// "Custom dates" shows the two date fields before either holds a day.
	let customOpen = $state(false);
	let hasCustomDates = $derived(filters.from !== null || filters.to !== null);
	let showCustomDates = $derived(filters.range === null && (hasCustomDates || customOpen));
	let dateChoice = $derived(filters.range ?? (showCustomDates ? 'custom' : ''));

	function chooseDates(value: string) {
		customOpen = value === 'custom';
		if (value === 'custom') {
			if (filters.range !== null) onChange({ ...filters, range: null });
			return;
		}
		const range = ROAST_RANGES.find((option) => option.value === value)?.value ?? null;
		onChange({ ...filters, range, from: null, to: null });
	}

	function setDay(end: 'from' | 'to', value: string) {
		onChange({ ...filters, range: null, [end]: value || null });
	}

	function clearFilters() {
		clearTimeout(searchTimer);
		customOpen = false;
		onChange(NO_ROAST_LIST_FILTERS);
	}

	const selectClass =
		'min-w-0 max-w-full rounded-md border border-line bg-surface-canvas px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent';
</script>

<div class="mb-4 rounded-lg border border-line bg-surface-panel px-4 py-3" data-roast-list-controls>
	<div class="flex flex-wrap items-center gap-2">
		<label class="min-w-[11rem] flex-1 basis-full sm:basis-auto">
			<span class="sr-only">Search roasts</span>
			<input
				type="search"
				value={searchText}
				maxlength={MAX_ROAST_SEARCH_LENGTH}
				oninput={(event) => typeSearch(event.currentTarget.value)}
				onkeydown={(event) => {
					if (event.key === 'Enter') applySearch();
				}}
				placeholder="Coffee, batch, or roast number"
				class="w-full rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
			/>
		</label>

		<label class="min-w-0 max-w-full">
			<span class="sr-only">Coffee</span>
			<select
				value={filters.coffee === null ? '' : String(filters.coffee)}
				onchange={(event) =>
					onChange({
						...filters,
						coffee: event.currentTarget.value ? Number(event.currentTarget.value) : null
					})}
				class="{selectClass} sm:max-w-[16rem]"
			>
				<option value="">All coffees</option>
				{#each coffeeChoices as option (option.id)}
					<option value={String(option.id)}>{option.name}</option>
				{/each}
			</select>
		</label>

		<label class="min-w-0 max-w-full">
			<span class="sr-only">Roast date</span>
			<select
				value={dateChoice}
				onchange={(event) => chooseDates(event.currentTarget.value)}
				class={selectClass}
			>
				<option value="">Any time</option>
				{#each ROAST_RANGES as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
				<option value="custom">Custom dates</option>
			</select>
		</label>

		<FilterChips
			legend="Retail or wholesale"
			hideLegend
			options={MARKETS}
			selected={[filters.market ?? 'all']}
			onChange={(next) => {
				const choice = next[0];
				onChange({
					...filters,
					market: choice === 'retail' || choice === 'wholesale' ? choice : null
				});
			}}
		/>

		{#if hasRoastListFilters(filters)}
			<button type="button" onclick={clearFilters} class="text-sm text-link hover:text-accent">
				Clear all
			</button>
		{/if}
	</div>

	{#if showCustomDates}
		<div class="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
			<label class="inline-flex items-center gap-2">
				<span>From</span>
				<input
					type="date"
					value={filters.from ?? ''}
					max={filters.to ?? undefined}
					onchange={(event) => setDay('from', event.currentTarget.value)}
					class={selectClass}
				/>
			</label>
			<label class="inline-flex items-center gap-2">
				<span>To</span>
				<input
					type="date"
					value={filters.to ?? ''}
					min={filters.from ?? undefined}
					onchange={(event) => setDay('to', event.currentTarget.value)}
					class={selectClass}
				/>
			</label>
		</div>
	{/if}
</div>
