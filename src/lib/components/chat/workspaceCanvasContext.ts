import type { CanvasBlock, UIBlock } from '$lib/types/genui';

/** Parchment rejects a workspace canvas description longer than this on every chat request. */
export const CANVAS_DESCRIPTION_MAX_CHARS = 500;

// Locked windows are user-owned: tell the model it must not replace, remove,
// or reorder them, only add new content alongside.
const LOCKED_NOTE = ' [LOCKED — do not replace, remove, or reorder]';
const LOCKED_TAG = ' [LOCKED]';
const LOCKED_LEGEND = '[LOCKED] blocks are user-owned: do not replace, remove, or reorder them.';

type DescribedBlock = Pick<CanvasBlock, 'block' | 'pinned'>;

function shorten(value: unknown, maxChars = 24): string {
	const text = typeof value === 'string' && value.trim() ? value.trim() : 'Unknown';
	return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

function describeBlock(block: UIBlock, pos: number): string {
	switch (block.type) {
		case 'coffee-cards': {
			const items = Array.isArray(block.data) ? block.data : [];
			const names = items
				.slice(0, 5)
				.map((c) => c?.name || 'Unknown')
				.join(', ');
			return `${pos}. Coffee cards: ${names}${items.length > 5 ? ` (+${items.length - 5} more)` : ''}`;
		}
		case 'roast-profiles': {
			const items = Array.isArray(block.data) ? block.data : [];
			const names = items
				.slice(0, 5)
				.map((r) => `${r?.coffee_name || 'Unknown'} (${r?.roast_date || '?'})`)
				.join(', ');
			return `${pos}. Roast profiles: ${names}${items.length > 5 ? ` (+${items.length - 5} more)` : ''}`;
		}
		case 'roast-chart':
			return `${pos}. Roast temperature chart (roast #${block.data?.roastId || '?'})`;
		case 'inventory-table': {
			const items = Array.isArray(block.data) ? block.data : [];
			return `${pos}. Inventory table (${items.length} beans)`;
		}
		case 'tasting-radar':
			return `${pos}. Tasting radar: ${block.data?.beanName || 'Unknown'}`;
		case 'action-card':
			return `${pos}. Action card: ${block.data?.summary || 'Action'} [${block.data?.status || 'unknown'}]`;
		default:
			return `${pos}. ${block.type.replace(/-/g, ' ')}`;
	}
}

/** One short line per block that keeps its position, kind, and primary identity. */
function summarizeBlock(block: UIBlock, pos: number): string {
	switch (block.type) {
		case 'coffee-cards': {
			const items = Array.isArray(block.data) ? block.data : [];
			if (items.length === 0) return `${pos}. Coffee cards (0)`;
			return `${pos}. Coffee cards: ${shorten(items[0]?.name)}${items.length > 1 ? ` +${items.length - 1}` : ''}`;
		}
		case 'roast-profiles': {
			const items = Array.isArray(block.data) ? block.data : [];
			return `${pos}. Roast profiles (${items.length})`;
		}
		case 'roast-chart':
			return `${pos}. Roast chart #${block.data?.roastId || '?'}`;
		case 'inventory-table': {
			const items = Array.isArray(block.data) ? block.data : [];
			return `${pos}. Inventory (${items.length} beans)`;
		}
		case 'tasting-radar':
			return `${pos}. Tasting radar: ${shorten(block.data?.beanName)}`;
		case 'action-card':
			return `${pos}. Action card [${block.data?.status || 'unknown'}]`;
		default:
			return `${pos}. ${block.type.replace(/-/g, ' ')}`;
	}
}

/**
 * Describe visible evidence for Cherry within the request contract. Detailed
 * lines are used when they fit; otherwise every block is compacted instead of
 * dropping the tail, and locked blocks keep priority if even that overflows.
 */
export function describeCanvasForCherry(
	blocks: DescribedBlock[],
	maxChars = CANVAS_DESCRIPTION_MAX_CHARS
): string {
	if (blocks.length === 0) return '';

	const detailed = blocks
		.map((b, i) => `${describeBlock(b.block, i + 1)}${b.pinned ? LOCKED_NOTE : ''}`)
		.join('\n');
	if (detailed.length <= maxChars) return detailed;

	const header = blocks.some((b) => b.pinned) ? [LOCKED_LEGEND] : [];
	const compact = blocks.map(
		(b, i) => `${summarizeBlock(b.block, i + 1)}${b.pinned ? LOCKED_TAG : ''}`
	);
	const allCompact = [...header, ...compact].join('\n');
	if (allCompact.length <= maxChars) return allCompact;

	// Locked blocks first (ADR 013 prioritizes pinned evidence), then canvas order.
	const budget = maxChars - `\n(+${blocks.length} more evidence blocks)`.length;
	const priority = compact
		.map((_, index) => index)
		.sort((a, b) => Number(blocks[b].pinned) - Number(blocks[a].pinned) || a - b);
	const selected = new Set<number>();
	let used = header.join('\n').length;
	for (const index of priority) {
		const cost = compact[index].length + (used > 0 ? 1 : 0);
		if (used + cost > budget) break;
		selected.add(index);
		used += cost;
	}
	const lines = [...header, ...compact.filter((_, index) => selected.has(index))];
	const omitted = blocks.length - selected.size;
	if (omitted > 0) lines.push(`(+${omitted} more evidence blocks)`);
	const description = lines.join('\n');
	return description.length <= maxChars
		? description
		: `${description.slice(0, maxChars - 1).trimEnd()}…`;
}
