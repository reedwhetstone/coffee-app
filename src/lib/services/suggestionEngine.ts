import type { CanvasBlock } from '$lib/types/genui';

export interface Suggestion {
	label: string;
	text: string;
	icon?: string; // SVG path data
}

/**
 * Generates context-aware suggestions based on workspace type,
 * canvas state, and whether the chat has messages.
 */
export function getSuggestions(
	workspaceType: string,
	canvasBlocks: CanvasBlock[],
	hasMessages: boolean
): Suggestion[] {
	const suggestions: Suggestion[] = [];

	// Canvas-aware suggestions (highest priority)
	if (canvasBlocks.length > 0) {
		suggestions.push(...getCanvasSuggestions(canvasBlocks));
	}

	// Workspace-type suggestions
	if (!hasMessages) {
		suggestions.push(...getStarterSuggestions(workspaceType));
	} else {
		suggestions.push(...getFollowUpSuggestions(workspaceType, canvasBlocks));
	}

	// Deduplicate by label and limit to 4
	const seen = new Set<string>();
	return suggestions
		.filter((s) => {
			if (seen.has(s.label)) return false;
			seen.add(s.label);
			return true;
		})
		.slice(0, 4);
}

function getCanvasSuggestions(blocks: CanvasBlock[]): Suggestion[] {
	const suggestions: Suggestion[] = [];
	const blockTypes = new Set(blocks.map((b) => b.block.type));

	if (blockTypes.has('coffee-cards') && blocks.length >= 2) {
		suggestions.push({
			label: 'Compare these',
			text: 'Compare the coffees currently on the canvas and recommend the best one for me.'
		});
	}

	if (blockTypes.has('coffee-cards')) {
		const coffeeBlock = blocks.find((b) => b.block.type === 'coffee-cards');
		if (coffeeBlock) {
			suggestions.push({
				label: 'Flavor profiles',
				text: 'Show me the tasting notes and flavor profiles for the coffees on the canvas.'
			});
		}
	}

	if (blockTypes.has('roast-profiles') || blockTypes.has('roast-chart')) {
		suggestions.push({
			label: 'Roast analysis',
			text: 'Analyze the roast profiles on the canvas and suggest improvements.'
		});
	}

	if (blockTypes.has('coffee-cards')) {
		suggestions.push({
			label: 'Add to inventory',
			text: 'Add the highlighted coffee to my inventory.'
		});
	}

	if (blockTypes.has('inventory-table')) {
		suggestions.push({
			label: 'What should I roast?',
			text: 'Based on my inventory, what should I roast next and why?'
		});
	}

	return suggestions;
}

function getStarterSuggestions(workspaceType: string): Suggestion[] {
	switch (workspaceType) {
		case 'sourcing':
			return [
				{
					label: 'Find Ethiopian',
					text: 'Find me a natural process Ethiopian coffee with fruity, berry-forward flavors.'
				},
				{
					label: 'Budget picks',
					text: 'Show me the best value coffees under $7/lb that are currently in stock.'
				},
				{ label: 'What\u2019s new?', text: 'What new coffees have been stocked recently?' }
			];
		case 'roasting':
			return [
				{ label: 'Recent roasts', text: 'Show me my most recent roast profiles.' },
				{
					label: 'Best roasts',
					text: 'What were my best roasts by development percentage and weight loss?'
				},
				{
					label: 'Roast tips',
					text: 'What general tips do you have for improving my roast consistency?'
				}
			];
		case 'inventory':
			return [
				{ label: 'My inventory', text: 'Show me my current green coffee inventory.' },
				{ label: 'Running low', text: 'Which coffees in my inventory are running low?' },
				{
					label: 'What to buy',
					text: 'Based on my inventory and roasting history, what should I buy next?'
				}
			];
		case 'analysis':
			return [
				{
					label: 'Profit overview',
					text: 'Give me a summary of my recent sales and profit margins.'
				},
				{ label: 'Cost analysis', text: 'Analyze my cost per pound across all my coffees.' },
				{ label: 'Trends', text: 'What trends do you see in my roasting and sales data?' }
			];
		default:
			return [
				{ label: 'Find coffee', text: 'Help me find a great coffee to try.' },
				{ label: 'My inventory', text: 'Show me my current green coffee inventory.' },
				{ label: 'Recent roasts', text: 'Show me my most recent roast profiles.' }
			];
	}
}

function getFollowUpSuggestions(workspaceType: string, canvasBlocks: CanvasBlock[]): Suggestion[] {
	const suggestions: Suggestion[] = [];

	if (canvasBlocks.length === 0) {
		// No canvas content — offer workspace-relevant follow-ups
		switch (workspaceType) {
			case 'sourcing':
				suggestions.push({
					label: 'Search catalog',
					text: 'Search the coffee catalog for something interesting.'
				});
				break;
			case 'roasting':
				suggestions.push({ label: 'My roasts', text: 'Show me my recent roast profiles.' });
				break;
			case 'inventory':
				suggestions.push({
					label: 'My inventory',
					text: 'Show me my current green coffee inventory.'
				});
				break;
		}
	}

	suggestions.push({ label: 'Clear canvas', text: '/clear' });

	return suggestions;
}
