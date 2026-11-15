import { z } from 'zod';

/**
 * Cherry genUI component catalog.
 *
 * One typed registry owns every component the model may place on the canvas:
 * composable layout/interaction primitives and the existing coffee blocks.
 * The renderer only renders catalog components; anything else degrades to a
 * quiet fallback instead of breaking the surface. The prompt-facing index is
 * generated from this registry, and full schemas are served on demand.
 */

// ─── Tree model ───────────────────────────────────────────────────────────────

export interface UINode {
	type: string;
	/** Stable id. Required for interactive nodes (state is keyed by it); generated when missing. */
	id?: string;
	props?: Record<string, unknown>;
	children?: UINode[];
}

/** Value held in shared block state for one interactive node. */
export type BlockStateValue = string | number | string[] | null;
export type BlockState = Record<string, BlockStateValue>;

export const UI_TREE_LIMITS = { maxDepth: 6, maxNodes: 120, maxChecklistItems: 40 } as const;

/** Type of the placeholder the sanitizer substitutes for unknown or invalid nodes. */
export const FALLBACK_NODE_TYPE = '__unavailable';

// ─── Primitive prop schemas ───────────────────────────────────────────────────

const gap = z.enum(['sm', 'md', 'lg']).optional();
const text = (max: number) => z.string().min(1).max(max);

const stackProps = z.object({
	direction: z.enum(['vertical', 'horizontal']).optional(),
	gap
});
const gridProps = z.object({ columns: z.number().int().min(1).max(4).optional(), gap });
const tabsProps = z.object({
	labels: z
		.array(text(40))
		.min(1)
		.max(8)
		.describe('Tab labels; children[i] is the panel for labels[i].')
});
const cardProps = z.object({ title: text(120).optional(), subtitle: text(200).optional() });
const calloutProps = z.object({
	tone: z.enum(['info', 'success', 'warning', 'danger']).optional(),
	title: text(120).optional(),
	text: text(600)
});
const textProps = z.object({
	text: text(1200),
	variant: z.enum(['body', 'heading', 'caption']).optional()
});
const checklistProps = z.object({
	title: text(120).optional(),
	items: z
		.array(
			z.object({
				id: text(40).describe('Stable item id; the agent reads checked ids back.'),
				label: text(160),
				detail: text(240).optional()
			})
		)
		.min(1)
		.max(UI_TREE_LIMITS.maxChecklistItems)
});
const textFieldProps = z.object({
	label: text(120),
	placeholder: text(120).optional(),
	multiline: z.boolean().optional()
});
const numberFieldProps = z.object({
	label: text(120),
	unit: text(16).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	step: z.number().positive().optional()
});
const selectFieldProps = z.object({
	label: text(120),
	options: z
		.array(z.object({ value: text(60), label: text(80) }))
		.min(1)
		.max(20)
});
const tableProps = z.object({
	columns: z
		.array(
			z.object({
				key: text(40),
				label: text(60),
				align: z.enum(['left', 'center', 'right']).optional()
			})
		)
		.min(1)
		.max(10),
	rows: z
		.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])))
		.max(100)
});

// ─── Existing coffee blocks (props are the block's `data`) ────────────────────
//
// Only blocks that GenUIBlockRenderer can render in canvas mode are registered.
// action-card is excluded: its Execute needs the canvas execution handler, which
// embedded nodes do not receive, and typed write actions are a later phase.
// Each schema requires the fields its renderer dereferences unguarded, so a
// malformed embedded block degrades to the placeholder instead of throwing.
// Deeper row/card fields stay loose: those renderers already tolerate absence.

const numericId = z.number().finite();
const coffeeRecords = z.array(z.looseObject({ id: numericId }));
const inventoryRecords = z.array(z.looseObject({ id: numericId }));
const roastProfileRecords = z.array(z.looseObject({ roast_id: numericId }));
const roastChartData = z.looseObject({ roastId: numericId });
const tastingRadarData = z.looseObject({
	beanName: z.string(),
	beanId: numericId,
	notes: z.record(z.string(), z.unknown()),
	source: z.enum(['user', 'supplier', 'both'])
});
const dataTableData = z.looseObject({
	columns: z
		.array(
			z.looseObject({
				key: z.string(),
				label: z.string(),
				sortable: z.boolean().optional(),
				align: z.enum(['left', 'center', 'right']).optional()
			})
		)
		.min(1),
	rows: z.array(z.record(z.string(), z.unknown()))
});
const errorData = z.looseObject({ message: z.string(), retryable: z.boolean() });

// ─── Registry ─────────────────────────────────────────────────────────────────

export type ComponentKind = 'primitive' | 'block';

