import {
	API_KEY_PREFIX,
	deriveApiPlanFromRoles,
	validateApiKey,
	type ApiPlan
} from '$lib/server/apiAuth';
import { createAdminClient } from '$lib/supabase-admin';
import { createClient } from '$lib/supabase';
import { checkRole, type UserRole } from '$lib/types/auth.types';
import type { Database, Json } from '$lib/types/database.types';
import type { RequestEvent } from '@sveltejs/kit';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

const bearerSupabase = createClient();
const adminSupabase = createAdminClient() as SupabaseClient<Database>;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// App role priority — only clean app roles; pseudo-roles are gone.
const USER_ROLE_PRIORITY: UserRole[] = ['admin', 'member', 'viewer'];

const API_PLAN_HIERARCHY: Record<ApiPlan, number> = {
	viewer: 0,
	member: 1,
	enterprise: 2
};

const DEFAULT_API_SCOPES_BY_PLAN: Record<ApiPlan, string[]> = {
	viewer: ['catalog:read'],
	member: ['catalog:read'],
	enterprise: ['catalog:read']
};

export interface SessionContext {
	session: Session | null;
	user: User | null;
	role: UserRole;
	roles: UserRole[];
}

interface PrincipalBase {
	subjectType: 'anonymous' | 'user' | 'api-key';
	authKind: 'anonymous' | 'session' | 'api-key';
	source: 'none' | 'cookie-session' | 'bearer-session' | 'api-key';
	isAuthenticated: boolean;
	userId: string | null;
	appRoles: UserRole[];
	primaryAppRole: UserRole | null;
	apiPlan: ApiPlan | null;
	ppiAccess: boolean;
	apiScopes: string[];
	apiKeyId: string | null;
	apiKeyName: string | null;
	apiKeyPermissions: Json | null;
}

export interface AnonymousPrincipal extends PrincipalBase {
	subjectType: 'anonymous';
	authKind: 'anonymous';
	source: 'none';
	isAuthenticated: false;
	userId: null;
	appRoles: [];
	primaryAppRole: null;
	apiPlan: null;
	ppiAccess: false;
	apiScopes: [];
	apiKeyId: null;
	apiKeyName: null;
	apiKeyPermissions: null;
	user: null;
	session: null;
}

export interface SessionPrincipal extends PrincipalBase {
	subjectType: 'user';
	authKind: 'session';
	source: 'cookie-session' | 'bearer-session';
	isAuthenticated: true;
	userId: string;
	user: User;
	session: Session | null;
	appRoles: UserRole[];
	primaryAppRole: UserRole;
	apiPlan: ApiPlan;
	ppiAccess: boolean;
	apiScopes: string[];
	apiKeyId: null;
	apiKeyName: null;
	apiKeyPermissions: null;
}

export interface ApiKeyPrincipal extends PrincipalBase {
	subjectType: 'api-key';
	authKind: 'api-key';
	source: 'api-key';
	isAuthenticated: true;
	userId: string;
	user: null;
	session: null;
	appRoles: UserRole[];
	primaryAppRole: UserRole;
	apiPlan: ApiPlan;
	ppiAccess: boolean;
	apiScopes: string[];
	apiKeyId: string;
	apiKeyName: string | null;
	apiKeyPermissions: Json | null;
}

export type AuthenticatedPrincipal = SessionPrincipal | ApiKeyPrincipal;
export type RequestPrincipal = AnonymousPrincipal | AuthenticatedPrincipal;

function uniqueStrings(values: string[]): string[] {
	return Array.from(new Set(values.filter(Boolean)));
}

function normalizeScopeValue(value: unknown): string[] {
	if (typeof value === 'string') {
		return value
			.split(/[\s,]+/)
			.map((scope) => scope.trim())
			.filter(Boolean);
	}

	if (!Array.isArray(value)) {
		return [];
	}

	return value.filter((scope): scope is string => typeof scope === 'string' && scope.length > 0);
}

/**
 * Normalize a raw role string to a clean UserRole.
 * Pseudo-roles (api-member, api-enterprise, ppi-member) are dropped here —
 * they are handled via explicit entitlement fields (apiPlan, ppiAccess) instead.
 */
function normalizeRoleValue(role: string): UserRole | null {
	if (role === 'viewer' || role === 'api_viewer') return 'viewer';
	if (role === 'member') return 'member';
	if (role === 'admin') return 'admin';
	// Pseudo-roles: intentionally not mapped to a UserRole.
	// They are consumed by deriveApiPlanFromRoles / ppiAccess derivation instead.
	return null;
}

