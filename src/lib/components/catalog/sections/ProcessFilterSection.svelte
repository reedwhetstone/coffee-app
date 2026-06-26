<script lang="ts">
	import { goto } from '$app/navigation';
	import { filterStore } from '$lib/stores/filterStore';
	import {
		formatProcessDisplayValue,
		isPublicProcessFacetOption
	} from '$lib/catalog/processDisplay';
	import { PROCESSING_CONFIDENCE_OPTIONS } from '$lib/catalog/urlState';

	interface CatalogAccessNotice {
		message: string;
	}

	interface Props {
		canUseProcessFacets: boolean;
		hasAdvancedProcessFilters: boolean;
		catalogAccessNotice: CatalogAccessNotice | null;
		onClearProcessTransparencyFilters: () => void;
	}

	let {
		canUseProcessFacets,
		hasAdvancedProcessFilters,
		catalogAccessNotice,
		onClearProcessTransparencyFilters
	}: Props = $props();

	function formatFilterOption(value: unknown): string {
		if (value === undefined || value === null || value === '') return '';
		return formatProcessDisplayValue(String(value));
	}
</script>

{#if canUseProcessFacets}
	<div class="rounded-lg border border-border-light bg-background-secondary-light px-4 py-3">
		<details open={hasAdvancedProcessFilters} class="group">
			<summary
				class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-text-primary-light"
			>
				<span>Advanced process transparency</span>
				<span class="text-xs font-normal text-text-secondary-light">
					Filter by disclosed method, fermentation, additives, and confidence
				</span>
			</summary>
			<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
					Base method
					<select
						value={$filterStore.filters.processing_base_method?.toString() ?? ''}
						onchange={(e) =>
							filterStore.setFilter('processing_base_method', e.currentTarget.value)}
						class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
					>
						<option value="">Any method</option>
						{#each ($filterStore.uniqueValues.processing_base_method ?? []).filter(isPublicProcessFacetOption) as method}
							<option value={String(method)}>{formatFilterOption(method)}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
					Fermentation
					<select
						value={$filterStore.filters.fermentation_type?.toString() ?? ''}
						onchange={(e) => filterStore.setFilter('fermentation_type', e.currentTarget.value)}
						class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
					>
						<option value="">Any fermentation</option>
						{#each ($filterStore.uniqueValues.fermentation_type ?? []).filter(isPublicProcessFacetOption) as fermentationType}
							<option value={String(fermentationType)}>{formatFilterOption(fermentationType)}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
					Additive
					<select
						value={$filterStore.filters.process_additive?.toString() ?? ''}
						onchange={(e) => filterStore.setFilter('process_additive', e.currentTarget.value)}
						class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
					>
						<option value="">Any additive</option>
						{#each ($filterStore.uniqueValues.process_additives ?? []).filter(isPublicProcessFacetOption) as additive}
							<option value={String(additive)}>{formatFilterOption(additive)}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
					Disclosure
					<select
						value={$filterStore.filters.processing_disclosure_level?.toString() ?? ''}
						onchange={(e) =>
							filterStore.setFilter('processing_disclosure_level', e.currentTarget.value)}
						class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
					>
						<option value="">Any disclosure</option>
						{#each ($filterStore.uniqueValues.processing_disclosure_level ?? []).filter(isPublicProcessFacetOption) as disclosureLevel}
							<option value={String(disclosureLevel)}>{formatFilterOption(disclosureLevel)}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-xs font-medium text-text-secondary-light">
					Confidence
					<select
						value={$filterStore.filters.processing_confidence_min?.toString() ?? ''}
						onchange={(e) =>
							filterStore.setFilter('processing_confidence_min', e.currentTarget.value)}
						class="rounded-md border border-border-light bg-background-primary-light px-3 py-1.5 text-sm text-text-primary-light shadow-sm focus:outline-none focus:ring-2 focus:ring-background-tertiary-light"
					>
						<option value="">Any confidence</option>
						{#each PROCESSING_CONFIDENCE_OPTIONS as option}
							<option value={option.value.toString()}>{option.label}</option>
						{/each}
					</select>
				</label>
			</div>

			{#if hasAdvancedProcessFilters}
				<div
					class="mt-3 flex items-center justify-between gap-3 text-xs text-text-secondary-light"
				>
					<span>Structured process filters are added to the shareable catalog URL.</span>
					<button
						type="button"
						onclick={onClearProcessTransparencyFilters}
						class="rounded-md border border-border-light px-3 py-1.5 text-xs font-medium text-text-secondary-light transition-colors hover:border-background-tertiary-light hover:text-background-tertiary-light"
					>
						Clear process facets
					</button>
				</div>
			{/if}
		</details>
	</div>
{:else}
	<div class="rounded-lg border border-border-light bg-background-secondary-light px-4 py-3">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h2 class="text-sm font-semibold text-text-primary-light">
					Members unlock structured process filters
				</h2>
				<p class="mt-1 text-sm text-text-secondary-light">
					Coffee cards still show disclosed process facts. Member search adds process facets,
					confidence thresholds, and other sourcing leverage.
				</p>
				{#if catalogAccessNotice}
					<p class="mt-1 text-xs text-text-secondary-light">
						{catalogAccessNotice.message}
					</p>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => goto('/subscription')}
				class="rounded-md border border-background-tertiary-light px-4 py-2 text-sm font-medium text-background-tertiary-light transition-colors hover:bg-background-tertiary-light hover:text-white"
			>
				Compare paid products
			</button>
		</div>
	</div>
{/if}
