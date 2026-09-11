/**
 * Browser-facing catalog compatibility types.
 *
 * Parchment's generated SDK owns the resource schema. The small overlay below
 * records fields that Coffee App normalizes before handing data to UI code.
 */

import type { CatalogItem as SdkCatalogItem } from '@purveyors/sdk';
import type { Json } from '$lib/types/json.types';

type NormalizedCatalogFields = {
	name: string | null;
	source: string | null;
	stocked: boolean | null;
	cost_lb: number | null;
	price_per_lb: number | null;
	price_tiers: Json;
	public_coffee: boolean | null;
	wholesale: boolean | null;
	process_additives: string[] | null;
	coffee_user?: string | null;
	processing_evidence?: Json;
	processing_evidence_schema_version?: string | number | null;
};

export type CatalogItem = Omit<SdkCatalogItem, keyof NormalizedCatalogFields> &
	NormalizedCatalogFields;

export interface CatalogDropdownItem {
	id: number;
	source: string | null;
	name: string;
	stocked: boolean | null;
	cost_lb: number | null;
	price_per_lb: number | null;
	price_tiers: Json;
	public_coffee: boolean | null;
	wholesale?: boolean | null;
}

export class CatalogSchemaUnavailableError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CatalogSchemaUnavailableError';
	}
}
