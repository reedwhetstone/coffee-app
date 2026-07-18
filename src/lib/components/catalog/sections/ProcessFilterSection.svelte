<script lang="ts">
	import { filterStore } from '$lib/stores/filterStore';
	import {
		formatProcessDisplayValue,
		isPublicProcessFacetOption
	} from '$lib/catalog/processDisplay';
	import { PROCESSING_CONFIDENCE_OPTIONS } from '$lib/catalog/urlState';

	interface Props {
		canUseProcessFacets: boolean;
		hasAdvancedProcessFilters: boolean;
		onClearProcessTransparencyFilters: () => void;
	}

	let { canUseProcessFacets, hasAdvancedProcessFilters, onClearProcessTransparencyFilters }: Props =
		$props();

	function formatFilterOption(value: unknown): string {
		if (value === undefined || value === null || value === '') return '';
		return formatProcessDisplayValue(String(value));
	}
</script>

{#if canUseProcessFacets}
	<div class="rounded-lg border border-line bg-surface-panel px-4 py-3">
		<details open={hasAdvancedProcessFilters} class="group">
			<summary
				class="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink"
			>
				<span>Advanced process transparency</span>
				<span class="text-xs font-normal text-muted">
					Filter by disclosed method, fermentation, additives, and confidence
				</span>
			</summary>
			<div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
				<label class="flex flex-col gap-1 text-xs font-medium text-muted">
					Base method
					<select
						value={$filterStore.filters.processing_base_method?.toString() ?? ''}
						onchange={(e) => filterStore.setFilter('processing_base_method', e.currentTarget.value)}
						class="rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="">Any method</option>
						{#each ($filterStore.uniqueValues.processing_base_method ?? []).filter(isPublicProcessFacetOption) as method}
							<option value={String(method)}>{formatFilterOption(method)}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-xs font-medium text-muted">
					Fermentation
					<select
						value={$filterStore.filters.fermentation_type?.toString() ?? ''}
						onchange={(e) => filterStore.setFilter('fermentation_type', e.currentTarget.value)}
						class="rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="">Any fermentation</option>
						{#each ($filterStore.uniqueValues.fermentation_type ?? []).filter(isPublicProcessFacetOption) as fermentationType}
							<option value={String(fermentationType)}
								>{formatFilterOption(fermentationType)}</option
							>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-xs font-medium text-muted">
					Additive
					<select
						value={$filterStore.filters.process_additive?.toString() ?? ''}
						onchange={(e) => filterStore.setFilter('process_additive', e.currentTarget.value)}
						class="rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="">Any additive</option>
						{#each ($filterStore.uniqueValues.process_additives ?? []).filter(isPublicProcessFacetOption) as additive}
							<option value={String(additive)}>{formatFilterOption(additive)}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-xs font-medium text-muted">
					Disclosure
					<select
						value={$filterStore.filters.processing_disclosure_level?.toString() ?? ''}
						onchange={(e) =>
							filterStore.setFilter('processing_disclosure_level', e.currentTarget.value)}
						class="rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="">Any disclosure</option>
						{#each ($filterStore.uniqueValues.processing_disclosure_level ?? []).filter(isPublicProcessFacetOption) as disclosureLevel}
							<option value={String(disclosureLevel)}>{formatFilterOption(disclosureLevel)}</option>
						{/each}
					</select>
				</label>

				<label class="flex flex-col gap-1 text-xs font-medium text-muted">
					Confidence
					<select
						value={$filterStore.filters.processing_confidence_min?.toString() ?? ''}
						onchange={(e) =>
							filterStore.setFilter('processing_confidence_min', e.currentTarget.value)}
						class="rounded-md border border-line bg-surface-canvas px-3 py-1.5 text-sm text-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
					>
						<option value="">Any confidence</option>
						{#each PROCESSING_CONFIDENCE_OPTIONS as option}
							<option value={option.value.toString()}>{option.label}</option>
						{/each}
					</select>
				</label>
			</div>

			{#if hasAdvancedProcessFilters}
				<div class="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
					<span>Structured process filters are added to the shareable catalog URL.</span>
					<button
						type="button"
						onclick={onClearProcessTransparencyFilters}
						class="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent"
					>
						Clear process facets
					</button>
				</div>
			{/if}
		</details>
	</div>
{:else}
	<div class="rounded-lg border border-line bg-surface-panel px-4 py-3">
		<div>
			<div>
				<h2 class="text-sm font-semibold text-ink">Members unlock structured process filters</h2>
				<p class="mt-1 text-sm text-muted">
					Coffee cards still show disclosed process facts. Member search adds process facets,
					confidence thresholds, and other sourcing leverage.
				</p>
			</div>
		</div>
	</div>
{/if}
