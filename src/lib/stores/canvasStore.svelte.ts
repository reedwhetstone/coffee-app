import type { CanvasBlock, CanvasLayout, CanvasMutation, UIBlock } from '$lib/types/genui';

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

const visibleBlocks = $derived(blocks.filter((b) => !b.minimized));
const isEmpty = $derived(blocks.length === 0);
const blockCount = $derived(blocks.length);
const focusedBlock = $derived(blocks.find((b) => b.id === focusBlockId) ?? null);

// ─── Auto-layout detection ───────────────────────────────────────────────────

function autoDetectLayout(count: number): CanvasLayout {
	if (count <= 1) return 'focus';
	if (count <= 3) return 'comparison';
	return 'dashboard';
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
				addedAt: Date.now()
			};
			blocks = [...blocks, newBlock];
			blockMessageRegistry.set(id, mutation.messageId);
			focusBlockId = id;
			layout = autoDetectLayout(blocks.length);
			break;
		}

		case 'remove': {
			blocks = blocks.filter((b) => b.id !== mutation.blockId);
			blockMessageRegistry.delete(mutation.blockId);
			if (focusBlockId === mutation.blockId) {
				focusBlockId = blocks.length > 0 ? blocks[blocks.length - 1].id : null;
			}
			layout = autoDetectLayout(blocks.length);
			break;
		}

		case 'focus': {
			focusBlockId = mutation.blockId;
			// Restore if minimized
			const target = blocks.find((b) => b.id === mutation.blockId);
			if (target?.minimized) {
				blocks = blocks.map((b) => (b.id === mutation.blockId ? { ...b, minimized: false } : b));
			}
			layout = 'focus';
			break;
		}

		case 'clear': {
			// Keep pinned blocks
			const pinned = blocks.filter((b) => b.pinned);
			const removed = blocks.filter((b) => !b.pinned);
			for (const b of removed) blockMessageRegistry.delete(b.id);
			blocks = pinned;
			focusBlockId = pinned.length > 0 ? pinned[pinned.length - 1].id : null;
			layout = autoDetectLayout(blocks.length);
			break;
		}

		case 'layout': {
			layout = mutation.layout;
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
					addedAt: Date.now()
				};
			});

			blocks = [...pinnedBlocks, ...newBlocks];
			focusBlockId = newBlocks.length > 0 ? newBlocks[0].id : (pinnedBlocks[0]?.id ?? null);
			layout = autoDetectLayout(blocks.length);
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
			blocks = blocks.map((b) => (b.id === mutation.blockId ? { ...b, minimized: true } : b));
			if (focusBlockId === mutation.blockId) {
				const visible = blocks.filter((b) => !b.minimized && b.id !== mutation.blockId);
				focusBlockId = visible.length > 0 ? visible[visible.length - 1].id : null;
			}
			break;
		}

		case 'restore': {
			blocks = blocks.map((b) => (b.id === mutation.blockId ? { ...b, minimized: false } : b));
			focusBlockId = mutation.blockId;
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
	clearAll
};
