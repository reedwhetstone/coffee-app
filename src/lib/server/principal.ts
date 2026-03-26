import { API_KEY_PREFIX, getUserApiTier, validateApiKey, type ApiPlan } from '$lib/server/apiAuth';
import { createAdminClient } from '$lib/supabase-admin';
import { createClient } from '$lib/supabase';
import { checkRole, type UserRole } from '$lib/types/auth.types';
import type { Database, Json } from '$lib/types/database.types';
import type { RequestEvent } from '@sveltejs/kit';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

const bearerSupabase = createClient();
const adminSupabase = createAdminClient() as SupabaseClient<Database>;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const USER_ROLE_PRIORITY: UserRole[] = [
	'admin',
	'member',
	'api-enterprise',
	'api-member',
	'ppi-member',
	'viewer'
];
const API_PLAN_HIERARCHY: Record<ApiPlan, number> = {
	viewer: 0,
	'api-member': 1,
	'api-enterprise': 2
};
const DEFAULT_API_SCOPES_BY_PLAN: Record<ApiPlan, string[]> = {
	viewer: ['catalog:read'],
	'api-member': ['catalog:read'],
	'api-enterprise': ['catalog:read']
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

function normalizeRoleValue(role: string): UserRole | null {
	if (role === 'api') return 'api-member';
	if (role === 'api_viewer') return 'viewer';
	if (role === 'api_member') return 'api-member';
	if (role === 'api_enterprise') return 'api-enterprise';
	if (role === 'viewer') return 'viewer';
	if (role === 'member') return 'member';
	if (role === 'api-member') return 'api-member';
	if (role === 'api-enterprise') return 'api-enterprise';
	if (role === 'ppi-member') return 'ppi-member';
	if (role === 'admin') return 'admin';
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

async function getStrictUserRoles(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<UserRole[] | null> {
	const { data, error } = await supabase
		.from('user_roles')
		.select('user_role')
		.eq('id', userId)
		.single();

	if (error || !data) {
		return null;
	}

	return normalizeResolvedUserRoles(data.user_role);
}

export async function getUserRoles(
	supabase: SupabaseClient<Database>,
	userId: string
): Promise<UserRole[]> {
	return (await getStrictUserRoles(supabase, userId)) ?? ['viewer'];
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
	roles: UserRole[];
}): SessionPrincipal {
	const roles = normalizeUserRoles(input.roles);
	const apiPlan = getUserApiTier(roles);

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
	roles: UserRole[];
}): ApiKeyPrincipal {
	const roles = normalizeUserRoles(input.roles);
	const apiPlan = getUserApiTier(roles);

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

	const roles = await getUserRoles(adminSupabase, user.id);
	return createSessionPrincipal({
		source: 'bearer-session',
		session: null,
		user,
		roles
	});
}

async function resolveApiKeyPrincipal(apiKey: string): Promise<ApiKeyPrincipal | null> {
	const validation = await validateApiKey(apiKey);

	if (!validation.valid || !validation.userId || !validation.keyId) {
		return null;
	}

	const roles = await getStrictUserRoles(adminSupabase, validation.userId);
	if (!roles) {
		return null;
	}

	return createApiKeyPrincipal({
		userId: validation.userId,
		apiKeyId: validation.keyId,
		apiKeyName: validation.keyName,
		apiKeyPermissions: validation.permissions,
		roles
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
		event.locals.principal = createSessionPrincipal({
			source: 'cookie-session',
			session: sessionContext.session,
			user: sessionContext.user,
			roles: sessionContext.roles
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
