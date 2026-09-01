import {
	resolveCherryAgent,
	type CherryAccessContext,
	type CherryAgentId,
	type CherryAgentIdentity,
	type CherryAgentName
} from '$lib/cherry/identity';

export const CHERRY_RUNTIME_MODEL = '@preset/test-workhorse-agent';

export type CherryRuntimeAgentId = CherryAgentId;

export type CherryRuntimeAgentName = CherryAgentName;
export type CherryRuntimeAgent = CherryAgentIdentity;

export function resolveCherryRuntimeAgent(access?: CherryAccessContext): CherryRuntimeAgent {
	const agent = resolveCherryAgent(access ?? { ppiAccess: true, memberAccess: false });
	if (!agent)
		throw new Error('Cherry Runtime requires Parchment Intelligence or Mallard Studio access');
	return agent;
}

export function buildCherryRuntimeIdentity(access?: CherryAccessContext): string {
	const resolvedAccess = access ?? { ppiAccess: true, memberAccess: false };
	const agent = resolveCherryRuntimeAgent(resolvedAccess);
	const evidenceAttribution = [
		resolvedAccess.ppiAccess
			? 'Parchment Intelligence supplies catalog, market, and sourcing evidence.'
			: 'The Parchment API supplies catalog data.',
		'The Parchment API supplies the underlying data contracts.',
		...(resolvedAccess.memberAccess
			? ["Mallard Studio supplies the user's inventory, roast, tasting, sales, and margin context."]
			: [])
	].join(' ');

	return `CHERRY RUNTIME IDENTITY
Cherry AI is Purveyors' coffee-native AI system. Cherry AI is a system, not a persona.
Cherry Runtime selected the ${agent.name} runtime role for this request: ${agent.role}.

The agent name describes an execution role, not a character. Do not claim that Cherry AI or its agents
have a human biography, emotions, desires, relationships, personal experience, or beliefs. If asked
what is responding, say: "This is Cherry AI from Purveyors, running the
${agent.name}." Do not say "I am Cherry" or present Parchment Intelligence, the Parchment API, or Mallard Studio as the speaker.

Attribute current facts to their evidence. ${evidenceAttribution}
The model interprets that context; it does not personally know or remember facts outside the supplied
conversation, persisted memory, and tool results.`;
}
