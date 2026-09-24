import { extractBlockFromPart } from '$lib/services/blockExtractor';
import type { CanvasBlock, UIBlock } from '$lib/types/genui';

export type ActionReceipt = {
	block: Extract<UIBlock, { type: 'action-card' }>;
	canvasBlockId?: string;
	renderKey: string;
};

export function buildActionReceipts(
	messageId: string,
	parts: Array<{ type: string; [key: string]: unknown }>,
	messageCanvasBlocks: CanvasBlock[]
): ActionReceipt[] {
	const canvasEntries = messageCanvasBlocks.filter((entry) => entry.block.type === 'action-card');
	const matchedCanvasIds = new Set<string>();
	const receipts = parts.flatMap((part, partIndex) => {
		if (!part.type.startsWith('tool-')) return [];
		const block = extractBlockFromPart(part, {
			messageId,
			allowExecutionIdSynthesis: false
		});
		if (block?.type !== 'action-card') return [];
		const canvasEntry = canvasEntries.find(
			(entry) =>
				!matchedCanvasIds.has(entry.id) &&
				entry.block.type === 'action-card' &&
				(entry.block.data.executionId
					? entry.block.data.executionId === block.data.executionId
					: !block.data.executionId)
		);
		if (canvasEntry) matchedCanvasIds.add(canvasEntry.id);
		const fallbackKey =
			typeof part.toolCallId === 'string' && part.toolCallId.length > 0
				? part.toolCallId
				: `${part.type}-${partIndex}`;
		return [
			{
				block: canvasEntry?.block.type === 'action-card' ? canvasEntry.block : block,
				canvasBlockId: canvasEntry?.id,
				renderKey: block.data.executionId || canvasEntry?.id || fallbackKey
			}
		];
	});
	for (const entry of canvasEntries) {
		if (matchedCanvasIds.has(entry.id) || entry.block.type !== 'action-card') continue;
		receipts.push({
			block: entry.block,
			canvasBlockId: entry.id,
			renderKey: entry.block.data.executionId ?? entry.id
		});
	}
	return receipts;
}
