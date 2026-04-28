import type { CatalogDropdownItem, CatalogItem } from '$lib/data/catalog';

export interface CatalogProcessSummary {
	base_method: string | null;
	fermentation_type: string | null;
	additives: string[] | null;
	additive_detail: string | null;
	fermentation_duration_hours: number | null;
	drying_method: string | null;
	notes: string | null;
	disclosure_level: string | null;
	confidence: number | null;
	evidence_available: boolean;
}

type CatalogResourceQueryItem = Omit<
	CatalogItem,
	'coffee_user' | 'processing_evidence' | 'processing_evidence_available'
> & {
	coffee_user?: CatalogItem['coffee_user'];
	processing_evidence?: CatalogItem['processing_evidence'];
	processing_evidence_available?: boolean | null;
	processing_evidence_schema_version?: string | number | null;
};

export type CatalogResourceItem = Omit<
	CatalogItem,
	'coffee_user' | 'processing_evidence' | 'processing_evidence_available'
> & {
	process: CatalogProcessSummary;
};

export type CatalogResponseItem = CatalogResourceItem | CatalogDropdownItem;

export function toCatalogResourceItem(item: CatalogResourceQueryItem): CatalogResourceItem {
	const {
		coffee_user: _coffeeUser,
		processing_evidence: processingEvidence,
		processing_evidence_available: processingEvidenceAvailable,
		processing_evidence_schema_version: processingEvidenceSchemaVersion,
		...resourceItem
	} = item;
	const evidenceAvailable =
		processingEvidenceAvailable ??
		(processingEvidence != null || processingEvidenceSchemaVersion != null);

	return {
		...resourceItem,
		process: {
			base_method: item.processing_base_method ?? null,
			fermentation_type: item.fermentation_type ?? null,
			additives: item.process_additives ?? null,
			additive_detail: item.process_additive_detail ?? null,
			fermentation_duration_hours: item.fermentation_duration_hours ?? null,
			drying_method: item.drying_method ?? null,
			notes: item.processing_notes ?? null,
			disclosure_level: item.processing_disclosure_level ?? null,
			confidence: item.processing_confidence ?? null,
			evidence_available: evidenceAvailable
		}
	};
}
