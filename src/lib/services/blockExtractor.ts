import type {
	UIBlock,
	CoffeeCardsBlock,
	InventoryTableBlock,
	RoastChartBlock,
	RoastProfilesBlock,
	RoastProfileRow,
	TastingRadarBlock,
	ActionCardBlock,
	ActionType,
	ErrorBlock,
	CoffeeCardAnnotation,
	RoastProfileAnnotation,
	CanvasMutation,
	CanvasLayout,
	DataTableBlock
} from '$lib/types/genui';
import type { TastingNotes, TastingNote } from '$lib/types/coffee.types';
import type { UIMessage } from 'ai';

export interface BlockExtractorOptions {
	/** Map of source tool name → Map of item ID → item data */
	searchDataCache?: Map<string, Map<number, unknown>>;
	/** Whether this message contains a present_results tool call */
	hasPresentResults?: boolean;
	/** Stable assistant-message identity used for durable action execution IDs. */
	messageId?: string;
	/** False when hydrating persisted messages, where legacy IDs must not be invented. */
	allowExecutionIdSynthesis?: boolean;
}

export interface MessagePartsLike {
	parts?: unknown[];
}

/**
 * Returns a stable identity for a rendered block so transcript links can find
 * their canvas target even when an earlier tab has been removed.
 *
 * Action-card status is mutable in the canvas, so durable execution IDs are the
 * identity for those blocks. Other blocks use a key-sorted structural
 * representation, which also works after canvas state has been persisted and
 * restored as new object instances.
 */
export function blockIdentityKey(block: UIBlock): string {
	if (block.type === 'action-card' && block.data.executionId) {
		return `action-card:${block.data.executionId}`;
	}
	if (block.type === 'coffee-cards') {
		return `coffee-cards:${block.data.map((coffee) => String(coffee.id)).join(',')}`;
	}
	if (block.type === 'roast-profiles') {
		return `roast-profiles:${block.data.map((profile) => String(profile.roast_id)).join(',')}`;
	}
	if (block.type === 'inventory-table') {
		return `inventory-table:${block.data.map((item) => String(item.id)).join(',')}`;
	}
	if (block.type === 'data-table') {
		return `data-table:${stableSerialize(block.data.rows)}`;
	}
	return stableSerialize(block);
}

function stableSerialize(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
	if (value && typeof value === 'object') {
		return `{${Object.keys(value)
			.sort()
			.map(
				(key) =>
					`${JSON.stringify(key)}:${stableSerialize((value as Record<string, unknown>)[key])}`
			)
			.join(',')}}`;
	}
	return JSON.stringify(value) ?? String(value);
}

/** Tool names whose raw output should be suppressed when present_results is used */
const PRESENTABLE_TOOLS = new Set([
	'coffee_catalog_search',
	'catalog_rank',
	'market_signals',
	'green_coffee_inventory',
	'roast_profiles'
]);

/** Tools whose output is a `coffees` array renderable as coffee cards */
const COFFEE_RESULT_TOOLS = new Set(['coffee_catalog_search', 'catalog_rank']);
const MARKET_SIGNAL_TOOLS = new Set(['market_signals']);

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
		COFFEE_RESULT_TOOLS.has(toolName) &&
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

	if (MARKET_SIGNAL_TOOLS.has(toolName)) {
		const signals = marketSignalItems(output);
		if (signals.length > 0) return buildMarketSignalsBlock(signals);
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

	// Write tools return action_card payloads
	if ('action_card' in output && output.action_card) {
		const card = output.action_card as Record<string, unknown>;
		return {
			type: 'action-card',
			version: 1,
			data: {
				executionId:
					(typeof card.executionId === 'string' && card.executionId) ||
					(options?.messageId && options.allowExecutionIdSynthesis !== false
						? `${options.messageId}:${String(part.toolCallId ?? toolName)}`
						: undefined),
				actionType: card.actionType as ActionType,
				summary: card.summary as string,
				reasoning: card.reasoning as string | undefined,
				fields: (card.fields || []) as ActionCardBlock['data']['fields'],
				status: (card.status as ActionCardBlock['data']['status']) || 'proposed',
				result: card.result,
				error: card.error as string | undefined
			}
		} satisfies ActionCardBlock;
	}

	return null;
}

/**
 * Visible fallback when present_results references items that are not in the
 * search data cache (e.g. the source search never ran in this conversation, or
 * the model invented IDs). Without this the presentation fails silently.
 */
