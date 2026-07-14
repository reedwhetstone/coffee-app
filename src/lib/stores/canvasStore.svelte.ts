import type { CanvasBlock, CanvasLayout, CanvasMutation } from '$lib/types/genui';

let nextBlockId = 0;
function generateBlockId(): string {
	return `canvas-block-${++nextBlockId}-${Date.now()}`;
}

// ─── Canvas State (module-level $state for shared reactivity) ────────────────

let blocks = $state<CanvasBlock[]>([]);
let layout = $state<CanvasLayout>('focus');
let focusBlockId = $state<string | null>(null);

// Block-to-message registry: look up which message a canvas block came from
const blockMessageRegistry = new Map<string, string>();

// ─── Derived ─────────────────────────────────────────────────────────────────

// The shelf contains every retained block. Pinned blocks float to the front
// (stable within pinned and unpinned groups) in addition to being protected
// from clear/replace. Legacy `minimized` values are deliberately ignored: the
// active-scene canvas has no hidden window tray, so restored evidence remains
// reachable from the shelf.
function sortBlocksForShelf(source: CanvasBlock[]): CanvasBlock[] {
	return source
		.map((block, index) => ({ block, index }))
		.sort((a, b) => {
			if (a.block.pinned !== b.block.pinned) return a.block.pinned ? -1 : 1;
			return a.index - b.index;
		})
		.map((entry) => entry.block);
}

const visibleBlocks = $derived(sortBlocksForShelf(blocks));
const isEmpty = $derived(blocks.length === 0);
const blockCount = $derived(blocks.length);
const focusedBlock = $derived(blocks.find((b) => b.id === focusBlockId) ?? null);

// ─── Auto-layout detection ───────────────────────────────────────────────────

// Once a layout is explicitly chosen (by the user, the AI's canvas_layout, or a
// restore), auto-detection stops overriding it. This is what lets a user set up
// the canvas the way they like and have the agent inject content into it without
// the view snapping back on every new block. Cleared on 'clear'.
let layoutManuallySet = false;

function autoDetectLayout(count: number): CanvasLayout {
	if (count <= 1) return 'focus';
	if (count <= 3) return 'comparison';
	return 'dashboard';
}

function maybeAutoLayout() {
	if (!layoutManuallySet && !blocks.some((b) => b.pinned)) layout = autoDetectLayout(blocks.length);
}

// ─── Dispatch mutations ──────────────────────────────────────────────────────

