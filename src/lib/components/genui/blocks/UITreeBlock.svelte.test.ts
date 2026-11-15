import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GenUIBlockRenderer from '../GenUIBlockRenderer.svelte';
import { canvasStore } from '$lib/stores/canvasStore.svelte';
import { sanitizeTree } from '$lib/genui/catalog';
import { buildRoastPlanBlock } from '$lib/genui/templates';
import { describeCanvasForCherry } from '$lib/components/chat/workspaceCanvasContext';

const roastFetches = vi.hoisted(() => [] as number[]);
vi.mock('$lib/roast', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/roast')>()),
	fetchRoastChartModel: vi.fn(async (roastId: number) => {
		roastFetches.push(roastId);
		return null;
	})
}));

afterEach(() => {
	canvasStore.resetAll();
	roastFetches.length = 0;
});

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

	it('remounts the active tab panel so embedded roast charts load their own data', async () => {
		const block = {
			type: 'ui-tree',
			version: 1,
			data: {
				root: {
					type: 'tabs',
					id: 'tabs-0',
					props: { labels: ['One', 'Two'] },
					children: [
						{ type: 'roast-chart', props: { roastId: 1 } },
						{ type: 'roast-chart', props: { roastId: 2 } }
					]
				}
			}
		} as never;
		render(GenUIBlockRenderer, { block, renderMode: 'canvas' });
		await waitFor(() => expect(roastFetches).toEqual([1]));
		await fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
		await waitFor(() => expect(roastFetches).toEqual([1, 2]));
	});

	it('renders a malformed embedded block as a placeholder beside its siblings', () => {
		const { root } = sanitizeTree({
			type: 'stack',
			children: [
				{ type: 'text', props: { text: 'still here' } },
				{ type: 'data-table', props: {} }
			]
		});
		const block = { type: 'ui-tree', version: 1, data: { root } } as never;
		render(GenUIBlockRenderer, { block, renderMode: 'canvas' });
		expect(screen.getByText('still here')).toBeInTheDocument();
		expect(screen.getByText('This component is unavailable.')).toBeInTheDocument();
	});
});
