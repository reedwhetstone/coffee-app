import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Canvas from './Canvas.svelte';
import { canvasStore } from '$lib/stores/canvasStore.svelte';

vi.mock('./CanvasLayout.svelte', () => ({ default: vi.fn() }));
vi.mock('./CanvasBlockDetail.svelte', () => ({ default: vi.fn() }));

function addEvidence(messageId: string, title: string) {
	canvasStore.dispatch({
		type: 'add',
		messageId,
		title,
		block: { type: 'coffee-cards', version: 1, data: [] }
	});
}

describe('Canvas active scene and evidence shelf', () => {
	beforeEach(() => canvasStore.resetAll());

	it('separates working references, pending actions, and compact completed history', () => {
		addEvidence('reference', 'Banko Gotiti profile');
		for (const [messageId, status] of [
			['pending', 'proposed'],
			['done', 'success']
		] as const) {
			canvasStore.dispatch({
				type: 'add',
				messageId,
				block: {
					type: 'action-card',
					version: 1,
					data: {
						executionId: `${messageId}:action`,
						actionType: 'record_sale',
						summary: `${messageId} inventory action`,
						fields: [],
						status
					}
				}
			});
		}
		render(Canvas);
		expect(screen.getByRole('region', { name: 'Working references' })).toHaveTextContent(
			'Banko Gotiti profile'
		);
		expect(screen.getByRole('region', { name: 'Actions to review' })).toHaveTextContent(
			'pending inventory action'
		);
		expect(screen.getByRole('region', { name: 'Completed actions' })).toHaveTextContent(
			'done inventory action'
		);
	});

	it('switches the active scene from the shelf without rendering layout controls', async () => {
		addEvidence('message-1', 'Ethiopia shortlist');
		addEvidence('message-2', 'Kenya shortlist');
		render(Canvas);

		expect(screen.queryByText(/Layout:/)).not.toBeInTheDocument();
		expect(screen.queryByTitle(/Minimize/)).not.toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Kenya shortlist' })).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('button', { name: 'Ethiopia shortlist' }));

		expect(screen.getByRole('heading', { name: 'Ethiopia shortlist' })).toBeInTheDocument();
		expect(canvasStore.focusedBlock?.messageId).toBe('message-1');
	});

	it('pins active evidence and differentiates its shelf item', async () => {
		addEvidence('message-1', 'Ethiopia shortlist');
		render(Canvas);

		await fireEvent.click(screen.getByRole('button', { name: 'Pin canvas item' }));

		expect(canvasStore.focusedBlock?.pinned).toBe(true);
		expect(screen.getByText('Pinned')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Ethiopia shortlist, pinned' })).toHaveAttribute(
			'aria-current',
			'true'
		);
	});

	it('removes the active scene and focuses the next retained shelf item', async () => {
		addEvidence('message-1', 'First');
		addEvidence('message-2', 'Second');
		addEvidence('message-3', 'Third');
		canvasStore.dispatch({ type: 'focus', blockId: canvasStore.blocks[1].id });
		render(Canvas);

		await fireEvent.click(screen.getByRole('button', { name: 'Remove canvas item' }));

		expect(canvasStore.blocks.map((block) => block.title)).toEqual(['First', 'Third']);
		expect(canvasStore.focusedBlock?.title).toBe('Third');
	});

	it('links the active scene back to its source message', async () => {
		const onScrollToMessage = vi.fn();
		addEvidence('message-1', 'Ethiopia shortlist');
		render(Canvas, { onScrollToMessage });

		await fireEvent.click(screen.getByRole('button', { name: 'Go to source message' }));

		expect(onScrollToMessage).toHaveBeenCalledWith('message-1');
	});
});