function normalizeResolvedUserRoles(rawRoles: unknown): UserRole[] | null {
	if (!Array.isArray(rawRoles)) {
		return null;
	}

	const normalized = rawRoles
		.filter((role): role is string => typeof role === 'string')
		.map(normalizeRoleValue)
		.filter((role): role is UserRole => role !== null);

	return normalized.length > 0 ? Array.from(new Set(normalized)) : null;
}

export function normalizeUserRoles(rawRoles: unknown): UserRole[] {
	return normalizeResolvedUserRoles(rawRoles) ?? ['viewer'];
}

interface UserEntitlements {
	roles: UserRole[];
	apiPlan: ApiPlan;
	ppiAccess: boolean;
}

/**
 * Derive ppiAccess from the raw user_role array (legacy: ppi-member pseudo-role).
 * Used during backfill transition when ppi_access column is not yet present.
 */
function derivePpiAccessFromRoles(rawRoles: string[]): boolean {
	return rawRoles.includes('ppi-member');
}

/**
 * Derive ApiPlan from the explicit api_plan column, falling back to role-based derivation.
 */
function resolveApiPlan(explicitPlan: string | null | undefined, rawRoles: string[]): ApiPlan {
	if (explicitPlan === 'viewer' || explicitPlan === 'member' || explicitPlan === 'enterprise') {
		return explicitPlan;
	}
	// Admin users always get enterprise API access
	if (rawRoles.includes('admin')) {
		return 'enterprise';
	}
	return deriveApiPlanFromRoles(rawRoles);
}

