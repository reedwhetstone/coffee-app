import { createHash } from 'node:crypto';
import { createParchmentPrincipalClient } from '$lib/server/parchmentClient';
import { decodeRoutePath } from '$lib/server/routePath';
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
 * to this long, on read requests only. The remembered answer is the whole
 * verified identity: user ID, email, roles, plan, Parchment Intelligence
 * access and scopes. So for that long a read request still draws the same
 * page shell and still returns that ID and email in page data. It is the
 * answer the same credential was given at its last check, and nothing newer.
 * Everything else is unaffected, because this app holds no product data of
 * its own: every private data read is made at Parchment with the caller's own
 * credential, and Parchment verifies that credential on each call.
 *
 * What it never covers: anything but GET and HEAD, and anything under `/auth`
 * (sign-in, callbacks, CLI approval), however the path is spelled. Those are
 * verified every time. An answer that does not sign the request in, or a
 * check that fails, is never remembered: signing in takes effect at once, and
 * a rejected answer ends reuse for that credential.
 *
 * A write also ends reuse, because it can change the answer: a purchase adds a
 * role, a cancelled plan removes one. Its own check ran before it took effect,
 * so that answer is not remembered and anything remembered is dropped. The
 * pages that follow are then drawn from a new check, not from the access the
 * caller had before the write. That holds for a browser session, which also
 * carries the recheck cookie below. A header-authenticated caller has no
 * cookie: a read of its own that overlaps its write can be remembered with the
 * answer from before the write, for the usual window and no longer.
 */
const IDENTITY_REUSE_MS = 10_000;
const IDENTITY_REUSE_MAX_ENTRIES = 500;

/**
 * Set on a browser session's write. Reads carrying it are verified every time.
 *
 * Dropping what this server instance remembers is not enough: another instance
 * may still hold the answer from before the write, and the read that follows
 * can land there. The cookie travels with the browser, so that read is verified
 * wherever it lands. It must outlast the reuse window, so that every answer
 * from before the write has expired by the time the cookie does.
 */
const IDENTITY_RECHECK_COOKIE = 'purveyors_identity_recheck';
const IDENTITY_RECHECK_SECONDS = IDENTITY_REUSE_MS / 1000 + 5;

interface RememberedIdentity {
	verifiedAt: number;
	canonical: Promise<CanonicalPrincipal>;
}

interface RequestIdentity {
	canonical: CanonicalPrincipal;
	/** Stop reusing this answer. Called when it does not sign the request in. */
	forget: () => void;
}

const recentIdentity = new Map<string, RememberedIdentity>();

/** Test-only: forget every recently verified identity. */
export function resetIdentityReuse(): void {
	recentIdentity.clear();
}

/** Test-only: how many identities are held, reusable or not. */
export function rememberedIdentityCount(): number {
	return recentIdentity.size;
}

/** A clock that has stepped backwards makes an answer look newer than it is; treat it as expired. */
function isFresh(entry: RememberedIdentity, now: number): boolean {
	const age = now - entry.verifiedAt;
	return age >= 0 && age < IDENTITY_REUSE_MS;
}

function identityKey(token: string): string {
	// The credential itself is not kept as a key.
	return createHash('sha256').update(token).digest('hex');
}

function isReadRequest(event: RequestEvent): boolean {
	const method = event.request.method.toUpperCase();
	return method === 'GET' || method === 'HEAD';
}

function mayReuseIdentity(event: RequestEvent): boolean {
	if (!isReadRequest(event)) return false;
	if (event.cookies.get(IDENTITY_RECHECK_COOKIE)) return false;
	// `/%61uth/cli` reaches the `/auth/cli` route, so compare the path as routed.
	const path = decodeRoutePath(event.url.pathname);
	return path !== null && path !== '/auth' && !path.startsWith('/auth/');
}

function requireRecheckAfterWrite(event: RequestEvent): void {
	if (isReadRequest(event)) return;
	event.cookies.set(IDENTITY_RECHECK_COOKIE, '1', {
		httpOnly: true,
		maxAge: IDENTITY_RECHECK_SECONDS,
		path: '/',
		sameSite: 'lax',
		secure: event.url.protocol === 'https:'
	});
}