export interface CatalogComponent {
	name: string;
	kind: ComponentKind;
	summary: string;
	props: z.ZodType;
	/** Accepts child nodes. */
	container?: boolean;
	/** Holds user state persisted per block and readable by the agent. */
	interactive?: boolean;
}

const primitive = (
	name: string,
	summary: string,
	props: z.ZodType,
	flags: Pick<CatalogComponent, 'container' | 'interactive'> = {}
): CatalogComponent => ({ name, kind: 'primitive', summary, props, ...flags });

const block = (name: string, summary: string, props: z.ZodType): CatalogComponent => ({
	name,
	kind: 'block',
	summary,
	props
});

export const CATALOG: readonly CatalogComponent[] = [
	primitive('stack', 'Lay children out in a row or column.', stackProps, { container: true }),
	primitive('grid', 'Responsive grid of 1-4 columns.', gridProps, { container: true }),
	primitive('tabs', 'Tabbed panels; one child per label.', tabsProps, { container: true }),
	primitive('card', 'Titled surface that groups children.', cardProps, { container: true }),
	primitive('callout', 'Highlighted note (info, success, warning, danger).', calloutProps),
	primitive('text', 'Heading, paragraph or caption.', textProps),
	primitive(
		'checklist',
		'Checkable steps; checked ids persist and are readable by the agent.',
		checklistProps,
		{
			interactive: true
		}
	),
	primitive('text-field', 'Free text input saved with the block.', textFieldProps, {
		interactive: true
	}),
	primitive('number-field', 'Numeric input saved with the block.', numberFieldProps, {
		interactive: true
	}),
	primitive('select-field', 'Single choice saved with the block.', selectFieldProps, {
		interactive: true
	}),
	primitive('table', 'Static table of simple values.', tableProps),
	block(
		'coffee-cards',
		'Coffee catalog cards. props: array of catalog coffees (each with a numeric id).',
		coffeeRecords
	),
	block(
		'inventory-table',
		'Green coffee inventory table. props: array of inventory rows (each with a numeric id).',
		inventoryRecords
	),
	block('roast-chart', 'Roast temperature curve. props: { roastId }.', roastChartData),
	block(
		'roast-profiles',
		'Roast profile summary table. props: array of profiles (each with a numeric roast_id).',
		roastProfileRecords
	),
	block(
		'tasting-radar',
		'Tasting radar for one bean. props: { beanName, beanId, notes, source }.',
		tastingRadarData
	),
	block('data-table', 'Sortable data table. props: { columns, rows }.', dataTableData),
	block('error', 'Error notice. props: { message, retryable }.', errorData)
];

const byName = new Map(CATALOG.map((c) => [c.name, c]));

export function getComponent(name: string): CatalogComponent | undefined {
	return byName.get(name);
}

// ─── Progressive disclosure ───────────────────────────────────────────────────

/**
 * One-line index for the system prompt. Full prop schemas are fetched on demand
 * with describeComponents so the prompt does not grow with the catalog.
 */
export function catalogIndex(): string {
	const primitives = CATALOG.filter((c) => c.kind === 'primitive').map((c) => c.name);
	const blocks = CATALOG.filter((c) => c.kind === 'block').map((c) => c.name);
	return (
		`UI components: ${primitives.join(', ')}; coffee blocks: ${blocks.join(', ')}. ` +
		'Call describe_components(names) for props before composing a tree.'
	);
}

export interface ComponentDescription {
	name: string;
	kind: ComponentKind;
	summary: string;
	container: boolean;
	interactive: boolean;
	schema: unknown;
}

/** Full schemas for requested components (all when names is omitted). */
export function describeComponents(names?: string[]): {
	components: ComponentDescription[];
	unknown: string[];
} {
	const wanted = names && names.length > 0 ? names : CATALOG.map((c) => c.name);
	const components: ComponentDescription[] = [];
	const unknown: string[] = [];
	for (const name of new Set(wanted)) {
		const entry = byName.get(name);
		if (!entry) {
			unknown.push(name);
			continue;
		}
		components.push({
			name: entry.name,
			kind: entry.kind,
			summary: entry.summary,
			container: Boolean(entry.container),
			interactive: Boolean(entry.interactive),
			schema: z.toJSONSchema(entry.props, { unrepresentable: 'any' })
		});
	}
	return { components, unknown };
}

// ─── Validation and graceful degradation ──────────────────────────────────────

export interface SanitizedTree {
	root: UINode | null;
	issues: string[];
}

function fallback(reason: string, original: string): UINode {
	return { type: FALLBACK_NODE_TYPE, props: { reason, original } };
}

/**
 * Validate a model-emitted tree against the catalog. Unknown components,
 * invalid props, and over-limit branches are replaced with a fallback node so
 * a single bad node never breaks the whole surface.
 */
