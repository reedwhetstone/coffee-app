<script lang="ts">
	import { filterStore } from '$lib/stores/filterStore';
	import {
		PRICE_PRESETS,
		activePricePresetId,
		catalogFilterLock,
		catalogSortOptions,
		readRange,
		type CatalogFilterAccess
	} from '$lib/catalog/filterModel';
	import { countedOptions, selectedList, selectedOne } from '$lib/catalog/filterOptionsView';
	import {
		formatProcessDisplayValue,
		isPublicProcessFacetOption
	} from '$lib/catalog/processDisplay';
	import { dismissOnOutsidePointer } from '$lib/utils/dismissOnOutsidePointer';
	import FilterChips from './FilterChips.svelte';
	import SearchableChecklist from './SearchableChecklist.svelte';
	import LockedNotice from './LockedNotice.svelte';

	interface Props {
		access: CatalogFilterAccess;
		/** Active filters whose controls live in the panel. */
		panelFilterCount: number;
		onOpenPanel: () => void;
	}

	let { access, panelFilterCount, onOpenPanel }: Props = $props();

	let openMenu = $state<'origin' | 'price' | null>(null);

	let countries = $derived(selectedList($filterStore.filters.country));
	let countryOptions = $derived(
		countedOptions({
			values: $filterStore.uniqueValues.countries,
			counts: $filterStore.facetCounts.countries,
			selected: countries,
			sort: 'label'
		})
	);

	let processLock = $derived(catalogFilterLock(access, 'process'));
	let baseMethod = $derived(selectedOne($filterStore.filters.processing_base_method));
	let baseMethodOptions = $derived(
		countedOptions({
			values: $filterStore.uniqueValues.processing_base_method,
			counts: $filterStore.facetCounts.processing_base_method,
			selected: baseMethod,
			label: formatProcessDisplayValue,
			keep: isPublicProcessFacetOption
		})
	);
	let legacyProcessOptions = $derived(
		countedOptions({
			values: $filterStore.uniqueValues.processing,
			counts: $filterStore.facetCounts.processing,
			selected: selectedOne($filterStore.filters.processing),
			sort: 'label'
		})
	);

	let priceLock = $derived(catalogFilterLock(access, 'price'));
	let price = $derived(readRange($filterStore.filters.cost_lb));
	let pricePreset = $derived(activePricePresetId($filterStore.filters.cost_lb));
	let priceActive = $derived(String(price.min) !== '' || String(price.max) !== '');
	let priceSummary = $derived(
		PRICE_PRESETS.find((preset) => preset.id === pricePreset)?.label ??
			(priceActive ? 'Custom' : null)
	);

	// Shown in place of an option list that has nothing to list yet.
	let optionsNote = $derived(
		$filterStore.optionsStatus === 'loading'
			? 'Loading options'
			: $filterStore.optionsStatus === 'unavailable'
				? 'Options are unavailable right now.'
				: 'None in these results.'
	);

	let sort = $derived(
		catalogSortOptions(access, {
			field: $filterStore.sortField,
			direction: $filterStore.sortDirection
		})
	);

	function setPrice(min: string, max: string) {
		filterStore.setFilter('cost_lb', { min, max });
	}

	function setSort(id: string) {
		const option = sort.options.find((candidate) => candidate.id === id);
		if (!option || option.locked) return;
		filterStore.setSort(option.field, option.direction);
	}

	const menuButtonClass =
		'inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';
	const menuPanelClass =
		'absolute left-0 top-full z-30 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-surface-canvas p-3 shadow-lg';
</script>

