export const CHERRY_AI_NAME = 'Cherry AI' as const;

export type CherryAgentId = 'cherry-green-agent' | 'cherry-roast-agent' | 'cherry-synthesis-agent';

export type CherryAgentName =
	| 'Cherry Green Agent'
	| 'Cherry Roaster Agent'
	| 'Cherry Synthesis Agent';

export interface CherryAccessContext {
	ppiAccess: boolean;
	memberAccess: boolean;
}

export interface CherryAgentIdentity {
	id: CherryAgentId;
	name: CherryAgentName;
	role: string;
	shortDescription: string;
}

const GREEN_AGENT: CherryAgentIdentity = {
	id: 'cherry-green-agent',
	name: 'Cherry Green Agent',
	role: 'green-coffee sourcing and market analysis with Parchment Intelligence evidence and tools',
	shortDescription: 'Live offers, market movement, supplier evidence, and your sourcing work.'
};

const ROASTER_AGENT: CherryAgentIdentity = {
	id: 'cherry-roast-agent',
	name: 'Cherry Roaster Agent',
	role: 'roastery analysis with Mallard Studio inventory, roast, tasting, sales, and margin context',
	shortDescription: 'Inventory, roasts, tasting, sales, and margin context from Mallard Studio.'
};

const SYNTHESIS_AGENT: CherryAgentIdentity = {
	id: 'cherry-synthesis-agent',
	name: 'Cherry Synthesis Agent',
	role: 'cross-domain analysis that connects Parchment Intelligence evidence with Mallard Studio roastery context',
	shortDescription: 'Market evidence and roastery context connected across your coffee operation.'
};

export function resolveCherryAgent(access: CherryAccessContext): CherryAgentIdentity | null {
	if (access.ppiAccess && access.memberAccess) return SYNTHESIS_AGENT;
	if (access.memberAccess) return ROASTER_AGENT;
	if (access.ppiAccess) return GREEN_AGENT;
	return null;
}
