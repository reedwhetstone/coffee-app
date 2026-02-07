import type {
	UIBlock,
	CoffeeCardsBlock,
	InventoryTableBlock,
	RoastProfilesBlock,
	RoastProfileRow,
	TastingRadarBlock,
	ErrorBlock
} from '$lib/types/genui';
import type { TastingNotes, TastingNote } from '$lib/types/coffee.types';
import type { UIMessage } from 'ai';

/**
 * Extracts UIBlocks from a chat message's tool parts.
 * Maps tool name + output → UIBlock[].
 * Replaces the old extractCoffeeData() function.
 */
export function extractUIBlocks(message: UIMessage): UIBlock[] {
	if (!message?.parts) return [];
	const blocks: UIBlock[] = [];

	for (const part of message.parts) {
		if (!part.type.startsWith('tool-')) continue;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const toolPart = part as any;

		if (toolPart.state === 'output-error') {
			blocks.push({
				type: 'error',
				version: 1,
				data: {
					message: toolPart.errorText || 'An error occurred',
					retryable: true
				}
			} satisfies ErrorBlock);
			continue;
		}

		if (toolPart.state !== 'output-available') continue;

		const output = toolPart.output;
		if (!output || typeof output !== 'object') continue;

		// Static tools encode name in part.type as `tool-${name}`, dynamic tools have `toolName` prop
		const toolName = toolPart.toolName ?? part.type.replace('tool-', '');

		if (
			toolName === 'coffee_catalog_search' &&
			'coffees' in output &&
			Array.isArray(output.coffees) &&
			output.coffees.length > 0
		) {
			blocks.push({
				type: 'coffee-cards',
				version: 1,
				data: output.coffees
			} satisfies CoffeeCardsBlock);
		} else if (
			toolName === 'green_coffee_inventory' &&
			'inventory' in output &&
			Array.isArray(output.inventory) &&
			output.inventory.length > 0
		) {
			blocks.push({
				type: 'inventory-table',
				version: 1,
				data: output.inventory,
				summary: output.summary
			} satisfies InventoryTableBlock);
		} else if (
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
			blocks.push({
				type: 'roast-profiles',
				version: 1,
				data: rows,
				summary: output.summary
			} satisfies RoastProfilesBlock);
		} else if (toolName === 'bean_tasting_notes' && 'radar_data' in output && output.radar_data) {
			const radar = output.radar_data;
			const beanInfo = output.bean_info || {};
			const notes = radarDataToTastingNotes(radar);
			if (notes) {
				blocks.push({
					type: 'tasting-radar',
					version: 1,
					data: {
						beanName: beanInfo.name || 'Unknown',
						beanId: beanInfo.id || 0,
						notes,
						source: (output.filter_applied as 'user' | 'supplier' | 'both') || 'supplier'
					}
				} satisfies TastingRadarBlock);
			}
		}
	}

	return blocks;
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
