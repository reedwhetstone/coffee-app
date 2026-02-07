import type {
	UIBlock,
	CoffeeCardsBlock,
	InventoryTableBlock,
	RoastProfilesBlock,
	RoastProfileRow,
	TastingRadarBlock,
	ErrorBlock,
	CoffeeCardAnnotation,
	RoastProfileAnnotation
} from '$lib/types/genui';
import type { TastingNotes, TastingNote } from '$lib/types/coffee.types';
import type { UIMessage } from 'ai';

export interface BlockExtractorOptions {
	/** Map of source tool name → Map of item ID → item data */
	searchDataCache?: Map<string, Map<number, unknown>>;
	/** Whether this message contains a present_results tool call */
	hasPresentResults?: boolean;
}

/** Tool names whose raw output should be suppressed when present_results is used */
const PRESENTABLE_TOOLS = new Set([
	'coffee_catalog_search',
	'green_coffee_inventory',
	'roast_profiles'
]);

/**
 * Extracts a single UIBlock from a single message part (tool output).
 * Returns null if the part isn't a tool part or doesn't map to a block.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractBlockFromPart(part: any, options?: BlockExtractorOptions): UIBlock | null {
	if (!part?.type?.startsWith('tool-')) return null;

	if (part.state === 'output-error') {
		return {
			type: 'error',
			version: 1,
			data: {
				message: part.errorText || 'An error occurred',
				retryable: true
			}
		} satisfies ErrorBlock;
	}

	if (part.state !== 'output-available') return null;

	const output = part.output;
	if (!output || typeof output !== 'object') return null;

	const toolName = part.toolName ?? part.type.replace('tool-', '');

	// When present_results is in the message, suppress raw rendering of search tools
	if (options?.hasPresentResults && PRESENTABLE_TOOLS.has(toolName)) {
		return null;
	}

	// Handle present_results tool → create annotated block from cached data
	if (toolName === 'present_results' && 'presentation' in output) {
		return buildPresentedBlock(output.presentation, options?.searchDataCache);
	}

	if (
		toolName === 'coffee_catalog_search' &&
		'coffees' in output &&
		Array.isArray(output.coffees) &&
		output.coffees.length > 0
	) {
		return {
			type: 'coffee-cards',
			version: 1,
			data: output.coffees
		} satisfies CoffeeCardsBlock;
	}

	if (
		toolName === 'green_coffee_inventory' &&
		'inventory' in output &&
		Array.isArray(output.inventory) &&
		output.inventory.length > 0
	) {
		return {
			type: 'inventory-table',
			version: 1,
			data: output.inventory,
			summary: output.summary
		} satisfies InventoryTableBlock;
	}

	if (
		toolName === 'roast_profiles' &&
		'profiles' in output &&
		Array.isArray(output.profiles) &&
		output.profiles.length > 0
	) {
		const rows: RoastProfileRow[] = output.profiles.map((p: Record<string, unknown>) => ({
			roast_id: String(p.roast_id ?? ''),
			batch_name: String(p.batch_name ?? ''),
			coffee_name: String(p.coffee_name ?? p.coffee_catalog_name ?? ''),
			roast_date: String(p.roast_date ?? ''),
			total_roast_time: p.total_roast_time as number | null,
			fc_start_time: p.fc_start_time as number | null,
			fc_start_temp: p.fc_start_temp as number | null,
			drop_time: p.drop_time as number | null,
			drop_temp: p.drop_temp as number | null,
			development_percent: p.development_percent as number | null,
			weight_loss_percent: p.weight_loss_percent as number | null,
			total_ror: p.total_ror as number | null,
			oz_in: p.oz_in as number | null,
			oz_out: p.oz_out as number | null,
			roast_notes: p.roast_notes as string | null
		}));
		return {
			type: 'roast-profiles',
			version: 1,
			data: rows,
			summary: output.summary
		} satisfies RoastProfilesBlock;
	}

	if (toolName === 'bean_tasting_notes' && 'radar_data' in output && output.radar_data) {
		const radar = output.radar_data;
		const beanInfo = output.bean_info || {};
		const notes = radarDataToTastingNotes(radar);
		if (notes) {
			return {
				type: 'tasting-radar',
				version: 1,
				data: {
					beanName: beanInfo.name || 'Unknown',
					beanId: beanInfo.id || 0,
					notes,
					source: (output.filter_applied as 'user' | 'supplier' | 'both') || 'supplier'
				}
			} satisfies TastingRadarBlock;
		}
	}

	return null;
}

/**
 * Build a UIBlock from a present_results tool output.
 * Merges AI-provided annotations with cached search data.
 */
