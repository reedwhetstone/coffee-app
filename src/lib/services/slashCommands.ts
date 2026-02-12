export interface SlashCommand {
	name: string;
	description: string;
	/** If set, this text replaces the command as a chat message to the AI */
	chatText?: string;
	/** If set, this action type is dispatched directly (no AI call) */
	action?: 'clear-canvas' | 'pin-focused' | 'unpin-focused';
}

export const SLASH_COMMANDS: SlashCommand[] = [
	{
		name: '/beans',
		description: 'Show your green coffee inventory',
		chatText: 'Show me my current green coffee inventory.'
	},
	{
		name: '/roast',
		description: 'Show recent roast profiles',
		chatText: 'Show me my most recent roast profiles.'
	},
	{
		name: '/find',
		description: 'Search the coffee catalog',
		chatText: 'Search the coffee catalog for interesting coffees that are currently in stock.'
	},
	{
		name: '/compare',
		description: 'Compare items on the canvas',
		chatText: 'Compare the items currently on the canvas and help me decide.'
	},
	{
		name: '/profit',
		description: 'Show profit and sales summary',
		chatText: 'Give me a summary of my recent sales and profit margins.'
	},
	{
		name: '/clear',
		description: 'Clear the canvas',
		action: 'clear-canvas'
	},
	{
		name: '/pin',
		description: 'Pin the focused canvas block',
		action: 'pin-focused'
	},
	{
		name: '/unpin',
		description: 'Unpin the focused canvas block',
		action: 'unpin-focused'
	}
];

/**
 * Given raw input text, check if it starts with a slash command.
 * Returns the matching command or null.
 */
export function matchSlashCommand(input: string): SlashCommand | null {
	const trimmed = input.trim().toLowerCase();
	return (
		SLASH_COMMANDS.find((cmd) => trimmed === cmd.name || trimmed.startsWith(cmd.name + ' ')) ?? null
	);
}

/**
 * Returns matching commands for autocomplete (partial match).
 */
export function getSlashCompletions(input: string): SlashCommand[] {
	const trimmed = input.trim().toLowerCase();
	if (!trimmed.startsWith('/')) return [];
	return SLASH_COMMANDS.filter((cmd) => cmd.name.startsWith(trimmed));
}
