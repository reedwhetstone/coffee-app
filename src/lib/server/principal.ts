import { createHash } from 'node:crypto';
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

export type PrincipalUser = Pick<User, 'id' | 'email'>;

export interface SessionIdentity {
	session: Session | null;
	user: User | null;
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
	user: PrincipalUser;
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
	// undefined means an older API; null means malformed and must fail closed.
	sessionIdentity?: PrincipalUser | null;
	authenticated: boolean;
	authKind: 'anonymous' | 'session' | 'api-key';
	userId: string | null;
	roles: UserRole[];
	primaryRole: UserRole | null;
	apiPlan: ApiPlan | null;
	ppiAccess: boolean;
	apiScopes: string[];
}

function readSessionIdentity(data: object): PrincipalUser | null | undefined {
	if (!('sessionIdentity' in data)) return undefined;
	const value = data.sessionIdentity;
	if (
		!value ||
		typeof value !== 'object' ||
		!('id' in value) ||
		typeof value.id !== 'string' ||
		!value.id ||
		!('email' in value) ||
		(value.email !== null && typeof value.email !== 'string')
	)
		return null;
	return { id: value.id, email: value.email ?? undefined };
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
	user: PrincipalUser;
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
			sessionIdentity: readSessionIdentity(data),
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

/**
 * How long a verified identity is reused for read requests.
 *
 * One page view is a burst of requests carrying the same credential: the page,
 * the reads it makes of this app's own `/api` routes while rendering, and the
 * data calls the browser makes as it loads. Each used to ask Parchment who the
 * caller is before doing anything else. Within this window they share one
 * answer.
 *
 * What that changes: after a session is revoked, a role is removed or an
 * account is deleted, this app may keep treating the caller as it did for up
 * to this long, on read requests only. That covers which page shell is drawn
 * and nothing else, because this app holds no data of its own: every private
 * read is made at Parchment with the caller's own credential, and Parchment
 * verifies that credential on each call.
 *
 * What it never covers: anything but GET and HEAD, and anything under `/auth`
 * (sign-in, callbacks, CLI approval). Those are verified every time. A check
 * that fails or finds no signed-in caller is never remembered, so signing in
 * takes effect at once, and it also ends reuse for that credential.
 */
const IDENTITY_REUSE_MS = 10_000;
const IDENTITY_REUSE_MAX_ENTRIES = 500;

const recentIdentity = new Map<
	string,
	{ verifiedAt: number; canonical: Promise<CanonicalPrincipal> }
>();

/** Test-only: forget every recently verified identity. */
export function resetIdentityReuse(): void {
	recentIdentity.clear();
}

function identityKey(token: string): string {
	// The credential itself is not kept as a key.
	return createHash('sha256').update(token).digest('hex');
}

function mayReuseIdentity(event: RequestEvent): boolean {
	const method = event.request.method.toUpperCase();
	if (method !== 'GET' && method !== 'HEAD') return false;
	const path = event.url.pathname;
	return path !== '/auth' && !path.startsWith('/auth/');
}

function rememberIdentity(key: string, canonical: Promise<CanonicalPrincipal>): void {
	const now = Date.now();
	if (recentIdentity.size >= IDENTITY_REUSE_MAX_ENTRIES) {
		for (const [entryKey, entry] of recentIdentity) {
			if (now - entry.verifiedAt >= IDENTITY_REUSE_MS) recentIdentity.delete(entryKey);
		}
		// Still full of live entries: drop the oldest. A Map keeps insertion order.
		for (const entryKey of recentIdentity.keys()) {
			if (recentIdentity.size < IDENTITY_REUSE_MAX_ENTRIES) break;
			recentIdentity.delete(entryKey);
		}
	}
	const entry = { verifiedAt: now, canonical };
	recentIdentity.set(key, entry);
	const forget = () => {
		if (recentIdentity.get(key) === entry) recentIdentity.delete(key);
	};
	canonical.then((result) => {
		if (!result.authenticated || !result.userId) forget();
	}, forget);
}

async function resolveRequestIdentity(
	event: RequestEvent,
	token: string
): Promise<CanonicalPrincipal> {
	const key = identityKey(token);
	if (mayReuseIdentity(event)) {
		const recent = recentIdentity.get(key);
		if (recent && Date.now() - recent.verifiedAt < IDENTITY_REUSE_MS) return recent.canonical;
	}
	// Verified now. Requests arriving while this is in flight share it, and a
	// result that is not a signed-in caller removes itself.
	const canonical = resolveCanonicalPrincipal(event, token);
	recentIdentity.delete(key);
	rememberIdentity(key, canonical);
	return canonical;
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

		const canonical = await resolveRequestIdentity(event, token);
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

		const user =
			canonical.sessionIdentity === undefined
				? await hydrateBearerUser(event, token)
				: canonical.sessionIdentity;
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

	// getSession supplies a credential, never trusted identity or entitlements.
	// Parchment verifies that credential and owns the canonical identity; see
	// resolveRequestIdentity for when a verification from the last few seconds
	// is reused.
	const {
		data: { session },
		error
	} = await event.locals.supabase.auth.getSession();
	if (session && !error) {
		const canonical = await resolveRequestIdentity(event, session.access_token);
		if (!canonical.authenticated || canonical.authKind !== 'session' || !canonical.userId) {
			event.locals.principal = createAnonymousPrincipal();
			return event.locals.principal;
		}

		let user = canonical.sessionIdentity;
		if (user === undefined) {
			// Rolling deployment compatibility only. Never use cookie user data.
			const identity = await event.locals.safeGetIdentity();
			user = identity.session?.access_token === session.access_token ? identity.user : null;
		}
		if (!user || user.id !== canonical.userId) {
			event.locals.principal = createAnonymousPrincipal();
			return event.locals.principal;
		}
		event.locals.principal = createSessionPrincipal({
			source: 'cookie-session',
			session,
			user,
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

export function isCookieSessionPrincipal(
	principal: RequestPrincipal
): principal is SessionPrincipal & { source: 'cookie-session'; session: Session } {
	return (
		isSessionPrincipal(principal) &&
		principal.source === 'cookie-session' &&
		principal.session !== null
	);
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