function buildPresentedBlock(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	presentation: any,
	searchDataCache?: Map<string, Map<number, unknown>>
): UIBlock | null {
	const sourceTool: string = presentation.source_tool;
	const layout: 'inline' | 'grid' | 'focused' = presentation.layout || 'inline';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const items: Array<{ id: number; annotation?: string; highlight?: boolean }> =
		presentation.items || [];

	if (!items.length) return null;

	const cache = searchDataCache?.get(sourceTool);

	if (sourceTool === 'coffee_catalog_search') {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const coffees: any[] = [];
		const annotations: CoffeeCardAnnotation[] = [];

		for (const item of items) {
			const cached = cache?.get(item.id);
			if (cached) {
				coffees.push(cached);
			}
			annotations.push({
				id: item.id,
				annotation: item.annotation,
				highlight: item.highlight
			});
		}

		if (coffees.length === 0) return null;

		return {
			type: 'coffee-cards',
			version: 1,
			data: coffees,
			layout,
			annotations
		} satisfies CoffeeCardsBlock;
	}

	if (sourceTool === 'roast_profiles') {
		const profiles: RoastProfileRow[] = [];
		const annotations: RoastProfileAnnotation[] = [];

		for (const item of items) {
			const cached = cache?.get(item.id) as Record<string, unknown> | undefined;
			if (cached) {
				profiles.push({
					roast_id: String(cached.roast_id ?? ''),
					batch_name: String(cached.batch_name ?? ''),
					coffee_name: String(cached.coffee_name ?? cached.coffee_catalog_name ?? ''),
					roast_date: String(cached.roast_date ?? ''),
					total_roast_time: cached.total_roast_time as number | null,
					fc_start_time: cached.fc_start_time as number | null,
					fc_start_temp: cached.fc_start_temp as number | null,
					drop_time: cached.drop_time as number | null,
					drop_temp: cached.drop_temp as number | null,
					development_percent: cached.development_percent as number | null,
					weight_loss_percent: cached.weight_loss_percent as number | null,
					total_ror: cached.total_ror as number | null,
					oz_in: cached.oz_in as number | null,
					oz_out: cached.oz_out as number | null,
					roast_notes: cached.roast_notes as string | null
				});
			}
			annotations.push({
				id: item.id,
				annotation: item.annotation,
				highlight: item.highlight
			});
		}

		if (profiles.length === 0) return null;

		return {
			type: 'roast-profiles',
			version: 1,
			data: profiles,
			annotations
		} satisfies RoastProfilesBlock;
	}

	// TODO: Phase 2 — handle green_coffee_inventory
	return null;
}

/**
 * Extracts UIBlocks from a chat message's tool parts.
 * Maps tool name + output → UIBlock[].
 */
export function extractUIBlocks(message: UIMessage): UIBlock[] {
	if (!message?.parts) return [];
	const blocks: UIBlock[] = [];

	for (const part of message.parts) {
		const block = extractBlockFromPart(part);
		if (block) blocks.push(block);
	}

	return blocks;
}

/**
 * Builds a search data cache from a message's tool parts.
 * Maps tool name → Map of item ID → item data for present_results merging.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSearchDataCache(parts: any[]): Map<string, Map<number, unknown>> {
	const cache = new Map<string, Map<number, unknown>>();

	for (const part of parts) {
		if (!part?.type?.startsWith('tool-')) continue;
		if (part.state !== 'output-available') continue;

		const output = part.output;
		if (!output || typeof output !== 'object') continue;

		const toolName = part.toolName ?? part.type.replace('tool-', '');

		if (
			toolName === 'coffee_catalog_search' &&
			'coffees' in output &&
			Array.isArray(output.coffees)
		) {
			const itemMap = new Map<number, unknown>();
			for (const coffee of output.coffees) {
				if (coffee.id != null) itemMap.set(coffee.id, coffee);
			}
			// Merge with existing cache entries for this tool (multiple calls)
			const existing = cache.get(toolName);
			if (existing) {
				for (const [id, data] of itemMap) existing.set(id, data);
			} else {
				cache.set(toolName, itemMap);
			}
		}

		if (
			toolName === 'green_coffee_inventory' &&
			'inventory' in output &&
			Array.isArray(output.inventory)
		) {
			const itemMap = new Map<number, unknown>();
			for (const inv of output.inventory) {
				if (inv.id != null) itemMap.set(inv.id, inv);
			}
			const existing = cache.get(toolName);
			if (existing) {
				for (const [id, data] of itemMap) existing.set(id, data);
			} else {
				cache.set(toolName, itemMap);
			}
		}

		if (toolName === 'roast_profiles' && 'profiles' in output && Array.isArray(output.profiles)) {
			const itemMap = new Map<number, unknown>();
			for (const profile of output.profiles) {
				const id = profile.roast_id ?? profile.id;
				if (id != null) itemMap.set(Number(id), profile);
			}
			const existing = cache.get(toolName);
			if (existing) {
				for (const [id, data] of itemMap) existing.set(id, data);
			} else {
				cache.set(toolName, itemMap);
			}
		}
	}

	return cache;
}

/**
 * Checks if a message contains a present_results tool call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function messageHasPresentResults(parts: any[]): boolean {
	return parts.some(
		(part) =>
			part?.type?.startsWith('tool-') &&
			(part.toolName === 'present_results' || part.type === 'tool-present_results')
	);
}

/**
 * Converts the flat radar_data from bean_tasting_notes tool
 * into the TastingNotes shape expected by TastingNotesRadar.
 */
function radarDataToTastingNotes(radar: Record<string, number>): TastingNotes | null {
	if (
		!radar.body &&
		!radar.flavor &&
		!radar.acidity &&
		!radar.sweetness &&
		!radar.fragrance_aroma
	) {
		return null;
	}

	function toNote(score: number, axis: string): TastingNote {
		const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];
		return {
			tag: axis,
			color: colors[Math.min(Math.max(Math.round(score) - 1, 0), 4)],
			score
		};
	}

	return {
		body: toNote(radar.body || 0, 'Body'),
		flavor: toNote(radar.flavor || 0, 'Flavor'),
		acidity: toNote(radar.acidity || 0, 'Acidity'),
		sweetness: toNote(radar.sweetness || 0, 'Sweetness'),
		fragrance_aroma: toNote(radar.fragrance_aroma || 0, 'Aroma')
	};
}
