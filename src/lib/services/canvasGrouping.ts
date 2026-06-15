import { defaultBlockTitle, type CanvasBlock, type UIBlock } from '$lib/types/genui';

export interface CanvasGroup {
	/** Stable key for the group (the block category/type). */
	key: string;
	type: UIBlock['type'];
	/** Category label shown on the window header (e.g. "Coffee cards"). */
	label: string;
	/** Member blocks in encounter order; each is a swappable sub-tab. */
	blocks: CanvasBlock[];
	/** True when any member is pinned — the whole window is treated as pinned. */
	pinned: boolean;
}

/**
 * Groups canvas blocks by category (block type) into windows. All coffee-card
 * blocks share one window, all roast-profile blocks another, etc., and each
 * member becomes a swappable, AI-named sub-tab within its window. Executable
 * action cards are intentionally left as one-card windows so tab switching does
 * not unmount their write status.
 *
 * Group and member order follow the order of the incoming blocks, so the
 * pinned-first ordering applied upstream still floats pinned categories to the
 * front (a pinned member makes its group appear early).
 */
export function groupCanvasBlocks(blocks: CanvasBlock[]): CanvasGroup[] {
	const groups: CanvasGroup[] = [];
	const byKey = new Map<string, CanvasGroup>();

	for (const canvasBlock of blocks) {
		// Action cards execute writes. Keep each one mounted in its own window instead
		// of swapping them through sub-tabs; otherwise component-local execution
		// state resets when the user switches away and back, making duplicate writes
		// possible.
		const key =
			canvasBlock.block.type === 'action-card'
				? `${canvasBlock.block.type}:${canvasBlock.id}`
				: canvasBlock.block.type;
		let group = byKey.get(key);
		if (!group) {
			group = {
				key,
				type: canvasBlock.block.type,
				label: defaultBlockTitle(canvasBlock.block.type),
				blocks: [],
				pinned: false
			};
			byKey.set(key, group);
			groups.push(group);
		}
		group.blocks.push(canvasBlock);
		if (canvasBlock.pinned) group.pinned = true;
	}

	return groups;
}

/** Label for a sub-tab: the AI title if set, else a numbered category fallback. */
export function subTabLabel(canvasBlock: CanvasBlock, indexInGroup: number): string {
	if (canvasBlock.title && canvasBlock.title.trim().length > 0) return canvasBlock.title;
	return `${defaultBlockTitle(canvasBlock.block.type)} ${indexInGroup + 1}`;
}
