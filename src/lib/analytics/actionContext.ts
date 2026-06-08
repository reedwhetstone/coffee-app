import { checkRole, type UserRole } from '$lib/types/auth.types';

export type AnalyticsEntitlement = 'anonymous' | 'viewer' | 'intelligence' | 'roasting' | 'both';
export type AnalyticsViewMode = 'retail' | 'wholesale' | 'all';
export type AnalyticsTimeWindow = '7d' | '30d' | string;

export interface AnalyticsActiveFilters {
	marketScope: AnalyticsViewMode;
	movementWindow: AnalyticsTimeWindow;
	latestIndexDate: string | null;
	stockedListings: number;
	suppliers: number;
	origins: number;
}

export interface AnalyticsChatContext {
	origin: string | null;
	process: string | null;
	supplier: string | null;
	viewMode: AnalyticsViewMode;
	timeWindow: AnalyticsTimeWindow;
	activeFilters: AnalyticsActiveFilters;
	visibleModules: string[];
	entitlement: AnalyticsEntitlement;
}

export interface AnalyticsEntitlementInput {
	session: unknown;
	role: UserRole | UserRole[] | undefined;
	ppiAccess: boolean;
}

export function resolveAnalyticsEntitlement({
	session,
	role,
	ppiAccess
}: AnalyticsEntitlementInput): AnalyticsEntitlement {
	if (!session) return 'anonymous';
	const hasRoasting = checkRole(role, 'member');
	if (ppiAccess && hasRoasting) return 'both';
	if (ppiAccess) return 'intelligence';
	if (hasRoasting) return 'roasting';
	return 'viewer';
}

export function canUseAnalyticsChat(entitlement: AnalyticsEntitlement): boolean {
	return entitlement === 'intelligence' || entitlement === 'roasting' || entitlement === 'both';
}

export function buildAnalyticsChatPrompt(
	context: AnalyticsChatContext,
	marketReadHeadline: string
): string {
	const scopeLabel =
		context.viewMode === 'all' ? 'combined retail and wholesale' : context.viewMode;
	const modules = context.visibleModules.join(', ');
	const accessLabel = formatAnalyticsAccessLevel(context.entitlement);
	const filters = context.activeFilters;

	return [
		'Review this market analytics context and suggest the next sourcing investigation.',
		'',
		`Market read: ${marketReadHeadline}`,
		`Scope: ${scopeLabel}`,
		`Movement window: ${context.timeWindow}`,
		`Latest index date: ${filters.latestIndexDate ?? 'not available'}`,
		`Stocked listings: ${filters.stockedListings}`,
		`Suppliers: ${filters.suppliers}`,
		`Origins: ${filters.origins}`,
		`Visible evidence: ${modules}`,
		`Access level: ${accessLabel}`,
		'',
		'Do not claim that anything has been saved or watched. If a persistent action would be useful, describe it as a future workflow and use catalog or API evidence that exists today.'
	].join('\n');
}

function formatAnalyticsAccessLevel(entitlement: AnalyticsEntitlement): string {
	switch (entitlement) {
		case 'anonymous':
			return 'Signed out';
		case 'viewer':
			return 'Viewer';
		case 'intelligence':
			return 'Parchment Intelligence';
		case 'roasting':
			return 'Mallard Studio';
		case 'both':
			return 'Parchment Intelligence and Mallard Studio';
	}
}

export function buildAnalyticsChatHref(
	context: AnalyticsChatContext,
	marketReadHeadline: string
): string {
	const params = new URLSearchParams({
		source: 'analytics',
		prompt: buildAnalyticsChatPrompt(context, marketReadHeadline)
	});
	return `/chat?${params.toString()}`;
}

export interface AnalyticsSeedInputState {
	inputMessage: string;
	lastAnalyticsSeed: string | null;
}

export interface AnalyticsSeedInputRequest extends AnalyticsSeedInputState {
	canUseChat: boolean;
	incomingSeed: string | null;
}

export function readAnalyticsSeedFromSearchParams(searchParams: URLSearchParams): string | null {
	if (searchParams.get('source') !== 'analytics') return null;
	const prompt = searchParams.get('prompt');
	if (!prompt?.trim()) return null;
	return prompt;
}

export function applyAnalyticsSeedToInput({
	canUseChat,
	incomingSeed,
	inputMessage,
	lastAnalyticsSeed
}: AnalyticsSeedInputRequest): AnalyticsSeedInputState {
	if (!canUseChat || !incomingSeed || incomingSeed === lastAnalyticsSeed) {
		return { inputMessage, lastAnalyticsSeed };
	}

	const hasUserEditedInput = inputMessage.trim().length > 0 && inputMessage !== lastAnalyticsSeed;
	if (hasUserEditedInput) {
		return { inputMessage, lastAnalyticsSeed: incomingSeed };
	}

	return { inputMessage: incomingSeed, lastAnalyticsSeed: incomingSeed };
}
