<script lang="ts">
	import { untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { filterStore } from '$lib/stores/filterStore';
	import {
		STOCKED_WINDOWS,
		catalogFilterLock,
		readRange,
		type CatalogFilterAccess
	} from '$lib/catalog/filterModel';
	import {
		arrivalOptionOrder,
		countedOptions,
		familyNotes,
		selectedList,
		selectedOne,
		vocabularyOptions
	} from '$lib/catalog/filterOptionsView';
	import {
		formatProcessDisplayValue,
		isPublicProcessFacetOption
	} from '$lib/catalog/processDisplay';
	import { formatSourceName } from '$lib/utils/formatters';
	import FilterChips from './FilterChips.svelte';
	import SearchableChecklist from './SearchableChecklist.svelte';
	import LockedNotice from './LockedNotice.svelte';
	import RangeFields from './RangeFields.svelte';

	interface Props {
		access: CatalogFilterAccess;
		resultCount: number;
		activeFilterCount: number;
		onClose: () => void;
	}

	let { access, resultCount, activeFilterCount, onClose }: Props = $props();

	let filters = $derived($filterStore.filters);
	let counts = $derived($filterStore.facetCounts);
	let values = $derived($filterStore.uniqueValues);
	let vocabulary = $derived($filterStore.vocabulary);
	let optionsStatus = $derived($filterStore.optionsStatus);
	// Shown in place of an option list that has nothing to list yet.
	let optionsNote = $derived(
		optionsStatus === 'loading'
			? 'Loading options'
			: optionsStatus === 'unavailable'
				? 'Options are unavailable right now.'
				: 'None in these results.'
	);

	// ── Origin and supplier ───────────────────────────────────────────────────
	let continent = $derived(selectedOne(filters.continent));
	let continentOptions = $derived(
		countedOptions({
			values: values.continents,
			counts: counts.continents,
			selected: continent,
			sort: 'label'
		})
	);
	let countries = $derived(selectedList(filters.country));
	let countryOptions = $derived(
		countedOptions({
			values: values.countries,
			counts: counts.countries,
			selected: countries,
			sort: 'label'
		})
	);
	let suppliers = $derived(selectedList(filters.source));
	let supplierOptions = $derived(
		countedOptions({
			values: values.sources,
			counts: counts.sources,
			selected: suppliers,
			label: formatSourceName,
			sort: 'label'
		})
	);
	// Regions number in the hundreds, so the field suggests the most common ones
	// and accepts any text.
	let regionSuggestions = $derived((counts.regions ?? []).map((entry) => entry.value));
	let supplierScope = $derived(
		$filterStore.wholesaleOnly ? 'wholesale' : $filterStore.showWholesale ? 'all' : 'hobbyist'
	);
	let wholesaleOnlyLock = $derived(catalogFilterLock(access, 'wholesaleOnly'));

	// ── Process ───────────────────────────────────────────────────────────────
	let processLock = $derived(catalogFilterLock(access, 'process'));
	let baseMethod = $derived(selectedOne(filters.processing_base_method));
	let fermentation = $derived(selectedOne(filters.fermentation_type));
	let additive = $derived(selectedOne(filters.process_additive));
	let dryingMethods = $derived(selectedList(filters.drying_method_code));
	function processOptions(key: string, facet: string, selected: string[]) {
		return countedOptions({
			values: values[key === 'process_additive' ? 'process_additives' : key],
			counts: counts[facet],
			selected,
			label: formatProcessDisplayValue,
			keep: isPublicProcessFacetOption
		});
	}
	let additiveState = $derived(
		filters.has_additives === true ? ['yes'] : filters.has_additives === false ? ['no'] : []
	);
	let dryingOptions = $derived(
		vocabularyOptions({
			entries: vocabulary?.drying_methods,
			counts: counts.drying_methods,
			selected: dryingMethods
		})
	);
	let dryingNotes = $derived(familyNotes(vocabulary?.drying_methods));

	// ── Variety ───────────────────────────────────────────────────────────────
	let varietyLock = $derived(catalogFilterLock(access, 'variety'));
	let varieties = $derived(selectedList(filters.variety_code));
	let varietyOptions = $derived(
		vocabularyOptions({
			entries: vocabulary?.varieties,
			counts: counts.varieties,
			selected: varieties
		})
	);
	let species = $derived(selectedList(filters.species_code));
	let speciesOptions = $derived(
		vocabularyOptions({
			entries: vocabulary?.species,
			counts: counts.species_codes,
			selected: species
		})
	);
	let unstandardized = $derived($filterStore.unstandardizedVarietyCount);

	// ── Freshness ─────────────────────────────────────────────────────────────
	let freshnessLock = $derived(catalogFilterLock(access, 'freshness'));
	let stockedDays = $derived(filters.stocked_days ? [String(filters.stocked_days)] : []);
	let arrivalOptions = $derived(
		arrivalOptionOrder(
			countedOptions({
				values: values.arrivalDates,
				counts: counts.arrivalDates,
				selected: selectedOne(filters.arrival_date),
				sort: 'given'
			})
		)
	);

	// ── Elevation and cup score ───────────────────────────────────────────────
	let elevationLock = $derived(catalogFilterLock(access, 'elevation'));
	let elevation = $derived(readRange(filters.elevation_masl));
	let scoreLock = $derived(catalogFilterLock(access, 'score'));
	let score = $derived(readRange(filters.score_value));

	// A section starts open when it already holds a filter. After that the
	// viewer decides: a count refresh must not close what they opened.
	let sections = $state(
		untrack(() => {
			const active = get(filterStore).filters;
			const has = (...keys: string[]) =>
				keys.some((key) => {
					const value = active[key];
					return Array.isArray(value) ? value.length > 0 : Boolean(value);
				});
			return {
				origin: true,
				process: catalogFilterLock(access, 'process') === null,
				variety: has('variety_code', 'species_code', 'cultivar_detail'),
				freshness: has('stocked_days', 'arrival_date'),
				ranges: has('elevation_masl', 'score_value')
			};
		})
	);

	const sectionClass = 'border-b border-line px-5 py-4';
	const summaryClass =
		'flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink';
</script>

<div class="flex h-full flex-col" data-catalog-filter-panel>
	<header class="flex items-center justify-between border-b border-line px-5 py-4">
		<div class="flex min-w-0 items-baseline gap-3">
			<h2 class="text-lg font-semibold text-ink" id="catalog-filters-title">Filters</h2>
			<p class="text-xs text-muted" aria-live="polite">
				{optionsStatus === 'loading' && Object.keys(counts).length > 0 ? 'Updating counts' : ''}
			</p>
		</div>
		<button
			type="button"
			onclick={onClose}
			class="rounded-md p-2 text-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			aria-label="Close filters"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				class="h-5 w-5"
				viewBox="0 0 20 20"
				fill="currentColor"
			>
				<path
					d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z"
				/>
			</svg>
		</button>
	</header>

	<div class="min-h-0 flex-1 overflow-y-auto">
		<details bind:open={sections.origin} class={sectionClass}>
			<summary class={summaryClass}>Origin and supplier</summary>
			<div class="mt-4 space-y-5">
				<FilterChips
					legend="Continent"
					options={continentOptions}
					emptyText={optionsNote}
					selected={continent}
					onChange={(next) => filterStore.setFilter('continent', next[0] ?? '')}
				/>
				<SearchableChecklist
					id="catalog-panel-country"
					label="Country"
					searchPlaceholder="Search countries"
					options={countryOptions}
					emptyText={optionsNote}
					selected={countries}
					onChange={(next) => filterStore.setFilter('country', next)}
				/>
				<div>
					<label for="catalog-panel-region" class="text-xs font-semibold text-ink">Region</label>
					<input
						id="catalog-panel-region"
						type="search"
						list="catalog-panel-region-suggestions"
						value={filters.region ?? ''}
						onchange={(event) => filterStore.setFilter('region', event.currentTarget.value.trim())}
						placeholder="Type a region, such as Huila"
						class="mt-1.5 w-full rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
					/>
					<datalist id="catalog-panel-region-suggestions">
						{#each regionSuggestions as region (region)}
							<option value={region}></option>
						{/each}
					</datalist>
				</div>
				<SearchableChecklist
					id="catalog-panel-supplier"
					label="Supplier"
					searchPlaceholder="Search suppliers"
					options={supplierOptions}
					emptyText={optionsNote}
					selected={suppliers}
					onChange={(next) => filterStore.setFilter('source', next)}
				/>
				<fieldset>
					<legend class="mb-2 text-xs font-semibold text-ink">Supplier type</legend>
					<div class="space-y-1.5 text-sm text-ink">
						{#each [{ value: 'all', label: 'All suppliers' }, { value: 'hobbyist', label: 'Hobbyist suppliers only' }, { value: 'wholesale', label: 'Wholesale suppliers only' }] as option (option.value)}
							{@const locked = option.value === 'wholesale' && wholesaleOnlyLock !== null}
							<label class="flex items-center gap-2 {locked ? 'opacity-50' : ''}">
								<input
									type="radio"
									name="catalog-supplier-scope"
									value={option.value}
									checked={supplierScope === option.value}
									disabled={locked}
									onchange={() =>
										filterStore.setSupplierScope(option.value as 'all' | 'hobbyist' | 'wholesale')}
									class="h-4 w-4 border border-line text-accent focus:ring-2 focus:ring-accent"
								/>
								<span>{option.label}</span>
							</label>
						{/each}
					</div>
					{#if wholesaleOnlyLock}
						<div class="mt-2"><LockedNotice lock={wholesaleOnlyLock} compact /></div>
					{/if}
				</fieldset>
			</div>
		</details>

		<details bind:open={sections.process} class={sectionClass}>
			<summary class={summaryClass}>Process</summary>
			<div class="mt-4 space-y-5">
				{#if processLock}
					<LockedNotice lock={processLock} />
				{:else}
					<FilterChips
						legend="Method"
						options={processOptions('processing_base_method', 'processing_base_method', baseMethod)}
						emptyText={optionsNote}
						selected={baseMethod}
						onChange={(next) => filterStore.setFilter('processing_base_method', next[0] ?? '')}
					/>
					<FilterChips
						legend="Fermentation"
						options={processOptions('fermentation_type', 'fermentation_type', fermentation)}
						emptyText={optionsNote}
						selected={fermentation}
						onChange={(next) => filterStore.setFilter('fermentation_type', next[0] ?? '')}
					/>
					<FilterChips
						legend="Additive"
						options={processOptions('process_additive', 'process_additives', additive)}
						emptyText={optionsNote}
						selected={additive}
						onChange={(next) => filterStore.setFilter('process_additive', next[0] ?? '')}
					/>
					<FilterChips
						legend="Additives disclosed"
						options={[
							{ value: 'yes', label: 'Has additives' },
							{ value: 'no', label: 'No additives' }
						]}
						selected={additiveState}
						onChange={(next) =>
							filterStore.setFilter('has_additives', next.length === 0 ? '' : next[0] === 'yes')}
					/>
					<div>
						<FilterChips
							legend="Drying"
							multiple
							options={dryingOptions}
							emptyText={optionsNote}
							selected={dryingMethods}
							onChange={(next) => filterStore.setFilter('drying_method_code', next)}
						/>
						{#each dryingNotes as note (note)}
							<p class="mt-2 text-xs text-muted">{note}</p>
						{/each}
					</div>
				{/if}
			</div>
		</details>

		<details bind:open={sections.variety} class={sectionClass}>
			<summary class={summaryClass}>Variety</summary>
			<div class="mt-4 space-y-5">
				{#if varietyLock}
					<div>
						<label for="catalog-panel-variety-text" class="text-xs font-semibold text-ink"
							>Variety name</label
						>
						<input
							id="catalog-panel-variety-text"
							type="search"
							value={filters.cultivar_detail ?? ''}
							onchange={(event) =>
								filterStore.setFilter('cultivar_detail', event.currentTarget.value.trim())}
							placeholder="Type a variety, such as Gesha"
							class="mt-1.5 w-full rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
						/>
						<p class="mt-2 text-xs text-muted">Matches the variety as each supplier wrote it.</p>
					</div>
					<LockedNotice lock={varietyLock} />
				{:else}
					<SearchableChecklist
						id="catalog-panel-variety"
						label="Variety"
						searchPlaceholder="Search varieties, such as Gesha"
						options={varietyOptions}
						emptyText={optionsNote}
						selected={varieties}
						noMatchText="No variety by that name yet."
						onChange={(next) => filterStore.setFilter('variety_code', next)}
					/>
					<p class="text-xs text-muted">
						Choosing a family, such as Bourbon, includes the varieties listed under it.
					</p>
					{#if unstandardized !== null && unstandardized > 0}
						<p class="text-xs text-muted" data-unstandardized-variety>
							{unstandardized.toLocaleString()}
							{unstandardized === 1 ? 'coffee' : 'coffees'} matching your other filters
							{unstandardized === 1 ? 'has' : 'have'} no standardized variety, so
							{unstandardized === 1 ? 'it' : 'they'} cannot match a variety chosen here.
						</p>
					{/if}
					<FilterChips
						legend="Species"
						multiple
						options={speciesOptions}
						emptyText={optionsNote}
						selected={species}
						onChange={(next) => filterStore.setFilter('species_code', next)}
					/>
				{/if}
			</div>
		</details>

		<details bind:open={sections.freshness} class={sectionClass}>
			<summary class={summaryClass}>Freshness</summary>
			<div class="mt-4 space-y-5">
				<div>
					<FilterChips
						legend="Stocked by Purveyors in the"
						options={STOCKED_WINDOWS.map((window) => ({
							value: String(window.days),
							label: window.label
						}))}
						selected={stockedDays}
						disabled={freshnessLock !== null}
						onChange={(next) => filterStore.setFilter('stocked_days', next[0] ?? '')}
					/>
					{#if freshnessLock}
						<div class="mt-2"><LockedNotice lock={freshnessLock} compact /></div>
					{:else}
						<p class="mt-2 text-xs text-muted">
							Counts from the day a coffee first appeared in this catalog, not the supplier's
							arrival date.
						</p>
					{/if}
				</div>
				<div>
					<label for="catalog-panel-arrival" class="text-xs font-semibold text-ink"
						>Supplier arrival</label
					>
					<select
						id="catalog-panel-arrival"
						value={filters.arrival_date ?? ''}
						onchange={(event) => filterStore.setFilter('arrival_date', event.currentTarget.value)}
						class="mt-1.5 w-full rounded-md border border-line bg-surface-canvas px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="">Any arrival</option>
						{#each arrivalOptions as option (option.value)}
							<option value={option.value}
								>{option.label}{option.count !== null && option.count !== undefined
									? ` (${option.count.toLocaleString()})`
									: ''}</option
							>
						{/each}
					</select>
				</div>
			</div>
		</details>

		<details bind:open={sections.ranges} class={sectionClass}>
			<summary class={summaryClass}>Elevation and cup score</summary>
			<div class="mt-4 space-y-5">
				<div>
					<RangeFields
						legend="Growing elevation (meters above sea level)"
						idPrefix="catalog-panel-elevation"
						unit="elevation"
						step={50}
						min={elevation.min}
						max={elevation.max}
						disabled={elevationLock !== null}
						includeUnknown={elevation.includeUnknown === true}
						includeUnknownLabel="Include coffees with no stated elevation"
						onChange={(range) =>
							filterStore.setFilter('elevation_masl', {
								min: range.min,
								max: range.max,
								...(range.includeUnknown ? { includeUnknown: true } : {})
							})}
					/>
					{#if elevationLock}
						<div class="mt-2"><LockedNotice lock={elevationLock} compact /></div>
					{:else}
						<p class="mt-2 text-xs text-muted">
							Matches coffees whose stated elevation range overlaps yours.
						</p>
					{/if}
				</div>
				<div>
					<RangeFields
						legend="Supplier cup score"
						idPrefix="catalog-panel-score"
						unit="score"
						step={0.5}
						highest={100}
						min={score.min}
						max={score.max}
						disabled={scoreLock !== null}
						onChange={(range) =>
							filterStore.setFilter('score_value', { min: range.min, max: range.max })}
					/>
					{#if scoreLock}
						<div class="mt-2"><LockedNotice lock={scoreLock} compact /></div>
					{:else}
						<p class="mt-2 text-xs text-muted">
							Scores are each supplier's own and are not measured on one scale.
						</p>
					{/if}
				</div>
			</div>
		</details>
	</div>

	<footer class="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
		<button
			type="button"
			onclick={() => filterStore.clearFilters()}
			disabled={activeFilterCount === 0}
			class="text-sm text-link hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
		>
			Clear all
		</button>
		<button
			type="button"
			onclick={onClose}
			class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
		>
			Show {resultCount.toLocaleString()}
			{resultCount === 1 ? 'coffee' : 'coffees'}
		</button>
	</footer>
</div>