<div class="rounded-lg border border-line bg-surface-panel px-4 py-3" data-catalog-primary-row>
	<div class="flex flex-wrap items-center gap-2">
		<label class="min-w-[11rem] flex-1">
			<span class="sr-only">Search coffee names</span>
			<input
				type="search"
				value={$filterStore.filters.name ?? ''}
				oninput={(event) => filterStore.setFilter('name', event.currentTarget.value)}
				placeholder="Search coffee names"
				class="w-full rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
			/>
		</label>

		<div class="relative">
			<button
				type="button"
				class={menuButtonClass}
				aria-expanded={openMenu === 'origin'}
				aria-controls="catalog-origin-menu"
				onclick={() => (openMenu = openMenu === 'origin' ? null : 'origin')}
			>
				Origin
				{#if countries.length > 0}
					<span class="rounded-full bg-accent/20 px-1.5 text-xs font-semibold tabular-nums"
						>{countries.length}</span
					>
				{/if}
			</button>
			{#if openMenu === 'origin'}
				<div
					id="catalog-origin-menu"
					class={menuPanelClass}
					use:dismissOnOutsidePointer={() => (openMenu = null)}
				>
					<SearchableChecklist
						id="catalog-origin-search"
						label="Origin country"
						searchPlaceholder="Search countries"
						options={countryOptions}
						selected={countries}
						emptyText={optionsNote}
						onChange={(next) => filterStore.setFilter('country', next)}
					/>
				</div>
			{/if}
		</div>

		<div class="relative">
			<button
				type="button"
				class={menuButtonClass}
				aria-expanded={openMenu === 'price'}
				aria-controls="catalog-price-menu"
				onclick={() => (openMenu = openMenu === 'price' ? null : 'price')}
			>
				Price per lb
				{#if priceSummary}
					<span class="rounded-full bg-accent/20 px-1.5 text-xs font-semibold">{priceSummary}</span>
				{/if}
			</button>
			{#if openMenu === 'price'}
				<div
					id="catalog-price-menu"
					class={menuPanelClass}
					use:dismissOnOutsidePointer={() => (openMenu = null)}
				>
					<FilterChips
						legend="Price per lb"
						options={PRICE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
						selected={pricePreset ? [pricePreset] : []}
						disabled={priceLock !== null}
						onChange={(next) => {
							const preset = PRICE_PRESETS.find((candidate) => candidate.id === next[0]);
							setPrice(preset?.min ?? '', preset?.max ?? '');
						}}
					/>
					<div class="mt-3 flex items-center gap-2">
						<label class="flex-1">
							<span class="sr-only">Lowest price per lb</span>
							<input
								type="number"
								min="0"
								step="0.5"
								inputmode="decimal"
								placeholder="Min $"
								disabled={priceLock !== null}
								value={price.min}
								onchange={(event) => setPrice(event.currentTarget.value, String(price.max))}
								class="w-full rounded-md border border-line bg-surface-canvas px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
							/>
						</label>
						<span class="text-sm text-muted">to</span>
						<label class="flex-1">
							<span class="sr-only">Highest price per lb</span>
							<input
								type="number"
								min="0"
								step="0.5"
								inputmode="decimal"
								placeholder="Max $"
								disabled={priceLock !== null}
								value={price.max}
								onchange={(event) => setPrice(String(price.min), event.currentTarget.value)}
								class="w-full rounded-md border border-line bg-surface-canvas px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
							/>
						</label>
					</div>
					{#if priceLock}
						<div class="mt-3"><LockedNotice lock={priceLock} compact /></div>
					{/if}
				</div>
			{/if}
		</div>

		<label
			class="inline-flex items-center gap-2 rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink"
		>
			<input
				type="checkbox"
				checked={!$filterStore.includeUnstocked}
				onchange={(event) => filterStore.setIncludeUnstocked(!event.currentTarget.checked)}
				class="h-4 w-4 rounded border border-line text-accent focus:ring-2 focus:ring-accent"
			/>
			<span>In stock only</span>
		</label>

		<label class="inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-muted">
			<span>Sort</span>
			<select
				value={sort.activeId}
				onchange={(event) => setSort(event.currentTarget.value)}
				class="min-w-0 max-w-full rounded-md border border-line bg-surface-canvas px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
			>
				{#each sort.options as option (option.id)}
					<option value={option.id} disabled={option.locked}>
						{option.label}{option.locked ? ' (members)' : ''}
					</option>
				{/each}
			</select>
		</label>

		<button
			type="button"
			onclick={onOpenPanel}
			class="inline-flex items-center gap-1.5 rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-accent/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			aria-haspopup="dialog"
		>
			All filters
			{#if panelFilterCount > 0}
				<span
					class="rounded-full bg-accent px-1.5 text-xs font-semibold tabular-nums"
					aria-label={`${panelFilterCount} more active`}>{panelFilterCount}</span
				>
			{/if}
		</button>
	</div>

	<div class="mt-3">
		{#if processLock}
			<div class="flex flex-wrap items-center gap-x-3 gap-y-2">
				<label class="inline-flex min-w-0 max-w-full items-center gap-2 text-sm text-muted">
					<span>Process</span>
					<select
						value={$filterStore.filters.processing ?? ''}
						onchange={(event) => filterStore.setFilter('processing', event.currentTarget.value)}
						class="min-w-0 max-w-full rounded-md border border-line bg-surface-canvas px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="">Any process</option>
						{#each legacyProcessOptions as option (option.value)}
							<option value={option.value}
								>{option.label}{option.count !== null && option.count !== undefined
									? ` (${option.count.toLocaleString()})`
									: ''}</option
							>
						{/each}
					</select>
				</label>
				<LockedNotice lock={processLock} compact />
			</div>
		{:else}
			<FilterChips
				legend="Process"
				hideLegend
				options={baseMethodOptions}
				selected={baseMethod}
				emptyText={optionsNote}
				onChange={(next) => filterStore.setFilter('processing_base_method', next[0] ?? '')}
			/>
		{/if}
	</div>
</div>
