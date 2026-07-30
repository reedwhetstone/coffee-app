import { createParchmentPrincipalClient } from '$lib/server/parchmentClient';
import { checkRole, type UserRole } from '$lib/types/auth.types';
import type { RequestEvent } from '@sveltejs/kit';
import type { Session, User } from '@supabase/supabase-js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// App role priority — only clean app roles; pseudo-roles are gone.
const USER_ROLE_PRIORITY: UserRole[] = ['admin', 'member', 'viewer'];

export type ApiPlan = 'viewer' | 'member' | 'enterprise';

const API_PLAN_HIERARCHY: Record<ApiPlan, number> = {
	viewer: 0,
	member: 1,
	enterprise: 2
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
}

export type AuthenticatedPrincipal = SessionPrincipal | ApiKeyPrincipal;
export type RequestPrincipal = AnonymousPrincipal | AuthenticatedPrincipal;

export class PrincipalResolutionError extends Error {
	constructor(
		message: string,
		public status?: number,
		options?: ErrorOptions
	) {
		super(message, options);
		this.name = 'PrincipalResolutionError';
	}
}

function normalizeScalarUserRole(role: unknown): UserRole | null {
	if (role === 'viewer' || role === 'member' || role === 'admin') {
		return role;
	}

	return null;
}

interface CanonicalPrincipal {
	authenticated: boolean;
	authKind: 'anonymous' | 'session' | 'api-key';
	userId: string | null;
	roles: UserRole[];
	primaryRole: UserRole | null;
	apiPlan: ApiPlan | null;
	ppiAccess: boolean;
	apiScopes: string[];
}

export function getPrimaryUserRole(roles: UserRole[]): UserRole {
	for (const role of USER_ROLE_PRIORITY) {
		if (roles.includes(role)) {
			return role;
		}
	}

	return 'viewer';
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
		user: null,
		session: null
	};
}

function createSessionPrincipal(input: {
	source: SessionPrincipal['source'];
	session: Session | null;
	user: User;
	canonical: CanonicalPrincipal;
}): SessionPrincipal {
	const primaryRole = input.canonical.primaryRole ?? 'viewer';

	return {
		subjectType: 'user',
		authKind: 'session',
		source: input.source,
		isAuthenticated: true,
		userId: input.user.id,
		user: input.user,
		session: input.session,
		appRoles: input.canonical.roles.length > 0 ? input.canonical.roles : [primaryRole],
		primaryAppRole: primaryRole,
		apiPlan: input.canonical.apiPlan ?? 'viewer',
		ppiAccess: input.canonical.ppiAccess,
		apiScopes: input.canonical.apiScopes
	};
}

function createApiKeyPrincipal(input: {
	canonical: CanonicalPrincipal;
	userId: string;
}): ApiKeyPrincipal {
	const primaryRole = input.canonical.primaryRole ?? 'viewer';

	return {
		subjectType: 'api-key',
		authKind: 'api-key',
		source: 'api-key',
		isAuthenticated: true,
		userId: input.userId,
		user: null,
		session: null,
		appRoles: input.canonical.roles.length > 0 ? input.canonical.roles : [primaryRole],
		primaryAppRole: primaryRole,
		apiPlan: input.canonical.apiPlan ?? 'viewer',
		ppiAccess: input.canonical.ppiAccess,
		apiScopes: input.canonical.apiScopes
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

async function hydrateBearerUser(event: RequestEvent, token: string): Promise<User | null> {
	const {
		data: { user },
		error
	} = await event.locals.supabase.auth.getUser(token);
	return error ? null : user;
}

async function resolveCanonicalPrincipal(
	event: RequestEvent,
	token: string
): Promise<CanonicalPrincipal> {
	try {
		const client = createParchmentPrincipalClient(event, token);
		const { data, error, response } = await client.me();
		if (error || !response.ok || !data) {
			throw new PrincipalResolutionError(
				`Parchment principal resolution failed with status ${response.status}`,
				response.status
			);
		}

		const roles = data.appRoles
			.map(normalizeScalarUserRole)
			.filter((role): role is UserRole => role !== null);
		const projectedPrimaryRole = normalizeScalarUserRole(data.primaryAppRole);
		const primaryRole =
			projectedPrimaryRole && roles.includes(projectedPrimaryRole)
				? projectedPrimaryRole
				: roles.length > 0
					? getPrimaryUserRole(roles)
					: null;

		return {
			authenticated: data.authenticated,
			authKind: data.authKind,
			userId: data.userId,
			roles,
			primaryRole,
			apiPlan: data.apiPlan,
			ppiAccess: data.ppiAccess,
			apiScopes: data.apiScopes
		};
	} catch (error) {
		console.error(
			JSON.stringify({
				event: 'parchment_principal_resolution_failed',
				reason: error instanceof Error ? error.name : 'unknown',
				...(error instanceof PrincipalResolutionError && error.status
					? { status: error.status }
					: {})
			})
		);
		if (error instanceof PrincipalResolutionError) {
			throw error;
		}
		throw new PrincipalResolutionError('Parchment principal resolution failed', undefined, {
			cause: error
		});
	}
}

export async function resolvePrincipal(event: RequestEvent): Promise<RequestPrincipal> {
	if (event.locals.principal) {
		return event.locals.principal;
	}

	const authorizationHeader = event.request.headers.get('Authorization');
	if (authorizationHeader !== null) {
		const token = getBearerToken(event.request);
		if (!token) {
			event.locals.principal = createAnonymousPrincipal();
			return event.locals.principal;
		}

		const canonical = await resolveCanonicalPrincipal(event, token);
		if (!canonical.authenticated || !canonical.userId) {
			event.locals.principal = createAnonymousPrincipal();
			return event.locals.principal;
		}

		if (canonical.authKind === 'api-key') {
			event.locals.principal = createApiKeyPrincipal({
				canonical,
				userId: canonical.userId
			});
			return event.locals.principal;
		}

		if (canonical.authKind !== 'session') {
			event.locals.principal = createAnonymousPrincipal();
			return event.locals.principal;
		}

		const user = await hydrateBearerUser(event, token);
		event.locals.principal =
			user && user.id === canonical.userId
				? createSessionPrincipal({
						source: 'bearer-session',
						session: null,
						user,
						canonical
					})
				: createAnonymousPrincipal();
		return event.locals.principal;
	}

	const identity = await event.locals.safeGetIdentity();
	if (identity.session && identity.user) {
		const canonical = await resolveCanonicalPrincipal(event, identity.session.access_token);

		if (
			!canonical.authenticated ||
			canonical.authKind !== 'session' ||
			canonical.userId !== identity.user.id
		) {
			event.locals.principal = createAnonymousPrincipal();
			return event.locals.principal;
		}

		event.locals.principal = createSessionPrincipal({
			source: 'cookie-session',
			session: identity.session,
			user: identity.user,
			canonical
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
