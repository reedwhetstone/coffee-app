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
	// True from a key until what was typed is applied. Until then the box is the member's:
	// the search in the address does not replace it.
	let searchPending = false;
	$effect(() => {
		const applied = filters.q;
		untrack(() => {
			if (!searchPending && applied !== searchText.trim()) searchText = applied;
		});
	});
	$effect(() => () => clearTimeout(searchTimer));

	// Every control changes the filters through here, so a search still being typed goes
	// with the change and is not lost to it.
	function change(next: Partial<RoastListFilters>) {
		clearTimeout(searchTimer);
		searchPending = false;
		onChange({ ...filters, ...next, q: searchText.trim() });
	}

	function applySearch() {
		clearTimeout(searchTimer);
		searchPending = false;
		if (searchText.trim() !== filters.q) change({});
	}

	function typeSearch(value: string) {
		searchText = value;
		searchPending = true;
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
			if (filters.range !== null) change({ range: null });
			return;
		}
		const range = ROAST_RANGES.find((option) => option.value === value)?.value ?? null;
		change({ range, from: null, to: null });
	}

	function setDay(end: 'from' | 'to', value: string) {
		change({ range: null, [end]: value || null });
	}

	function clearFilters() {
		clearTimeout(searchTimer);
		searchPending = false;
		searchText = '';
		customOpen = false;
		onChange(NO_ROAST_LIST_FILTERS);
	}

	const fieldClass =
		'min-w-0 max-w-full rounded-md border border-line bg-surface-canvas py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent';
	// Room on the right for the select's arrow, so a long choice is not drawn under it.
	const selectClass = `${fieldClass} pl-2 pr-8`;
	const dateClass = `${fieldClass} px-2`;
</script>

<div class="mb-4 rounded-lg border border-line bg-surface-panel px-4 py-3" data-roast-list-controls>
	<div class="flex flex-wrap items-center gap-2">
		<div class="min-w-[11rem] flex-1 basis-full sm:basis-auto">
			<input
				type="search"
				aria-label="Search roasts"
				value={searchText}
				maxlength={MAX_ROAST_SEARCH_LENGTH}
				oninput={(event) => typeSearch(event.currentTarget.value)}
				onkeydown={(event) => {
					if (event.key === 'Enter') applySearch();
				}}
				placeholder="Coffee, batch, or roast number"
				class="w-full rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
			/>
		</div>

		<!-- On a phone the coffee and the date share a row, under the search. -->
		<div class="flex min-w-0 basis-full gap-2 sm:basis-auto">
			<select
				aria-label="Coffee"
				value={filters.coffee === null ? '' : String(filters.coffee)}
				onchange={(event) =>
					change({
						coffee: event.currentTarget.value ? Number(event.currentTarget.value) : null
					})}
				class="{selectClass} flex-1 sm:max-w-[16rem] sm:flex-none"
			>
				<option value="">All coffees</option>
				{#each coffeeChoices as option (option.id)}
					<option value={String(option.id)}>{option.name}</option>
				{/each}
			</select>

			<select
				aria-label="Roast date"
				value={dateChoice}
				onchange={(event) => chooseDates(event.currentTarget.value)}
				class="{selectClass} shrink-0"
			>
				<option value="">Any time</option>
				{#each ROAST_RANGES as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
				<option value="custom">Custom dates</option>
			</select>
		</div>

		<FilterChips
			legend="Retail or wholesale"
			hideLegend
			options={MARKETS}
			selected={[filters.market ?? 'all']}
			onChange={(next) => {
				const choice = next[0];
				change({ market: choice === 'retail' || choice === 'wholesale' ? choice : null });
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
					class={dateClass}
				/>
			</label>
			<label class="inline-flex items-center gap-2">
				<span>To</span>
				<input
					type="date"
					value={filters.to ?? ''}
					min={filters.from ?? undefined}
					onchange={(event) => setDay('to', event.currentTarget.value)}
					class={dateClass}
				/>
			</label>
		</div>
	{/if}
</div>
