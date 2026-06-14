import type { RoastChartBlock, UIBlock } from '$lib/types/genui';

/**
 * Extra blocks rendered beneath the primary block inside a canvas pop-out
 * detail panel. These are the "more detail" the compact canvas card omits —
 * e.g. a full roast temperature chart for each roast in a roast-profiles block.
 *
 * Returning an empty array means the detail panel just shows a larger render of
 * the block itself (which is already the right depth for tables and radars).
 */
export function getDetailCompanionBlocks(block: UIBlock): UIBlock[] {
	if (block.type === 'roast-profiles') {
		const seen = new Set<number>();
		const charts: RoastChartBlock[] = [];
		for (const profile of block.data) {
			const roastId = Number(profile.roast_id);
			if (!Number.isFinite(roastId) || roastId <= 0 || seen.has(roastId)) continue;
			seen.add(roastId);
			charts.push({ type: 'roast-chart', version: 1, data: { roastId } });
		}
		return charts;
	}

	return [];
}

/** Best-effort label for a detail companion block (chart heading, etc.). */
export function detailCompanionLabel(block: UIBlock): string | null {
	if (block.type === 'roast-chart') {
		return `Roast #${block.data.roastId}`;
	}
	return null;
}

/**
 * Whether a block type benefits from a pop-out detail panel at all. Error and
 * form blocks are already self-contained inline, so they don't get an expand
 * affordance.
 */
export function blockSupportsDetail(block: UIBlock): boolean {
	return block.type !== 'error';
}