export function sanitizeTree(raw: unknown): SanitizedTree {
	const issues: string[] = [];
	let count = 0;
	const usedIds = new Set<string>();

	const walk = (value: unknown, path: string, depth: number): UINode => {
		count += 1;
		if (count > UI_TREE_LIMITS.maxNodes) return fallback('Too many components', 'unknown');
		if (!value || typeof value !== 'object' || typeof (value as UINode).type !== 'string') {
			issues.push(`${path}: not a component node`);
			return fallback('Invalid component', 'unknown');
		}
		const node = value as UINode;
		const entry = byName.get(node.type);
		if (!entry) {
			issues.push(`${path}: unknown component "${node.type}"`);
			return fallback('Unknown component', node.type);
		}
		const parsed = entry.props.safeParse(node.props ?? (entry.kind === 'block' ? undefined : {}));
		if (!parsed.success) {
			issues.push(`${path}: invalid props for "${node.type}"`);
			return fallback('Invalid component', node.type);
		}
		const result: UINode = { type: node.type, props: parsed.data as Record<string, unknown> };
		if (entry.interactive || entry.container) {
			let id = typeof node.id === 'string' && node.id.trim() ? node.id.trim().slice(0, 60) : '';
			if (!id || usedIds.has(id)) {
				// Path-derived ids can collide with an explicit id used earlier, so probe until free.
				const base = `${node.type}-${path.replace(/[^0-9]+/g, '-').replace(/^-|-$/g, '') || '0'}`;
				id = base;
				for (let n = 2; usedIds.has(id); n += 1) id = `${base}-${n}`;
			}
			usedIds.add(id);
			result.id = id;
		}
		if (entry.container && Array.isArray(node.children)) {
			if (depth >= UI_TREE_LIMITS.maxDepth) {
				issues.push(`${path}: nesting too deep`);
				result.children = [];
			} else {
				result.children = node.children.map((child, i) => walk(child, `${path}.${i}`, depth + 1));
			}
		}
		return result;
	};

	if (!raw || typeof raw !== 'object') return { root: null, issues: ['empty tree'] };
	const root = walk(raw, '0', 1);
	return { root: root.type === FALLBACK_NODE_TYPE ? null : root, issues };
}

/** Interactive nodes in document order. */
export function collectInteractive(root: UINode): UINode[] {
	const out: UINode[] = [];
	const visit = (n: UINode) => {
		if (getComponent(n.type)?.interactive && n.id) out.push(n);
		n.children?.forEach(visit);
	};
	visit(root);
	return out;
}

/** Keep only values that match a node's expected shape; ignore stale keys. */
export function coerceStateValue(node: UINode, value: unknown): BlockStateValue | undefined {
	switch (node.type) {
		case 'checklist': {
			if (!Array.isArray(value)) return undefined;
			const ids = new Set(
				((node.props?.items as Array<{ id: string }> | undefined) ?? []).map((i) => i.id)
			);
			return value.filter((v): v is string => typeof v === 'string' && ids.has(v));
		}
		case 'number-field':
			return typeof value === 'number' && Number.isFinite(value) ? value : null;
		case 'text-field':
			return typeof value === 'string' ? value.slice(0, 2000) : undefined;
		case 'select-field': {
			const options = (node.props?.options as Array<{ value: string }> | undefined) ?? [];
			return typeof value === 'string' && options.some((o) => o.value === value) ? value : null;
		}
		default:
			return undefined;
	}
}

/**
 * Compact, agent-readable summary of interactive state, e.g.
 * `Roast plan: 3/5 done (open: Preheat drum); Charge temp: 400`.
 * Bounded so it fits the canvas description budget.
 */
export function describeTreeState(
	root: UINode,
	state: BlockState | undefined,
	maxChars = 220
): string {
	const parts: string[] = [];
	for (const node of collectInteractive(root)) {
		const value = coerceStateValue(node, state?.[node.id!]);
		const label = String(node.props?.title ?? node.props?.label ?? node.type);
		if (node.type === 'checklist') {
			const items = (node.props?.items as Array<{ id: string; label: string }>) ?? [];
			const done = new Set((value as string[] | undefined) ?? []);
			const open = items.filter((i) => !done.has(i.id)).map((i) => i.label);
			parts.push(
				`${label}: ${done.size}/${items.length} done` +
					(open.length
						? ` (open: ${open.slice(0, 3).join(', ')}${open.length > 3 ? ', …' : ''})`
						: '')
			);
		} else if (value !== undefined && value !== null && value !== '') {
			parts.push(`${label}: ${String(value).slice(0, 40)}`);
		} else {
			parts.push(`${label}: (empty)`);
		}
	}
	const joined = parts.join('; ');
	return joined.length <= maxChars ? joined : `${joined.slice(0, maxChars - 1).trimEnd()}…`;
}