async function getUserEntitlements(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<UserEntitlements | null> {
	// Primary query: select the base role array plus the new entitlement columns.
	// The new columns (api_plan, ppi_access) are nullable; we fall back to role-derived
	// values when they are null (pre-migration) or when the query itself fails (pre-schema).
	const { data, error } = await supabase
		.from('user_roles')
		.select('user_role, api_plan, ppi_access')
		.eq('id', userId)
		.single();

	if (error) {
		// If the query failed because the new columns don't exist yet (pre-schema-migration),
		// fall back to the safe user_role-only query.
		// PostgreSQL error 42703 = undefined_column; Supabase wraps this in the error object.
		const isColumnMissingError =
			error.code === '42703' ||
			error.code === 'PGRST200' ||
			error.message?.includes('does not exist') ||
			error.message?.includes('api_plan') ||
			error.message?.includes('ppi_access');
		if (isColumnMissingError) {
			const { data: fallbackData, error: fallbackError } = await supabase
				.from('user_roles')
				.select('user_role')
				.eq('id', userId)
				.single();

			if (fallbackError || !fallbackData) {
				return null;
			}

			const rawRoles: string[] = Array.isArray(fallbackData.user_role)
				? fallbackData.user_role.filter((r): r is string => typeof r === 'string')
				: [];
			const roles = normalizeResolvedUserRoles(rawRoles) ?? ['viewer'];
			return {
				roles,
				apiPlan: resolveApiPlan(null, rawRoles),
				ppiAccess: derivePpiAccessFromRoles(rawRoles)
			};
		}
		// Other errors (no row found, network error, etc.) — fail closed
		return null;
	}

	if (!data) {
		return null;
	}

	const rawRoles: string[] = Array.isArray(data.user_role)
		? data.user_role.filter((r): r is string => typeof r === 'string')
		: [];

	const roles = normalizeResolvedUserRoles(rawRoles) ?? ['viewer'];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const row = data as any;
	const apiPlan = resolveApiPlan(row.api_plan, rawRoles);
	const ppiAccess: boolean =
		typeof row.ppi_access === 'boolean' ? row.ppi_access : derivePpiAccessFromRoles(rawRoles);

	return { roles, apiPlan, ppiAccess };
}

export async function getUserRoles(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<UserRole[]> {
	const entitlements = await getUserEntitlements(supabase, userId);
	return entitlements?.roles ?? ['viewer'];
}

export function getPrimaryUserRole(roles: UserRole[]): UserRole {
	for (const role of USER_ROLE_PRIORITY) {
		if (roles.includes(role)) {
			return role;
		}
	}

	return 'viewer';
}

export function normalizeApiScopes(permissions: Json | null | undefined): string[] {
	if (!permissions || Array.isArray(permissions) || typeof permissions !== 'object') {
		return normalizeScopeValue(permissions);
	}

	const record = permissions as Record<string, Json | undefined>;
	return uniqueStrings([
		...normalizeScopeValue(record.scope),
		...normalizeScopeValue(record.scopes)
	]);
}

function mergeApiScopes(plan: ApiPlan, permissions: Json | null | undefined): string[] {
	return uniqueStrings([...DEFAULT_API_SCOPES_BY_PLAN[plan], ...normalizeApiScopes(permissions)]);
}

function createAnonymousPrincipal(): AnonymousPrincipal {
	return {
		subjectType: 'anonymous',
		authKind: 'anonymous',
		source: 'none',
		isAuthenticated: false,
		userId: null,
		appRoles: [],
		primaryAppRole: null,
		apiPlan: null,
		ppiAccess: false,
		apiScopes: [],
		apiKeyId: null,
		apiKeyName: null,
		apiKeyPermissions: null,
		user: null,
		session: null
	};
}

function createSessionPrincipal(input: {
	source: SessionPrincipal['source'];
	session: Session | null;
	user: User;
	entitlements: UserEntitlements;
}): SessionPrincipal {
	const { roles, apiPlan, ppiAccess } = input.entitlements;

	return {
		subjectType: 'user',
		authKind: 'session',
		source: input.source,
		isAuthenticated: true,
		userId: input.user.id,
		user: input.user,
		session: input.session,
		appRoles: roles,
		primaryAppRole: getPrimaryUserRole(roles),
		apiPlan,
		ppiAccess,
		apiScopes: mergeApiScopes(apiPlan, null),
		apiKeyId: null,
		apiKeyName: null,
		apiKeyPermissions: null
	};
}

function createApiKeyPrincipal(input: {
	userId: string;
	apiKeyId: string;
	apiKeyName?: string;
	apiKeyPermissions?: Json | null;
	entitlements: UserEntitlements;
}): ApiKeyPrincipal {
	const { roles, apiPlan, ppiAccess } = input.entitlements;

	return {
		subjectType: 'api-key',
		authKind: 'api-key',
		source: 'api-key',
		isAuthenticated: true,
		userId: input.userId,
		user: null,
		session: null,
		appRoles: roles,
		primaryAppRole: getPrimaryUserRole(roles),
		apiPlan,
		ppiAccess,
		apiScopes: mergeApiScopes(apiPlan, input.apiKeyPermissions),
		apiKeyId: input.apiKeyId,
		apiKeyName: input.apiKeyName ?? null,
		apiKeyPermissions: input.apiKeyPermissions ?? null
	};
}

export function getLegacyAuthState(principal: RequestPrincipal): SessionContext {
	if (isSessionPrincipal(principal)) {
		return {
			session: principal.session,
			user: principal.user,
			role: principal.primaryAppRole,
			roles: principal.appRoles
		};
	}

	if (isApiKeyPrincipal(principal)) {
		return {
			session: null,
			user: null,
			role: principal.primaryAppRole,
			roles: principal.appRoles
		};
	}

	return {
		session: null,
		user: null,
		role: 'viewer',
		roles: ['viewer']
	};
}

function getBearerToken(request: Request): string | null {
	const authHeader = request.headers.get('Authorization');

	if (!authHeader?.startsWith('Bearer ')) {
		return null;
	}

	const token = authHeader.slice('Bearer '.length).trim();
	return token.length > 0 ? token : null;
}

async function resolveBearerSessionPrincipal(token: string): Promise<SessionPrincipal | null> {
	const {
		data: { user },
		error
	} = await bearerSupabase.auth.getUser(token);

	if (error || !user) {
		return null;
	}

	const entitlements = await getUserEntitlements(adminSupabase, user.id);
	if (!entitlements) {
		return null;
	}

	return createSessionPrincipal({
		source: 'bearer-session',
		session: null,
		user,
		entitlements
	});
}

async function resolveApiKeyPrincipal(apiKey: string): Promise<ApiKeyPrincipal | null> {
	if (!apiKey.startsWith(API_KEY_PREFIX)) {
		return null;
	}

	const validation = await validateApiKey(apiKey);

	if (!validation.valid || !validation.userId || !validation.keyId) {
		return null;
	}

	const entitlements = await getUserEntitlements(adminSupabase, validation.userId);
	if (!entitlements) {
		return null;
	}

	return createApiKeyPrincipal({
		userId: validation.userId,
		apiKeyId: validation.keyId,
		apiKeyName: validation.keyName,
		apiKeyPermissions: validation.permissions,
		entitlements
	});
}

export async function resolvePrincipal(event: RequestEvent): Promise<RequestPrincipal> {
	if (event.locals.principal) {
		return event.locals.principal;
	}

	const authorizationHeader = event.request.headers.get('Authorization');
	if (authorizationHeader !== null) {
		const bearerToken = getBearerToken(event.request);
		if (!bearerToken) {
			event.locals.principal = createAnonymousPrincipal();
			return event.locals.principal;
		}

		const bearerPrincipal = bearerToken.startsWith(API_KEY_PREFIX)
			? await resolveApiKeyPrincipal(bearerToken)
			: await resolveBearerSessionPrincipal(bearerToken);

		event.locals.principal = bearerPrincipal ?? createAnonymousPrincipal();
		return event.locals.principal;
	}

	const sessionContext = await event.locals.safeGetSession();
	if (sessionContext.session && sessionContext.user) {
		// For cookie sessions, derive entitlements from the session context roles
		// (already fetched in the session middleware) plus explicit columns.
		const rawRoles: string[] = Array.isArray(sessionContext.roles)
			? (sessionContext.roles as string[])
			: ['viewer'];

		const normalizedRoles = normalizeResolvedUserRoles(rawRoles) ?? ['viewer'];
		const apiPlan = resolveApiPlan(null, rawRoles);
		const ppiAccess = derivePpiAccessFromRoles(rawRoles);

		// Attempt to fetch explicit entitlements for the full picture
		const explicitEntitlements = await getUserEntitlements(adminSupabase, sessionContext.user.id);
		const entitlements: UserEntitlements = explicitEntitlements ?? {
			roles: normalizedRoles,
			apiPlan,
			ppiAccess
		};

		event.locals.principal = createSessionPrincipal({
			source: 'cookie-session',
			session: sessionContext.session,
			user: sessionContext.user,
			entitlements
		});
		return event.locals.principal;
	}

	event.locals.principal = createAnonymousPrincipal();
	return event.locals.principal;
}

export function isAuthenticatedPrincipal(
	principal: RequestPrincipal
): principal is AuthenticatedPrincipal {
	return principal.isAuthenticated;
}

export function isSessionPrincipal(principal: RequestPrincipal): principal is SessionPrincipal {
	return principal.authKind === 'session';
}

export function isApiKeyPrincipal(principal: RequestPrincipal): principal is ApiKeyPrincipal {
	return principal.authKind === 'api-key';
}

export function principalHasRole(principal: RequestPrincipal, requiredRole: UserRole): boolean {
	if (!isAuthenticatedPrincipal(principal)) {
		return false;
	}

	return checkRole(principal.appRoles, requiredRole);
}

export function principalHasApiPlan(principal: RequestPrincipal, requiredPlan: ApiPlan): boolean {
	if (!principal.apiPlan) {
		return false;
	}

	return API_PLAN_HIERARCHY[principal.apiPlan] >= API_PLAN_HIERARCHY[requiredPlan];
}

function scopeMatches(grantedScope: string, requiredScope: string): boolean {
	if (grantedScope === '*' || grantedScope === requiredScope) {
		return true;
	}

	if (!grantedScope.endsWith('*')) {
		return false;
	}

	const prefix = grantedScope.slice(0, -1);
	return requiredScope.startsWith(prefix);
}

export function principalHasScope(principal: RequestPrincipal, requiredScope: string): boolean {
	return principal.apiScopes.some((grantedScope) => scopeMatches(grantedScope, requiredScope));
}

export function requiresSessionOriginCheck(principal: RequestPrincipal, request: Request): boolean {
	return isSessionPrincipal(principal) && !SAFE_METHODS.has(request.method.toUpperCase());
}

export function requestHasTrustedOrigin(event: RequestEvent): boolean {
	const origin = event.request.headers.get('origin');
	if (!origin) {
		return true;
	}

	return origin === event.url.origin;
}

export function isTrustedMutationRequest(
	event: RequestEvent,
	principal: RequestPrincipal
): boolean {
	if (!requiresSessionOriginCheck(principal, event.request)) {
		return true;
	}

	return requestHasTrustedOrigin(event);
}
