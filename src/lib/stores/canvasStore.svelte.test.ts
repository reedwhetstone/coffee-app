import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UIBlock } from '$lib/types/genui';

type CanvasModule = typeof import('./canvasStore.svelte');

async function loadCanvasStore(): Promise<CanvasModule> {
	vi.resetModules();
	return import('./canvasStore.svelte');
}

function cards(id: number): UIBlock {
	return { type: 'coffee-cards', version: 1, data: [{ id } as never] };
}

describe('canvasStore pinning', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('floats pinned blocks to the front of visibleBlocks, stable otherwise', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'add', block: cards(2), messageId: 'm2' });
		canvasStore.dispatch({ type: 'add', block: cards(3), messageId: 'm3' });

		// Pin the middle block; it should jump to the front.
		const middle = canvasStore.blocks[1];
		canvasStore.dispatch({ type: 'pin', blockId: middle.id });

		const order = canvasStore.visibleBlocks.map((b) => b.messageId);
		expect(order).toEqual(['m2', 'm1', 'm3']);
	});

	it('keeps pinned blocks and drops the rest on clear', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'add', block: cards(2), messageId: 'm2' });
		canvasStore.dispatch({ type: 'pin', blockId: canvasStore.blocks[0].id });

		canvasStore.clearAll();

		expect(canvasStore.blocks.map((b) => b.messageId)).toEqual(['m1']);
	});

	it('drops pinned blocks on a full reset for workspace restore', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'add', block: cards(2), messageId: 'm2' });
		const pinnedBlockId = canvasStore.blocks[0].id;
		canvasStore.dispatch({ type: 'pin', blockId: pinnedBlockId });
		canvasStore.dispatch({ type: 'layout', layout: 'dashboard' });

		canvasStore.resetAll();

		expect(canvasStore.blocks).toEqual([]);
		expect(canvasStore.focusBlockId).toBeNull();
		expect(canvasStore.layout).toBe('focus');
		expect(canvasStore.getMessageIdForBlock(pinnedBlockId)).toBeUndefined();
	});

	it('carries an AI title onto an added block', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({
			type: 'add',
			block: cards(1),
			messageId: 'm1',
			title: 'Ethiopia naturals'
		});

		expect(canvasStore.blocks[0].title).toBe('Ethiopia naturals');
	});

	it('durably removes one block without minimizing or clearing its siblings', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'add', block: cards(2), messageId: 'm2' });
		const removedBlockId = canvasStore.blocks[0].id;

		canvasStore.dispatch({ type: 'remove', blockId: removedBlockId });

		expect(canvasStore.blocks.map((block) => block.messageId)).toEqual(['m2']);
		expect(canvasStore.getMessageIdForBlock(removedBlockId)).toBeUndefined();
	});
});

describe('canvasStore layout lock', () => {
	it('keeps an explicitly chosen layout when new blocks are added', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'layout', layout: 'stack' });

		// AI injects more content — the chosen view must survive.
		canvasStore.dispatch({ type: 'add', block: cards(2), messageId: 'm2' });
		canvasStore.dispatch({ type: 'add', block: cards(3), messageId: 'm3' });

		expect(canvasStore.layout).toBe('stack');
	});

	it('does not change layout when focusing a block', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'layout', layout: 'dashboard' });
		canvasStore.dispatch({ type: 'focus', blockId: canvasStore.blocks[0].id });

		expect(canvasStore.layout).toBe('dashboard');
	});

	it('resumes auto-layout after a clear', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'layout', layout: 'stack' });
		canvasStore.clearAll();
		// Two unpinned adds → auto-detect picks comparison again.
		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'add', block: cards(2), messageId: 'm2' });

		expect(canvasStore.layout).toBe('comparison');
	});

	it('keeps the current layout when content is added after a window is locked', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		expect(canvasStore.layout).toBe('focus');
		canvasStore.dispatch({ type: 'pin', blockId: canvasStore.blocks[0].id });

		canvasStore.dispatch({ type: 'add', block: cards(2), messageId: 'm2' });
		canvasStore.dispatch({ type: 'add', block: cards(3), messageId: 'm3' });

		expect(canvasStore.layout).toBe('focus');
	});

	it('keeps the current layout when content is replaced around a locked window', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'pin', blockId: canvasStore.blocks[0].id });

		canvasStore.dispatch({
			type: 'replace',
			blocks: [
				{ block: cards(2), messageId: 'm2' },
				{ block: cards(3), messageId: 'm3' }
			]
		});

		expect(canvasStore.layout).toBe('focus');
		expect(canvasStore.blocks.map((b) => b.messageId)).toEqual(['m1', 'm2', 'm3']);
	});
});

describe('canvasStore agent layout suggestions (lock)', () => {
	it('applies an agent layout suggestion when nothing is owned or locked', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'layout', layout: 'dashboard', source: 'agent' });

		expect(canvasStore.layout).toBe('dashboard');
	});

	it('ignores an agent layout suggestion once the user has chosen a layout', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'layout', layout: 'stack' }); // user choice
		canvasStore.dispatch({ type: 'layout', layout: 'dashboard', source: 'agent' });

		expect(canvasStore.layout).toBe('stack');
	});

	it('ignores an agent layout suggestion when any window is locked', async () => {
		const { canvasStore } = await loadCanvasStore();

		canvasStore.dispatch({ type: 'add', block: cards(1), messageId: 'm1' });
		canvasStore.dispatch({ type: 'pin', blockId: canvasStore.blocks[0].id }); // lock
		const before = canvasStore.layout;
		canvasStore.dispatch({ type: 'layout', layout: 'dashboard', source: 'agent' });

		expect(canvasStore.layout).toBe(before);
	});
});