function presentationCacheMissBlock(sourceTool: string): ErrorBlock {
	return {
		type: 'error',
		version: 1,
		data: {
			message: `Couldn't render this presentation — the referenced ${sourceTool.replace(/_/g, ' ')} results weren't found in this conversation. Ask me to re-run the search.`,
			retryable: false
		}
	};
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

	const items: Array<{ id: number; annotation?: string; highlight?: boolean }> =
		presentation.items || [];

	if (!items.length) return null;

	const cache = searchDataCache?.get(sourceTool);

	if (sourceTool === 'coffee_catalog_search' || sourceTool === 'catalog_rank') {
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

		if (coffees.length === 0) return presentationCacheMissBlock(sourceTool);

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

		if (profiles.length === 0) return presentationCacheMissBlock(sourceTool);

		return {
			type: 'roast-profiles',
			version: 1,
			data: profiles,
			annotations
		} satisfies RoastProfilesBlock;
	}

	if (sourceTool === 'green_coffee_inventory') {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const inventory: any[] = [];

		for (const item of items) {
			const cached = cache?.get(item.id);
			if (cached) {
				inventory.push(cached);
			}
		}

		if (inventory.length === 0) return presentationCacheMissBlock(sourceTool);

		return {
			type: 'inventory-table',
			version: 1,
			data: inventory
		} satisfies InventoryTableBlock;
	}

	if (sourceTool === 'market_signals') {
		const signals: Array<Record<string, unknown>> = [];

		for (const item of items) {
			// A lot can carry several distinct signals (e.g. 7d + 30d price_drop, or
			// price_drop + below_market). The cache stores them as an array per
			// catalogId so none are dropped; fall back to a single value for safety.
			const cached = cache?.get(item.id);
			const cachedSignals = Array.isArray(cached)
				? (cached as Array<Record<string, unknown>>)
				: cached
					? [cached as Record<string, unknown>]
					: [];
			for (const signal of cachedSignals) {
				signals.push({
					...signal,
					presentation_note: item.annotation ?? null,
					highlight: item.highlight ?? false
				});
			}
		}

		if (signals.length === 0) return presentationCacheMissBlock(sourceTool);

		return buildMarketSignalsBlock(signals);
	}

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

		if (COFFEE_RESULT_TOOLS.has(toolName) && 'coffees' in output && Array.isArray(output.coffees)) {
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

		if (MARKET_SIGNAL_TOOLS.has(toolName)) {
			// Key by catalogId but keep every distinct signal for a lot: multiple
			// rows can share a catalogId (different signalType/window/market), so
			// overwriting by id alone would silently drop all but the last and
			// misattach annotations. Overlapping tool calls (a broad query then a
			// refined one) return the same signal twice, so dedupe on the composite
			// signal identity — the same key the analytics loader uses — keeping
			// the latest copy.
			const existing = cache.get(toolName) ?? new Map<number, unknown>();
			for (const signal of marketSignalItems(output)) {
				const id = marketSignalCatalogId(signal);
				if (id == null) continue;
				const key = marketSignalIdentity(signal);
				const prior = existing.get(id);
				if (Array.isArray(prior)) {
					const duplicateAt = (prior as Array<Record<string, unknown>>).findIndex(
						(candidate) => marketSignalIdentity(candidate) === key
					);
					if (duplicateAt >= 0) {
						prior[duplicateAt] = signal;
					} else {
						prior.push(signal);
					}
				} else {
					existing.set(id, [signal]);
				}
			}
			if (!cache.has(toolName)) cache.set(toolName, existing);
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
 * Builds the present_results lookup cache for one tool part.
 *
 * The cache must reflect only causally prior data: all earlier messages and the
 * current message's parts up through the part being extracted. Later tool parts
 * in the same assistant message may not satisfy an earlier presentation.
 */
export function buildSearchDataCacheThroughPart(
	messages: MessagePartsLike[],
	messageIndex: number,
	partIndex: number
): Map<string, Map<number, unknown>> {
	const priorMessageParts = messages
		.slice(0, Math.max(0, messageIndex))
		.flatMap((message) => message.parts ?? []);
	const currentMessageParts = messages[messageIndex]?.parts?.slice(0, partIndex + 1) ?? [];

	return buildSearchDataCache([...priorMessageParts, ...currentMessageParts]);
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
 * Returns additional companion blocks for a tool part.
 * e.g. a roast-chart block when roast_profiles returns a single roast.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractCompanionBlocks(part: any): UIBlock[] {
	if (!part?.type?.startsWith('tool-')) return [];
	if (part.state !== 'output-available') return [];

	const output = part.output;
	if (!output || typeof output !== 'object') return [];

	const toolName = part.toolName ?? part.type.replace('tool-', '');

	// When roast_profiles returns a single profile, also produce a roast-chart block
	if (
		toolName === 'roast_profiles' &&
		'profiles' in output &&
		Array.isArray(output.profiles) &&
		output.profiles.length === 1
	) {
		const profile = output.profiles[0];
		const roastId = profile.roast_id ?? profile.id;
		if (roastId != null) {
			return [
				{
					type: 'roast-chart',
					version: 1,
					data: { roastId: Number(roastId) }
				} satisfies RoastChartBlock
			];
		}
	}

	return [];
}

/**
 * Extracts canvas mutations from a present_results tool part.
 * Returns mutations to dispatch to canvasStore, or null if not present_results.
 */
export function extractCanvasMutationsFromPart(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	part: any,
	block: UIBlock | null,
	messageId: string
): CanvasMutation[] | null {
	if (!part?.type?.startsWith('tool-')) return null;
	if (part.state !== 'output-available') return null;

	const toolName = part.toolName ?? part.type.replace('tool-', '');
	if (toolName !== 'present_results') return null;

	const output = part.output;
	if (!output || !('presentation' in output)) return null;

	const presentation = output.presentation;
	const mutations: CanvasMutation[] = [];

	// Canvas action: replace (default), add, or clear
	const canvasAction: string = presentation.canvas_action || 'replace';

	if (canvasAction === 'clear') {
		mutations.push({ type: 'clear' });
		return mutations;
	}

	// Error blocks (e.g. presentation cache misses) render inline in the
	// message only — don't touch the canvas, including layout hints.
	if (block?.type === 'error') return null;

	// Optional AI-provided tab title for the canvas block.
	const rawTitle = presentation.canvas_title;
	const title =
		typeof rawTitle === 'string' && rawTitle.trim().length > 0
			? rawTitle.trim().slice(0, 60)
			: undefined;

	// If we have a block, dispatch it to canvas
	if (block) {
		if (canvasAction === 'replace') {
			mutations.push({ type: 'replace', blocks: [{ block, messageId, title }] });
		} else {
			mutations.push({ type: 'add', block, messageId, title });
		}
	}

	// Canvas layout hint. Tagged as an agent suggestion so the store can ignore it
	// once the user owns the layout (manually chosen or anything locked).
	const canvasLayout: string | undefined = presentation.canvas_layout;
	if (canvasLayout && ['focus', 'comparison', 'dashboard'].includes(canvasLayout)) {
		mutations.push({ type: 'layout', layout: canvasLayout as CanvasLayout, source: 'agent' });
	}

	return mutations.length > 0 ? mutations : null;
}

export interface ToolCanvasDispatchPlan {
	mutations: CanvasMutation[] | null;
	canvasBlocks: UIBlock[];
	handledWithoutCanvas: boolean;
}

/**
 * Describes the canvas contribution for one completed tool part. Both the
 * workspace dispatcher and transcript preview mapper use this order so each
 * compact link targets the block that was actually added to the canvas.
 */
export function buildToolCanvasDispatchPlan(
	part: unknown,
	block: UIBlock | null,
	messageId: string
): ToolCanvasDispatchPlan {
	const mutations = extractCanvasMutationsFromPart(part, block, messageId);
	if (mutations) {
		return {
			mutations,
			canvasBlocks: mutations.flatMap((mutation) => {
				if (mutation.type === 'add') return [mutation.block];
				if (mutation.type === 'replace') return mutation.blocks.map((item) => item.block);
				return [];
			}),
			handledWithoutCanvas: false
		};
	}

	const toolPart = part as { state?: unknown; toolName?: unknown; type?: unknown } | null;
	const isCompletedPresentation =
		toolPart?.state === 'output-available' &&
		(toolPart.toolName === 'present_results' || toolPart.type === 'tool-present_results');
	if (isCompletedPresentation) {
		return { mutations: null, canvasBlocks: [], handledWithoutCanvas: true };
	}

	if (!block || block.type === 'error') {
		return { mutations: null, canvasBlocks: [], handledWithoutCanvas: false };
	}

	return {
		mutations: null,
		canvasBlocks: [block, ...extractCompanionBlocks(toolPart)],
		handledWithoutCanvas: false
	};
}

function marketSignalItems(output: Record<string, unknown>): Array<Record<string, unknown>> {
	for (const key of ['data', 'signals', 'items']) {
		const value = output[key];
		if (Array.isArray(value)) return value.filter(isRecord);
	}
	return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function marketSignalCatalogId(signal: Record<string, unknown>): number | null {
	const id = signal.catalogId ?? signal.catalog_id ?? signal.id;
	return typeof id === 'number' && Number.isFinite(id) ? id : null;
}

/** Composite signal identity, mirroring the analytics loader's dedupe key. */
function marketSignalIdentity(signal: Record<string, unknown>): string {
	const type = signal.signalType ?? signal.signal_type ?? '';
	const market = signal.market ?? '';
	const window = signal.signalWindow ?? signal.signal_window ?? '';
	return `${marketSignalCatalogId(signal) ?? ''}:${type}:${market}:${window}`;
}

function marketSignalTypeLabel(value: unknown): string {
	const labels: Record<string, string> = {
		price_drop: 'Price drop',
		below_market: 'Below market',
		value_quality: 'Value for quality'
	};
	return typeof value === 'string' ? (labels[value] ?? value.replace(/_/g, ' ')) : 'Signal';
}

function marketSignalName(signal: Record<string, unknown>): string {
	for (const key of ['name', 'coffeeName', 'coffee_name', 'catalogName', 'catalog_name']) {
		const value = signal[key];
		if (typeof value === 'string' && value.trim()) return value;
	}
	const origin =
		typeof signal.origin === 'string' && signal.origin ? signal.origin : 'Unknown origin';
	const process =
		typeof signal.process === 'string' && signal.process && signal.process !== 'undisclosed'
			? ` - ${signal.process}`
			: '';
	return `${origin}${process}`;
}

function formatMarketSignalMoney(value: unknown): string {
	return typeof value === 'number' && Number.isFinite(value) ? `$${value.toFixed(2)}/lb` : '-';
}

function formatMarketSignalPct(value: unknown): string | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function marketSignalEvidence(signal: Record<string, unknown>): string {
	const evidence = isRecord(signal.evidence) ? signal.evidence : {};
	const signalType = signal.signalType ?? signal.signal_type;
	if (signalType === 'price_drop') {
		const drop = formatMarketSignalPct(
			evidence.drop_vs_own_median_pct ?? evidence.dropVsOwnMedianPct
		);
		const median = formatMarketSignalMoney(
			evidence.own_trailing_median ?? evidence.ownTrailingMedian
		);
		const window =
			evidence.own_trailing_window ?? evidence.ownTrailingWindow ?? signal.signalWindow;
		return [drop ? `${drop} vs own median` : null, median !== '-' ? median : null, window]
			.filter(Boolean)
			.join(' - ');
	}
	if (signalType === 'below_market') {
		const discount = formatMarketSignalPct(
			evidence.discount_vs_median_pct ?? evidence.discountVsMedianPct
		);
		const median = formatMarketSignalMoney(evidence.segment_median ?? evidence.segmentMedian);
		const percentile =
			evidence.price_percentile_in_segment ?? evidence.pricePercentileInSegment ?? null;
		return [
			discount ? `${discount} vs segment median` : null,
			median !== '-' ? median : null,
			percentile != null ? `p${percentile}` : null
		]
			.filter(Boolean)
			.join(' - ');
	}
	const score = signal.scoreValue ?? signal.score_value;
	const valueZ = evidence.value_z_score ?? evidence.valueZScore;
	return [
		score != null ? `score ${score}` : null,
		typeof valueZ === 'number' ? `${valueZ.toFixed(1)} sigma value signal` : null
	]
		.filter(Boolean)
		.join(' - ');
}

function buildMarketSignalsBlock(signals: Array<Record<string, unknown>>): DataTableBlock {
	const rows = signals.map((signal) => ({
		id: marketSignalCatalogId(signal) ?? '-',
		signal: marketSignalTypeLabel(signal.signalType ?? signal.signal_type),
		lot: marketSignalName(signal),
		market: signal.market ?? '-',
		price: formatMarketSignalMoney(signal.currentPriceLb ?? signal.current_price_lb),
		evidence: marketSignalEvidence(signal) || '-',
		note: signal.presentation_note ?? null
	}));

	return {
		type: 'data-table',
		version: 1,
		data: {
			columns: [
				{ key: 'signal', label: 'Signal', sortable: true },
				{ key: 'lot', label: 'Lot', sortable: true },
				{ key: 'market', label: 'Market', sortable: true },
				{ key: 'price', label: 'Price', align: 'right' },
				{ key: 'evidence', label: 'Evidence' },
				{ key: 'note', label: 'Note' }
			],
			rows
		}
	};
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
