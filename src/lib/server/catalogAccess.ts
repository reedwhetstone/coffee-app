import type { Session } from '@supabase/supabase-js';
import type { ApiPlan } from '$lib/server/apiAuth';
import type { RequestPrincipal } from '$lib/server/principal';
import { checkRole, type UserRole } from '$lib/types/auth.types';
import { PREMIUM_DISCOVERY_FILTER_KEYS } from '$lib/catalog/accessPolicy';

export interface CatalogAccessCapabilities {
	canViewPublicCatalog: boolean;
	canViewFullCatalog: boolean;
	canViewWholesale: boolean;
	canUseBasicFilters: boolean;
	canUseAdvancedFilters: boolean;
	canUseProcessFacets: boolean;
	canUsePriceScoreRanges: boolean;
	canUseAdvancedSorts: boolean;
	canViewPremiumFilterMetadata: boolean;
	canUseSemanticSearch: boolean;
	canUseBeanMatching: boolean;
	canUseSavedSearches: boolean;
	canExport: boolean;
}

export interface CatalogAccessInput {
	session?: Session | null;
	role?: UserRole | null;
	principal?: RequestPrincipal | null;
	apiPlan?: ApiPlan | null;
}

export type CatalogAccessDenialStatus = 401 | 403;

export interface CatalogAccessDeniedNotice {
	status: CatalogAccessDenialStatus;
	code: 'auth_required' | 'entitlement_required';
	message: string;
	deniedParams: string[];
}

export const PROCESS_FACET_FILTER_KEYS = [
	'processing_base_method',
	'fermentation_type',
	'process_additive',
	'has_additives',
	'processing_disclosure_level',
	'processing_confidence_min'
] as const;

export { PREMIUM_DISCOVERY_FILTER_KEYS };

const API_PLAN_HIERARCHY: Record<ApiPlan, number> = {
	viewer: 0,
	member: 1,
	enterprise: 2
};

function apiPlanAtLeast(plan: ApiPlan | null | undefined, requiredPlan: ApiPlan): boolean {
	if (!plan) return false;
	return API_PLAN_HIERARCHY[plan] >= API_PLAN_HIERARCHY[requiredPlan];
}

function isMemberRole(role: UserRole | null | undefined): boolean {
	return checkRole(role ?? undefined, 'member');
}

function resolveSubject(input: CatalogAccessInput): {
	isAuthenticated: boolean;
	isApiKey: boolean;
	role: UserRole | null;
	apiPlan: ApiPlan | null;
} {
	if (input.principal) {
		return {
			isAuthenticated: input.principal.isAuthenticated,
			isApiKey: input.principal.authKind === 'api-key' || Boolean(input.principal.apiKeyId),
			role: input.principal.primaryAppRole,
			apiPlan: input.principal.apiPlan
		};
	}

	return {
		isAuthenticated: Boolean(input.session),
		isApiKey: false,
		role: input.role ?? null,
		apiPlan: input.apiPlan ?? null
	};
}

export function resolveCatalogAccessCapabilities(
	input: CatalogAccessInput = {}
): CatalogAccessCapabilities {
	const subject = resolveSubject(input);
	const hasMemberSessionRole =
		!subject.isApiKey && subject.isAuthenticated && isMemberRole(subject.role);
	const hasPaidApiPlan = subject.isApiKey && apiPlanAtLeast(subject.apiPlan, 'member');
	const canUseMemberSearchLeverage = hasMemberSessionRole || hasPaidApiPlan;

	return {
		canViewPublicCatalog: true,
		canViewFullCatalog: hasMemberSessionRole,
		canViewWholesale: true,
		canUseBasicFilters: true,
		canUseAdvancedFilters: canUseMemberSearchLeverage,
		canUseProcessFacets: canUseMemberSearchLeverage,
		canUsePriceScoreRanges: canUseMemberSearchLeverage,
		canUseAdvancedSorts: canUseMemberSearchLeverage,
		canViewPremiumFilterMetadata: canUseMemberSearchLeverage,
		canUseSemanticSearch: canUseMemberSearchLeverage,
		canUseBeanMatching: canUseMemberSearchLeverage,
		canUseSavedSearches: canUseMemberSearchLeverage,
		canExport: canUseMemberSearchLeverage
	};
}

function hasNonEmptyParamValue(searchParams: URLSearchParams, key: string): boolean {
	return searchParams.getAll(key).some((value) => value.trim() !== '');
}

export function getRequestedProcessFacetParams(searchParams: URLSearchParams): string[] {
	return PROCESS_FACET_FILTER_KEYS.filter((key) => hasNonEmptyParamValue(searchParams, key));
}

export function getRequestedPremiumDiscoveryParams(searchParams: URLSearchParams): string[] {
	return PREMIUM_DISCOVERY_FILTER_KEYS.filter((key) => hasNonEmptyParamValue(searchParams, key));
}

export function createCatalogAccessDeniedNotice(input: {
	isAuthenticated: boolean;
	processParams?: string[];
	premiumDiscoveryParams?: string[];
	advancedSortRequested?: boolean;
}): CatalogAccessDeniedNotice | null {
	const processParams = input.processParams ?? [];
	const premiumDiscoveryParams = input.premiumDiscoveryParams ?? [];
	const advancedSortRequested = input.advancedSortRequested ?? false;
	const deniedParams = [
		...new Set([
			...processParams,
			...premiumDiscoveryParams,
			...(advancedSortRequested ? ['sort'] : [])
		])
	];

	if (deniedParams.length === 0) return null;

	let authMessage = 'Some requested catalog filters or sorts require a member account.';
	let entitlementMessage =
		'Some requested catalog filters or sorts are available to members and paid API tiers.';

	if (processParams.length > 0 && premiumDiscoveryParams.length === 0 && !advancedSortRequested) {
		authMessage = 'Structured process filters require a member account.';
		entitlementMessage = 'Structured process filters are available to members and paid API tiers.';
	} else if (
		premiumDiscoveryParams.length > 0 &&
		processParams.length === 0 &&
		!advancedSortRequested
	) {
		authMessage = 'Importer, elevation, and appearance filters require a member account.';
		entitlementMessage =
			'Importer, elevation, and appearance filters are available to members and paid API tiers.';
	} else if (
		advancedSortRequested &&
		processParams.length === 0 &&
		premiumDiscoveryParams.length === 0
	) {
		authMessage = 'This sort field requires a member account.';
		entitlementMessage = 'Advanced sort fields are available to members and paid API tiers.';
	}

	return {
		status: input.isAuthenticated ? 403 : 401,
		code: input.isAuthenticated ? 'entitlement_required' : 'auth_required',
		message: input.isAuthenticated ? entitlementMessage : authMessage,
		deniedParams
	};
}

export function createProcessFacetDeniedNotice(input: {
	isAuthenticated: boolean;
	deniedParams: string[];
}): CatalogAccessDeniedNotice | null {
	if (input.deniedParams.length === 0) return null;

	if (!input.isAuthenticated) {
		return {
			status: 401,
			code: 'auth_required',
			message: 'Structured process filters require a member account.',
			deniedParams: input.deniedParams
		};
	}

	return {
		status: 403,
		code: 'entitlement_required',
		message: 'Structured process filters are available to members and paid API tiers.',
		deniedParams: input.deniedParams
	};
}
