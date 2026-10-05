<script lang="ts">
	import { untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { filterStore } from '$lib/stores/filterStore';
	import {
		GRADE_KINDS,
		STOCKED_WINDOWS,
		catalogFilterLock,
		gradeLabel,
		isStatedScoreProtocol,
		readRange,
		scoreProtocolLabel,
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

	// ── Grade and quality ─────────────────────────────────────────────────────
	let gradingLock = $derived(catalogFilterLock(access, 'grading'));
	let scoreLock = $derived(catalogFilterLock(access, 'score'));
	let grades = $derived($filterStore.grades);
	let gradeCodes = $derived(selectedList(filters.grade_code));
	// One selection spans every kind of grade, so each group shows its own
	// designations and writes the whole selection back.
	let gradeGroups = $derived(
		GRADE_KINDS.map((kind) => {
			const ofKind = (code: string) => {
				const known = grades?.find((grade) => grade.code === code);
				return known
					? known.dimensions.includes(kind.dimension)
					: (counts[kind.facet] ?? []).some((entry) => entry.value === code);
			};
			return {
				...kind,
				options: countedOptions({
					values: values[kind.facet],
					counts: counts[kind.facet],
					selected: gradeCodes.filter(ofKind),
					label: (code) => gradeLabel(grades, code)
				}).map((option) => ({
					...option,
					title: grades?.find((grade) => grade.code === option.value)?.description
				}))
			};
		}).filter((group) => group.options.length > 0)
	);
	let lotFacts = $derived([
		...(filters.peaberry === true ? ['peaberry'] : []),
		...(filters.lab_analyzed === true ? ['lab_analyzed'] : [])
	]);
	let screen = $derived(readRange(filters.screen_size));
	let screenSizes = $derived(
		[...(counts.screen_size_min ?? [])].sort((a, b) => Number(a.value) - Number(b.value))
	);
	let elevation = $derived(readRange(filters.elevation_masl));
	// Parchment counts stated elevations in 200 m bands, named "1200-1399".
	let elevationBands = $derived(
		[...(counts.elevation_band ?? [])]
			.map((entry) => {
				const [low, high] = entry.value.split('-').map(Number);
				return { low, high, count: entry.count, value: entry.value };
			})
			.filter((band) => Number.isFinite(band.low) && Number.isFinite(band.high))
			.sort((a, b) => a.low - b.low)
	);
	let elevationBand = $derived(
		elevationBands.find(
			(band) =>
				String(elevation.min) === String(band.low) && String(elevation.max) === String(band.high)
		)?.value
	);
	let score = $derived(readRange(filters.score_value));
	let scoreProtocol = $derived(
		typeof filters.score_protocol === 'string' ? filters.score_protocol : ''
	);
	let scoreProtocols = $derived(counts.score_protocols ?? []);
	// A choice is only worth offering when some coffee states its protocol.
	let offerScoreProtocol = $derived(
		scoreProtocol !== '' || scoreProtocols.some((entry) => isStatedScoreProtocol(entry.value))
	);

	function setScoreProtocol(next: string) {
		// Scores are ranked only within one stated protocol; leaving it ends that order.
		if ($filterStore.sortField === 'score_value' && !isStatedScoreProtocol(next)) {
			filterStore.setSort(null, null);
		}
		filterStore.setFilter('score_protocol', next);
	}

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
				grading: has(
					'grade_code',
					'peaberry',
					'lab_analyzed',
					'screen_size',
					'moisture_max',
					'elevation_masl',
					'score_value',
					'score_protocol'
				)
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

		<details bind:open={sections.grading} class={sectionClass} data-catalog-grading>
			<summary class={summaryClass}>Grade and quality</summary>
			<div class="mt-4 space-y-5">
				{#if gradingLock}
					<LockedNotice lock={gradingLock} />
				{:else}
					<div class="space-y-4">
						{#each gradeGroups as group (group.dimension)}
							<FilterChips
								legend={`${group.label} grade`}
								multiple
								options={group.options}
								selected={gradeCodes}
								onChange={(next) => filterStore.setFilter('grade_code', next)}
							/>
						{:else}
							<p class="text-sm text-muted">
								<span class="block text-xs font-semibold text-ink">Grade</span>
								{optionsNote}
							</p>
						{/each}
						{#if gradeGroups.length > 0}
							<p class="text-xs text-muted">
								Matches coffees carrying any grade you select, across all groups.
							</p>
						{/if}
					</div>
					<FilterChips
						legend="Lot facts"
						multiple
						options={[
							{ value: 'peaberry', label: 'Peaberry' },
							{ value: 'lab_analyzed', label: 'Lab analyzed' }
						]}
						selected={lotFacts}
						onChange={(next) =>
							filterStore.setFilters({
								peaberry: next.includes('peaberry') ? true : '',
								lab_analyzed: next.includes('lab_analyzed') ? true : ''
							})}
					/>
					<div>
						<RangeFields
							legend="Screen size (64ths of an inch)"
							idPrefix="catalog-panel-screen"
							unit="screen size"
							step={1}
							lowest={8}
							highest={20}
							min={screen.min}
							max={screen.max}
							includeUnknown={screen.includeUnknown === true}
							includeUnknownLabel="Include coffees with no stated screen size"
							onChange={(range) =>
								filterStore.setFilter('screen_size', {
									min: range.min,
									max: range.max,
									...(range.includeUnknown ? { includeUnknown: true } : {})
								})}
						/>
						{#if screenSizes.length > 0}
							<p class="mt-2 text-xs text-muted" data-screen-sizes>
								Stated smallest screen:
								{screenSizes
									.map((entry) => `${entry.value} (${entry.count.toLocaleString()})`)
									.join(', ')}
							</p>
						{/if}
					</div>
					<div>
						<label for="catalog-panel-moisture" class="text-xs font-semibold text-ink"
							>Moisture at most (%)</label
						>
						<input
							id="catalog-panel-moisture"
							type="number"
							inputmode="decimal"
							min="0"
							max="20"
							step="0.1"
							placeholder="For example 11"
							value={filters.moisture_max ?? ''}
							onchange={(event) => {
								const next = Number(event.currentTarget.value);
								filterStore.setFilter(
									'moisture_max',
									event.currentTarget.value !== '' && Number.isFinite(next) && next > 0 ? next : ''
								);
							}}
							class="mt-1.5 w-full rounded-md border border-line bg-surface-canvas px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
						/>
						<p class="mt-2 text-xs text-muted">
							Only coffees with a stated moisture reading match.
						</p>
					</div>
					<div>
						<RangeFields
							legend="Growing elevation (meters above sea level)"
							idPrefix="catalog-panel-elevation"
							unit="elevation"
							step={50}
							min={elevation.min}
							max={elevation.max}
							includeUnknown={elevation.includeUnknown === true}
							includeUnknownLabel="Include coffees with no stated elevation"
							onChange={(range) =>
								filterStore.setFilter('elevation_masl', {
									min: range.min,
									max: range.max,
									...(range.includeUnknown ? { includeUnknown: true } : {})
								})}
						/>
						{#if elevationBands.length > 0}
							<div class="mt-3">
								<FilterChips
									legend="Elevation band"
									hideLegend
									options={elevationBands.map((band) => ({
										value: band.value,
										label: `${band.low.toLocaleString()} to ${band.high.toLocaleString()} m`,
										count: band.count
									}))}
									selected={elevationBand ? [elevationBand] : []}
									onChange={(next) => {
										const band = elevationBands.find((entry) => entry.value === next[0]);
										filterStore.setFilter(
											'elevation_masl',
											band
												? {
														min: String(band.low),
														max: String(band.high),
														...(elevation.includeUnknown ? { includeUnknown: true } : {})
													}
												: ''
										);
									}}
								/>
							</div>
						{/if}
						<p class="mt-2 text-xs text-muted">
							Matches coffees whose stated elevation range overlaps yours.
						</p>
					</div>
					<div>
						<RangeFields
							legend="Cup score"
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
						{:else if offerScoreProtocol}
							<label
								for="catalog-panel-score-protocol"
								class="mt-3 block text-xs font-semibold text-ink">Scoring protocol</label
							>
							<select
								id="catalog-panel-score-protocol"
								value={scoreProtocol}
								onchange={(event) => setScoreProtocol(event.currentTarget.value)}
								class="mt-1.5 w-full rounded-md border border-line bg-surface-canvas px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
							>
								<option value="">Any protocol</option>
								{#each scoreProtocols as entry (entry.value)}
									<option value={entry.value}
										>{scoreProtocolLabel(entry.value)} ({entry.count.toLocaleString()})</option
									>
								{/each}
								{#if scoreProtocol !== '' && !scoreProtocols.some((entry) => entry.value === scoreProtocol)}
									<option value={scoreProtocol}>{scoreProtocolLabel(scoreProtocol)}</option>
								{/if}
							</select>
							<p class="mt-2 text-xs text-muted">
								{isStatedScoreProtocol(scoreProtocol)
									? 'These scores share one scale, so you can also sort by cup score.'
									: 'Scores are only ranked against each other within one stated protocol.'}
							</p>
						{:else}
							<p class="mt-2 text-xs text-muted" data-score-protocol-note>
								No supplier in these results says which protocol its score follows, so scores are
								each supplier's own and are not ranked against each other.
							</p>
						{/if}
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