function forgetIdentity(key: string, entry: RememberedIdentity): void {
	// A newer check for the same credential is left alone.
	if (recentIdentity.get(key) === entry) recentIdentity.delete(key);
}

function rememberIdentity(key: string, canonical: Promise<CanonicalPrincipal>): RememberedIdentity {
	const now = Date.now();
	// Re-inserting moves the credential to the newest position.
	recentIdentity.delete(key);
	// An answer that can no longer be reused is not kept around.
	for (const [entryKey, entry] of recentIdentity) {
		if (!isFresh(entry, now)) recentIdentity.delete(entryKey);
	}
	// Still full of live entries: drop the oldest. A Map keeps insertion order.
	for (const entryKey of recentIdentity.keys()) {
		if (recentIdentity.size < IDENTITY_REUSE_MAX_ENTRIES) break;
		recentIdentity.delete(entryKey);
	}
	const entry = { verifiedAt: now, canonical };
	recentIdentity.set(key, entry);
	// A failed check is dropped here; an answer that does not sign the request
	// in is dropped by resolvePrincipal, which is where that is decided.
	canonical.catch(() => forgetIdentity(key, entry));
	return entry;
}

async function resolveRequestIdentity(
	event: RequestEvent,
	token: string
): Promise<RequestIdentity> {
	const key = identityKey(token);
	if (!mayReuseIdentity(event)) {
		// Verified now, and not remembered: see IDENTITY_REUSE_MS on writes.
		const forget = () => void recentIdentity.delete(key);
		forget();
		return { canonical: await resolveCanonicalPrincipal(event, token), forget };
	}

	const recent = recentIdentity.get(key);
	// Reused while recent; otherwise verified now. Requests arriving while that
	// is in flight share it.
	const entry =
		recent && isFresh(recent, Date.now())
			? recent
			: rememberIdentity(key, resolveCanonicalPrincipal(event, token));
	return { canonical: await entry.canonical, forget: () => forgetIdentity(key, entry) };
}

export async function resolvePrincipal(event: RequestEvent): Promise<RequestPrincipal> {
	if (event.locals.principal) {
		return event.locals.principal;
	}

	// Every way a verified answer can fail to sign the request in ends here, so
	// none of them is reused by the next request.
	const rejectIdentity = (identity: RequestIdentity): AnonymousPrincipal => {
		identity.forget();
		const anonymous = createAnonymousPrincipal();
		event.locals.principal = anonymous;
		return anonymous;
	};

	const authorizationHeader = event.request.headers.get('Authorization');
	if (authorizationHeader !== null) {
		const token = getBearerToken(event.request);
		if (!token) {
			event.locals.principal = createAnonymousPrincipal();
			return event.locals.principal;
		}

		const verified = await resolveRequestIdentity(event, token);
		const { canonical } = verified;
		if (!canonical.authenticated || !canonical.userId) {
			return rejectIdentity(verified);
		}

		if (canonical.authKind === 'api-key') {
			event.locals.principal = createApiKeyPrincipal({
				canonical,
				userId: canonical.userId
			});
			return event.locals.principal;
		}

		if (canonical.authKind !== 'session') {
			return rejectIdentity(verified);
		}

		const user =
			canonical.sessionIdentity === undefined
				? await hydrateBearerUser(event, token)
				: canonical.sessionIdentity;
		if (!user || user.id !== canonical.userId) {
			return rejectIdentity(verified);
		}
		event.locals.principal = createSessionPrincipal({
			source: 'bearer-session',
			session: null,
			user,
			canonical
		});
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
	// A cookie is caller-supplied, so its token may be anything; only text is a credential.
	if (session && !error && typeof session.access_token === 'string' && session.access_token) {
		const verified = await resolveRequestIdentity(event, session.access_token);
		const { canonical } = verified;
		if (!canonical.authenticated || canonical.authKind !== 'session' || !canonical.userId) {
			return rejectIdentity(verified);
		}

		let user = canonical.sessionIdentity;
		if (user === undefined) {
			// Rolling deployment compatibility only. Never use cookie user data.
			const identity = await event.locals.safeGetIdentity();
			user = identity.session?.access_token === session.access_token ? identity.user : null;
		}
		if (!user || user.id !== canonical.userId) {
			return rejectIdentity(verified);
		}
		requireRecheckAfterWrite(event);
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
