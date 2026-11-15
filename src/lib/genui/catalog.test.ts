import { describe, expect, it } from 'vitest';
import {
	CATALOG,
	catalogIndex,
	describeComponents,
	describeTreeState,
	sanitizeTree,
	collectInteractive,
	coerceStateValue
} from './catalog';
import { buildRoastPlanBlock } from './templates';
import { describeCanvasForCherry } from '$lib/components/chat/workspaceCanvasContext';
import { extractBlockFromPart, buildToolCanvasDispatchPlan } from '$lib/services/blockExtractor';

describe('catalog', () => {
	it('registers primitives and all 13 existing blocks', () => {
		const names = CATALOG.map((c) => c.name);
		for (const n of [
			'stack',
			'grid',
			'tabs',
			'card',
			'callout',
			'checklist',
			'text-field',
			'table'
		])
			expect(names).toContain(n);
		for (const n of [
			'coffee-cards',
			'inventory-table',
			'roast-chart',
			'roast-comparison',
			'roast-profiles',
			'profit-summary',
			'tasting-radar',
			'data-table',
			'action-card',
			'bean-form',
			'roast-form',
			'sale-form',
			'error'
		])
			expect(names).toContain(n);
	});

	it('index is one line and lists every component; schemas are on demand', () => {
		const idx = catalogIndex();
		expect(idx.includes('\n')).toBe(false);
		for (const c of CATALOG) expect(idx).toContain(c.name);
		const { components, unknown } = describeComponents(['checklist', 'nope']);
		expect(unknown).toEqual(['nope']);
		expect(components).toHaveLength(1);
		expect(JSON.stringify(components[0].schema)).toContain('items');
	});

	it('degrades unknown and invalid nodes without dropping siblings', () => {
		const { root, issues } = sanitizeTree({
			type: 'stack',
			children: [
				{ type: 'text', props: { text: 'ok' } },
				{ type: 'hologram', props: {} },
				{ type: 'callout', props: { text: '' } },
				'garbage'
			]
		});
		expect(root?.children?.map((c) => c.type)).toEqual([
			'text',
			'__unavailable',
			'__unavailable',
			'__unavailable'
		]);
		expect(issues).toHaveLength(3);
	});

	it('assigns unique ids to interactive nodes and enforces depth', () => {
		const item = { id: 'a', label: 'A' };
		const { root } = sanitizeTree({
			type: 'stack',
			children: [
				{ type: 'checklist', id: 'x', props: { items: [item] } },
				{ type: 'checklist', id: 'x', props: { items: [item] } }
			]
		});
		const ids = collectInteractive(root!).map((n) => n.id);
		expect(new Set(ids).size).toBe(2);
		let deep: unknown = { type: 'text', props: { text: 't' } };
		for (let i = 0; i < 10; i++) deep = { type: 'stack', children: [deep] };
		expect(sanitizeTree(deep).issues.join()).toContain('too deep');
	});

	it('coerces state and summarizes it for the agent', () => {
		const block = buildRoastPlanBlock('Ethiopia Guji');
		const nodes = collectInteractive(block.data.root);
		const list = nodes.find((n) => n.type === 'checklist')!;
		expect(coerceStateValue(list, ['weigh', 'bogus'])).toEqual(['weigh']);
		const summary = describeTreeState(
			block.data.root,
			{
				'roast-plan-steps': ['weigh', 'preheat'],
				'charge-temp': 400
			},
			400
		);
		expect(summary).toContain('Roast plan: 2/8 done');
		expect(summary).toContain('Charge temp: 400');
		const desc = describeCanvasForCherry([
			{ block, pinned: false, state: { 'roast-plan-steps': ['weigh'] } }
		]);
		expect(desc).toContain('1/8 done');
		expect(desc.length).toBeLessThanOrEqual(500);
	});

	it('present_ui tool output becomes a canvas ui-tree block', () => {
		const part = {
			type: 'tool-present_ui',
			state: 'output-available',
			output: { ui: { title: 'Plan', root: { type: 'text', props: { text: 'hi' } } } }
		};
		const block = extractBlockFromPart(part);
		expect(block?.type).toBe('ui-tree');
		const plan = buildToolCanvasDispatchPlan(part, block, 'm1');
		expect(plan.mutations?.[0].type).toBe('add');
		const bad = extractBlockFromPart({ ...part, output: { ui: { root: { type: 'nope' } } } });
		expect(bad?.type).toBe('error');
	});
});
