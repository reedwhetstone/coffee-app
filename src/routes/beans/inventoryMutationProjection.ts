import type { InventoryWithCatalog } from '$lib/types/component.types';

/**
 * Apply a canonical inventory mutation without discarding page-only enrichment.
 *
 * Parchment mutation resources own inventory fields and concurrency tokens, while
 * the beans GET projection owns full catalog and roast context. Inventory updates
 * cannot change either relationship, so a compact mutation response is merged
 * into the existing page row instead of replacing it.
 */
export function mergeInventoryMutationProjection(
	current: InventoryWithCatalog,
	mutation: InventoryWithCatalog
): InventoryWithCatalog {
	if (mutation.id !== current.id) {
		throw new Error('Inventory mutation returned a different resource');
	}

	const merged = {
		...current,
		...mutation
	} as InventoryWithCatalog & { ai_tasting_notes?: unknown };

	merged.coffee_catalog = current.coffee_catalog ?? mutation.coffee_catalog;
	merged.roast_profiles = current.roast_profiles ?? mutation.roast_profiles;

	const currentNotes = (current as InventoryWithCatalog & { ai_tasting_notes?: unknown })
		.ai_tasting_notes;
	if (currentNotes !== undefined) {
		merged.ai_tasting_notes = currentNotes;
	}

	return merged;
}
