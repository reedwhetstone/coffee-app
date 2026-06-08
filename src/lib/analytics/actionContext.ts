import { checkRole, type UserRole } from '$lib/types/auth.types';

export type AnalyticsEntitlement = 'anonymous' | 'viewer' | 'intelligence' | 'roasting' | 'both';
export type AnalyticsViewMode = 'retail' | 'wholesale' | 'all';
export type AnalyticsTimeWindow = '7d' | '30d' | string;

export interface AnalyticsChatContext {
	origin: string | null;
	process: string | null;
	supplier: string | null;
	viewMode: AnalyticsViewMode;
	timeWindow: AnalyticsTimeWindow;
	activeFilters: Record<string, unknown>;
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

	return [
		'Review this Parchment Market Index context and suggest the next sourcing investigation.',
		'',
		`Market read: ${marketReadHeadline}`,
		`Scope: ${scopeLabel}`,
		`Movement window: ${context.timeWindow}`,
		`Visible evidence modules: ${modules}`,
		`Entitlement: ${context.entitlement}`,
		'',
		'Context JSON:',
		JSON.stringify(context),
		'',
		'Do not claim that anything has been saved or watched. If a persistent action would be useful, describe it as a future workflow and use catalog or API evidence that exists today.'
	].join('\n');
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

export function readAnalyticsSeedFromSearchParams(searchParams: URLSearchParams): string | null {
	if (searchParams.get('source') !== 'analytics') return null;
	const prompt = searchParams.get('prompt');
	if (!prompt?.trim()) return null;
	return prompt;
}
