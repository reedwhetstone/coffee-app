import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import GenUIBlockRenderer from '../GenUIBlockRenderer.svelte';
import { canvasStore } from '$lib/stores/canvasStore.svelte';
import { buildRoastPlanBlock } from '$lib/genui/templates';
import { describeCanvasForCherry } from '$lib/components/chat/workspaceCanvasContext';

afterEach(() => canvasStore.resetAll());

describe('ui-tree block', () => {
	it('ticks a checklist item into shared canvas state the agent can read', async () => {
		const block = buildRoastPlanBlock('Kenya AA');
		canvasStore.dispatch({ type: 'add', block, messageId: 'm' });
		const id = canvasStore.blocks[0].id;
		render(GenUIBlockRenderer, { block, canvasBlockId: id, renderMode: 'canvas' });

		await fireEvent.click(screen.getByLabelText(/Weigh green coffee/));
		await fireEvent.input(screen.getByLabelText(/Charge temp/), { target: { value: '410' } });

		expect(canvasStore.blocks[0].state).toEqual({
			'roast-plan-steps': ['weigh'],
			'charge-temp': 410
		});
		const description = describeCanvasForCherry(canvasStore.visibleBlocks);
		expect(description).toContain('1/8 done');
		expect(description).toContain('Charge temp: 410');
	});

	it('is read-only without a canvas block id', () => {
		render(GenUIBlockRenderer, { block: buildRoastPlanBlock(), renderMode: 'canvas' });
		expect(screen.getByLabelText(/Weigh green coffee/)).toBeDisabled();
	});

	it('renders a fallback for an unknown node injected after validation', () => {
		const block = {
			type: 'ui-tree',
			version: 1,
			data: { root: { type: 'stack', children: [{ type: '__unavailable' }] } }
		} as never;
		render(GenUIBlockRenderer, { block, renderMode: 'canvas' });
		expect(screen.getByText('This component is unavailable.')).toBeInTheDocument();
	});
});