function dispatch(mutation: CanvasMutation) {
	switch (mutation.type) {
		case 'add': {
			const id = generateBlockId();
			const newBlock: CanvasBlock = {
				id,
				block: mutation.block,
				messageId: mutation.messageId,
				pinned: false,
				minimized: false,
				addedAt: Date.now(),
				title: mutation.title
			};
			blocks = [...blocks, newBlock];
			blockMessageRegistry.set(id, mutation.messageId);
			focusBlockId = id;
			maybeAutoLayout();
			break;
		}

		case 'remove': {
			const shelfBefore = sortBlocksForShelf(blocks);
			const removedIndex = shelfBefore.findIndex((b) => b.id === mutation.blockId);
			blocks = blocks.filter((b) => b.id !== mutation.blockId);
			blockMessageRegistry.delete(mutation.blockId);
			if (focusBlockId === mutation.blockId) {
				// Keep the user's place in shelf order: prefer the next retained item,
				// then fall back to the previous one when the active item was last.
				const shelfAfter = sortBlocksForShelf(blocks);
				const fallbackIndex = Math.min(Math.max(removedIndex, 0), shelfAfter.length - 1);
				focusBlockId = shelfAfter[fallbackIndex]?.id ?? null;
			}
			maybeAutoLayout();
			break;
		}

		case 'focus': {
			const target = blocks.find((b) => b.id === mutation.blockId);
			if (!target) break;
			// Selection only. Layout/minimized fields remain persistence-compatible
			// but no longer affect the active-scene presentation.
			focusBlockId = mutation.blockId;
			// Normalize legacy minimized state when old saved evidence is selected.
			if (target?.minimized) {
				blocks = blocks.map((b) => (b.id === mutation.blockId ? { ...b, minimized: false } : b));
			}
			break;
		}

		case 'clear': {
			// Keep pinned blocks
			const pinned = blocks.filter((b) => b.pinned);
			const removed = blocks.filter((b) => !b.pinned);
			for (const b of removed) blockMessageRegistry.delete(b.id);
			blocks = pinned;
			focusBlockId = pinned.length > 0 ? pinned[pinned.length - 1].id : null;
			layoutManuallySet = false;
			maybeAutoLayout();
			break;
		}

		case 'layout': {
			// A user (or restore) choosing a layout owns it from then on. An agent
			// suggestion (from present_results canvas_layout) only applies while the
			// user hasn't taken ownership and hasn't locked anything — so the agent
			// can never re-arrange a workspace the user has set up.
			if (mutation.source === 'agent') {
				if (layoutManuallySet || blocks.some((b) => b.pinned)) break;
				layout = mutation.layout;
			} else {
				layout = mutation.layout;
				layoutManuallySet = true;
			}
			break;
		}

		case 'replace': {
			// Clear unpinned blocks, then add new ones
			const pinnedBlocks = blocks.filter((b) => b.pinned);
			for (const b of blocks.filter((b) => !b.pinned)) {
				blockMessageRegistry.delete(b.id);
			}

			const newBlocks: CanvasBlock[] = mutation.blocks.map((item) => {
				const id = generateBlockId();
				blockMessageRegistry.set(id, item.messageId);
				return {
					id,
					block: item.block,
					messageId: item.messageId,
					pinned: false,
					minimized: false,
					addedAt: Date.now(),
					title: item.title
				};
			});

			blocks = [...pinnedBlocks, ...newBlocks];
			focusBlockId = newBlocks.length > 0 ? newBlocks[0].id : (pinnedBlocks[0]?.id ?? null);
			maybeAutoLayout();
			break;
		}

		case 'pin': {
			blocks = blocks.map((b) => (b.id === mutation.blockId ? { ...b, pinned: true } : b));
			break;
		}

		case 'unpin': {
			blocks = blocks.map((b) => (b.id === mutation.blockId ? { ...b, pinned: false } : b));
			break;
		}

		case 'minimize': {
			// Compatibility-only mutation for restored/older clients. The active
			// scene always keeps retained blocks reachable from its shelf.
			blocks = blocks.map((b) => (b.id === mutation.blockId ? { ...b, minimized: true } : b));
			break;
		}

		case 'restore': {
			blocks = blocks.map((b) => (b.id === mutation.blockId ? { ...b, minimized: false } : b));
			focusBlockId = mutation.blockId;
			break;
		}

		case 'update-action': {
			blocks = blocks.map((b) =>
				b.id === mutation.blockId && b.block.type === 'action-card'
					? { ...b, block: { ...b.block, data: { ...b.block.data, ...mutation.data } } }
					: b
			);
			break;
		}
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMessageIdForBlock(blockId: string): string | undefined {
	return blockMessageRegistry.get(blockId);
}

function getBlocksForMessage(messageId: string): CanvasBlock[] {
	return blocks.filter((b) => b.messageId === messageId);
}

function clearAll() {
	dispatch({ type: 'clear' });
}

function resetAll() {
	blockMessageRegistry.clear();
	blocks = [];
	focusBlockId = null;
	layout = 'focus';
	layoutManuallySet = false;
}

// ─── Exported reactive accessors ─────────────────────────────────────────────

export const canvasStore = {
	get blocks() {
		return blocks;
	},
	get visibleBlocks() {
		return visibleBlocks;
	},
	get layout() {
		return layout;
	},
	get focusBlockId() {
		return focusBlockId;
	},
	get focusedBlock() {
		return focusedBlock;
	},
	get isEmpty() {
		return isEmpty;
	},
	get blockCount() {
		return blockCount;
	},
	dispatch,
	getMessageIdForBlock,
	getBlocksForMessage,
	clearAll,
	resetAll
};
