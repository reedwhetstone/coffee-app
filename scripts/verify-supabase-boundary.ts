/**
 * Supabase boundary guard (PR 01 of the shared-data boundary retirement program).
 *
 * Scans coffee-app runtime and operational source for Supabase-shaped access
 * candidates and compares every candidate against the checked-in manifest at
 * config/supabase-boundary-manifest.json.
 *
 * Detection model: conservative, syntax-first, fail-closed. The scanner does
 * NOT try to prove that a receiver is a Supabase client (positive provenance
 * inference under-detects and fails silently open). Instead, every expression
 * that is *shaped* like Supabase access is a candidate, and every candidate
 * must be either classified in the manifest or explicitly suppressed as
 * non-Supabase. A missed classification is therefore a loud lint failure, not
 * a silent gap in the retirement ledger.
 *
 * Candidate kinds:
 * - "table": any `X.from(...)` call, regardless of receiver. String-literal
 *   names are recorded; nonliteral names record `<dynamic>`. Calls whose
 *   receiver is a well-known JavaScript/Node builtin (`Array.from`,
 *   `Buffer.from`, `Readable.from`, ...) are skipped by an exact-name builtin
 *   list; that list may only ever contain platform builtins.
 * - "rpc": any `X.rpc(...)` call, regardless of receiver.
 * - "auth-session": any call whose callee member chain contains an `auth`
 *   segment (`supabase.auth.getUser(...)`, `auth.resend(...)`,
 *   `createAdminClient().auth.admin.deleteUser(...)`, `db.auth.signOut()`),
 *   plus any bare (non-call) `.auth` member access such as
 *   `const session = supabase.auth`, recorded as `<memberAccess>`, so renamed
 *   auth aliases still leave a classifiable footprint at the alias site.
 * - "service": any call whose callee member chain contains a `functions`,
 *   `realtime`, or `storage` segment (`supabase.functions.invoke(...)`,
 *   `supabase.storage.from('bucket').upload(...)` also records its `.from`
 *   as a table candidate), plus any `.channel(...)` call. Keeps edge
 *   functions, storage, and realtime on the ledger instead of invisible.
 * - "admin-client": any runtime import of a `supabase-admin` module or any
 *   reference, declaration, or call of `createAdminClient`.
 * - "client-factory": any runtime import, require, or dynamic import of a
 *   Supabase package; any runtime re-export (named or star) from a Supabase
 *   package or a supabase-named local module; and any call of a known factory
 *   name (`createClient`, `createServerClient`, `createBrowserClient`,
 *   `createSupabaseLoadClient`), regardless of where it was imported from.
 * - "markup": any of the above operation shapes appearing inside Svelte
 *   template markup. Markup access is banned: it must move into a script
 *   block (or be explicitly suppressed if it is genuinely not Supabase).
 *
 * Svelte files are parsed with svelte/compiler; script blocks feed the
 * TypeScript scanner and unparseable files fail closed by throwing.
 *
 * Enforcement:
 * - Every candidate must match exactly one manifest record: a classified
 *   entry (`entries`) or a suppression (`suppressions`, with a reason
 *   asserting the call is not Supabase access).
 * - Every entry and every suppression must still match a live candidate;
 *   stale records fail.
 * - Retained classifications are constrained: auth-session may cover only
 *   OAuth/session lifecycle methods, workspace-memory only the named chat
 *   persistence tables, and billing only the named billing tables plus
 *   admin-client custody in billing code. Product-principal construction,
 *   role lookup, and entitlement resolution (user_roles, api_keys, api_usage,
 *   and admin-client JWT validation) can never be classified as retained.
 * - Admin-client custody invariant: retained `auth.getUser` access is limited
 *   to the explicit browser-session boundary files. Helper consumers can receive
 *   an externally supplied client, so their auth access must remain shared-data
 *   debt even when the admin client was created in another module. Local
 *   admin-client files also may not retain auth-session access. These checks are
 *   enforced on file identity, not call-chain tracing, so aliasing cannot launder
 *   admin JWT validation into a retained classification.
 * - Dynamic table/RPC names can never be classified (fail closed); they can
 *   only be suppressed as non-Supabase.
 *
 * Scope contract: candidates are defined by conventional Supabase shapes.
 * Because detection is receiver-independent, missing a real Supabase call
 * requires deliberately obfuscated code: renaming every Supabase-shaped
 * segment out of the chain, shadowing a platform-builtin name with a client
 * (the builtin `.from` skip is exact-name and does not scope-check), or
 * computing method names from strings. Such code cannot pass PR review while
 * looking routine, and PR review owns that residue. Suppressions are the
 * reviewed escape hatch for non-Supabase code that shares these shapes.
 *
 * Exit codes: 0 on pass, 1 on any failure.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseSvelte } from 'svelte/compiler';
import ts from 'typescript';

export type AccessKind =
	| 'table'
	| 'rpc'
	| 'admin-client'
	| 'client-factory'
	| 'auth-session'
	| 'service'
	| 'markup';

export interface Access {
	file: string;
	kind: AccessKind;
	name: string;
}

export type RetainedOwner = 'auth-session' | 'workspace-memory' | 'billing';

export interface ManifestEntry {
	file: string;
	kind: AccessKind;
	name: string;
	classification: 'retained-web-local' | 'shared-data-debt';
	owner?: RetainedOwner;
	plannedRemovalPr?: string;
	disposition: string;
	note?: string;
}

export interface Suppression {
	file: string;
	kind: AccessKind;
	name: string;
	reason: string;
}

export interface Manifest {
	description?: string;
	entries: ManifestEntry[];
	suppressions?: Suppression[];
}

const SCANNED_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs', '.svelte'];
const SCANNED_ROOTS = ['src', 'scripts'];

const EXCLUDED_FILE_PATTERNS = [/\.test\.(ts|js|mjs|cjs)$/, /\.spec\.(ts|js|mjs|cjs)$/];

const EXCLUDED_PATH_SEGMENTS = ['__fixtures__', '__mocks__', '__tests__'];

const EXCLUDED_FILES = new Set(['src/test-setup.ts']);

/**
 * Identifier receivers whose `.from(...)` is a platform builtin, never a
 * Supabase table read. This list may only ever contain JavaScript/Node
 * builtins; project code that shares the `.from` shape must use a manifest
 * suppression instead.
 */
const BUILTIN_FROM_RECEIVERS = new Set([
	'Array',
	'ArrayBuffer',
	'BigInt64Array',
	'BigUint64Array',
	'Buffer',
	'Duplex',
	'Float32Array',
	'Float64Array',
	'Int8Array',
	'Int16Array',
	'Int32Array',
	'Object',
	'Readable',
	'ReadableStream',
	'Transform',
	'Uint8Array',
	'Uint8ClampedArray',
	'Uint16Array',
	'Uint32Array',
	'Writable'
]);

/**
 * Retained auth-session entries may cover only OAuth/session lifecycle. JWT
 * validation for product-principal construction is not retainable and must be
 * classified as shared-data-debt in the manifest.
 */
const RETAINED_AUTH_SESSION_METHODS = new Set([
	'exchangeCodeForSession',
	'getSession',
	'getUser',
	'onAuthStateChange',
	'refreshSession',
	'setSession',
	'signInWithOAuth',
	'signInWithPassword',
	'signOut',
	'signUp',
	// Bare (non-call) session-client auth access, e.g. `const s = supabase.auth`.
	'<memberAccess>'
]);

/**
 * These are the only files allowed to retain `auth.getUser`. Any other caller
 * may receive a client from another module, including a service-role client,
 * so its JWT validation remains shared-data debt until the private API cutover.
 */
const RETAINED_AUTH_GET_USER_FILES = new Set([
	'src/hooks.server.ts',
	'src/routes/auth/callback/+server.ts'
]);

const RETAINED_WORKSPACE_TABLES = new Set(['user_memory', 'workspace_messages', 'workspaces']);

const RETAINED_BILLING_TABLES = new Set([
	'billing_subscriptions',
	'role_audit_logs',
	'stripe_customers',
	'stripe_session_processing'
]);

/** Product-authorization data that can never be classified as retained. */
const NEVER_RETAINED_NAMES = new Set(['api_keys', 'api_usage', 'user_roles']);

/**
 * Files that implement product-principal construction, JWT validation for
 * product authorization, or entitlement resolution. Nothing in these files may
 * ever be reclassified as retained-web-local, regardless of kind or name.
 */
const NEVER_RETAINED_FILES = new Set(['src/lib/server/principal.ts', 'src/lib/server/apiAuth.ts']);

/**
 * The only files allowed to hold a retained-web-local admin-client entry.
 * Billing credential custody lives here; any other admin-client caller is
 * product-authorization debt and must stay on the shared-data-debt ledger.
 */
const RETAINED_ADMIN_CLIENT_FILES = new Set([
	'src/lib/supabase-admin.ts',
	'src/lib/server/billing/reconcile-session.ts',
	'src/lib/services/stripe.ts',
	'src/lib/services/stripe-webhook.ts',
	'src/routes/api/admin/billing-entitlement-discrepancies/+server.ts'
]);

const RETAINED_CLIENT_FACTORY_FILES = new Set([
	'src/hooks.server.ts',
	'src/lib/supabase-admin.ts',
	'src/lib/supabase.ts',
	'src/routes/+layout.ts'
]);

const VALID_KINDS = new Set<string>([
	'table',
	'rpc',
	'admin-client',
	'client-factory',
	'auth-session',
	'service',
	'markup'
]);

/** Member-chain segments that mark a call as a Supabase service operation. */
const SERVICE_SEGMENTS = new Set(['functions', 'realtime', 'storage']);

const VALID_REMOVAL_PRS = /^PR-(0[3-9]|10)$/;

const SUPABASE_PACKAGES = new Set(['@supabase/ssr', '@supabase/supabase-js']);

/** Factory names whose calls are always client-factory candidates. */
const FACTORY_CALL_NAMES = new Set([
	'createBrowserClient',
	'createClient',
	'createServerClient',
	'createSupabaseLoadClient'
]);

const DYNAMIC_ACCESS_NAME = '<dynamic>';

export function isRuntimeFile(relPath: string): boolean {
	const normalized = relPath.split('\\').join('/');
	if (!SCANNED_EXTENSIONS.some((ext) => normalized.endsWith(ext))) {
		return false;
	}
	if (EXCLUDED_FILES.has(normalized)) {
		return false;
	}
	if (EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(normalized))) {
		return false;
	}
	const segments = normalized.split('/');
	if (segments.some((segment) => EXCLUDED_PATH_SEGMENTS.includes(segment))) {
		return false;
	}
	return true;
}

function scriptKind(file: string): ts.ScriptKind {
	return /\.(?:js|mjs|cjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}

function isSupabaseModule(moduleName: string): boolean {
	return SUPABASE_PACKAGES.has(moduleName) || /supabase/i.test(moduleName);
}

function isAdminModule(moduleName: string): boolean {
	return /supabase-admin/i.test(moduleName);
}

function memberName(expression: ts.Expression): string | undefined {
	if (ts.isPropertyAccessExpression(expression)) {
		return expression.name.text;
	}
	if (
		ts.isElementAccessExpression(expression) &&
		expression.argumentExpression &&
		ts.isStringLiteralLike(expression.argumentExpression)
	) {
		return expression.argumentExpression.text;
	}
	return undefined;
}

function memberReceiver(expression: ts.Expression): ts.Expression | undefined {
	if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
		return expression.expression;
	}
	return undefined;
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
	let current = expression;
	while (
		ts.isAsExpression(current) ||
		ts.isTypeAssertionExpression(current) ||
		ts.isNonNullExpression(current) ||
		ts.isSatisfiesExpression(current) ||
		ts.isParenthesizedExpression(current)
	) {
		current = current.expression;
	}
	return current;
}

/**
 * Returns the member-name segments of a callee chain, unwrapping casts,
 * non-null assertions, parentheses, and intermediate calls. For
 * `createAdminClient().auth.admin.deleteUser` this returns
 * ['createAdminClient', 'auth', 'admin', 'deleteUser'].
 */
function calleeChainSegments(expression: ts.Expression): string[] {
	const segments: string[] = [];
	let current: ts.Expression | undefined = unwrapExpression(expression);

	while (current) {
		if (ts.isIdentifier(current)) {
			segments.unshift(current.text);
			break;
		}
		if (ts.isCallExpression(current)) {
			current = unwrapExpression(current.expression);
			continue;
		}
		const name = memberName(current);
		if (name !== undefined) {
			segments.unshift(name);
		}
		const receiver = memberReceiver(current);
		current = receiver ? unwrapExpression(receiver) : undefined;
	}

	return segments;
}

function literalResource(call: ts.CallExpression): string {
	const argument = call.arguments[0];
	return argument && ts.isStringLiteralLike(argument) ? argument.text : DYNAMIC_ACCESS_NAME;
}

interface SourceUnits {
	/** Script sources to run through the TypeScript scanner. */
	units: string[];
	/** Supabase-shaped expressions found in Svelte template markup. */
	markupAccesses: Access[];
}

interface SvelteScriptBlock {
	content?: { start?: number; end?: number };
}

/**
 * Parses a Svelte file with svelte/compiler and returns script-block sources
 * plus Supabase-shaped candidates found in template markup. Markup candidates
 * are receiver-independent (the same fail-closed model as script scanning), so
 * script-side aliasing cannot hide a template call. Unparseable Svelte files
 * fail closed by throwing.
 */
function sourceUnits(source: string, file: string): SourceUnits {
	if (!file.endsWith('.svelte')) {
		return { units: [source], markupAccesses: [] };
	}

	let ast: { instance?: SvelteScriptBlock; module?: SvelteScriptBlock; fragment?: unknown };
	try {
		ast = parseSvelte(source, { filename: file, modern: true }) as typeof ast;
	} catch (error) {
		throw new Error(
			`Failed to parse Svelte file ${file}: ${error instanceof Error ? error.message : String(error)}`
		);
	}

	const units: string[] = [];
	for (const block of [ast.instance, ast.module]) {
		const content = block?.content;
		if (content && typeof content.start === 'number' && typeof content.end === 'number') {
			units.push(source.slice(content.start, content.end));
		}
	}

	const markupNames = new Set<string>();

	type EstreeNode = Record<string, unknown> & { type?: string };
	const estreeCalleeSegments = (node: EstreeNode | undefined): string[] => {
		const segments: string[] = [];
		let current = node;
		while (current) {
			if (current.type === 'Identifier' && typeof current.name === 'string') {
				segments.unshift(current.name);
				break;
			}
			if (current.type === 'CallExpression') {
				current = current.callee as EstreeNode | undefined;
				continue;
			}
			if (current.type === 'MemberExpression') {
				const property = current.property as EstreeNode | undefined;
				if (property?.type === 'Identifier' && typeof property.name === 'string') {
					segments.unshift(property.name);
				} else if (
					property?.type === 'Literal' &&
					typeof (property as { value?: unknown }).value === 'string'
				) {
					segments.unshift((property as { value: string }).value);
				}
				current = current.object as EstreeNode | undefined;
				continue;
			}
			if (
				current.type === 'TSAsExpression' ||
				current.type === 'TSNonNullExpression' ||
				current.type === 'ParenthesizedExpression'
			) {
				current = current.expression as EstreeNode | undefined;
				continue;
			}
			break;
		}
		return segments;
	};

	const visitMarkup = (node: unknown): void => {
		if (!node || typeof node !== 'object') {
			return;
		}
		if (Array.isArray(node)) {
			for (const child of node) {
				visitMarkup(child);
			}
			return;
		}
		const record = node as EstreeNode;

		if (record.type === 'CallExpression') {
			const segments = estreeCalleeSegments(record.callee as EstreeNode | undefined);
			const method = segments[segments.length - 1];
			const receiverRoot = segments.length >= 2 ? segments[0] : undefined;
			if (method === 'from' || method === 'rpc') {
				if (
					!(
						segments.length === 2 &&
						receiverRoot !== undefined &&
						BUILTIN_FROM_RECEIVERS.has(receiverRoot)
					)
				) {
					markupNames.add(method);
				}
			}
			if (segments.slice(0, -1).includes('auth')) {
				markupNames.add('auth');
			}
			const service = segments.slice(0, -1).find((segment) => SERVICE_SEGMENTS.has(segment));
			if (service !== undefined) {
				markupNames.add(service);
			} else if (method === 'channel') {
				markupNames.add('channel');
			}
			if (
				method !== undefined &&
				(FACTORY_CALL_NAMES.has(method) || method === 'createAdminClient')
			) {
				markupNames.add(method);
			}
		}

		for (const [key, value] of Object.entries(record)) {
			if (key === 'start' || key === 'end' || key === 'loc' || key === 'parent') {
				continue;
			}
			visitMarkup(value);
		}
	};
	visitMarkup(ast.fragment);

	return {
		units,
		markupAccesses: [...markupNames].sort().map((name) => ({ file, kind: 'markup', name }))
	};
}

/** Scans one source file and returns deduplicated Supabase-shaped candidates. */
export function scanSource(source: string, file: string): Access[] {
	const accessesByKey = new Map<string, Access>();

	const record = (kind: AccessKind, name: string) => {
		const key = `${kind}|${name}`;
		if (!accessesByKey.has(key)) {
			accessesByKey.set(key, { file, kind, name });
		}
	};

	const { units, markupAccesses } = sourceUnits(source, file);
	for (const access of markupAccesses) {
		record(access.kind, access.name);
	}

	for (const unit of units) {
		const parsed = ts.createSourceFile(file, unit, ts.ScriptTarget.Latest, true, scriptKind(file));
		const authAliases = new Set<string>();

		const collectAuthAliases = (node: ts.Node): void => {
			if (ts.isVariableDeclaration(node)) {
				if (
					ts.isIdentifier(node.name) &&
					node.initializer &&
					calleeChainSegments(node.initializer).includes('auth')
				) {
					authAliases.add(node.name.text);
				}

				if (ts.isObjectBindingPattern(node.name)) {
					for (const element of node.name.elements) {
						if (!ts.isBindingElement(element)) {
							continue;
						}
						const propertyName = element.propertyName;
						const boundName = element.name;
						const isAuthProperty =
							(propertyName && ts.isIdentifier(propertyName) && propertyName.text === 'auth') ||
							(!propertyName && ts.isIdentifier(boundName) && boundName.text === 'auth');
						if (isAuthProperty && ts.isIdentifier(boundName)) {
							authAliases.add(boundName.text);
						}
					}
				}
			}

			ts.forEachChild(node, collectAuthAliases);
		};

		collectAuthAliases(parsed);

		for (const statement of parsed.statements) {
			if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
				const moduleName = statement.moduleSpecifier.text;
				const clause = statement.importClause;
				if (!clause || clause.isTypeOnly) {
					continue;
				}
				if (isAdminModule(moduleName)) {
					record('admin-client', 'createAdminClient');
				}
				if (SUPABASE_PACKAGES.has(moduleName)) {
					if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
						for (const element of clause.namedBindings.elements) {
							if (element.isTypeOnly) {
								continue;
							}
							const importedName = element.propertyName?.text ?? element.name.text;
							if (FACTORY_CALL_NAMES.has(importedName)) {
								record('client-factory', importedName);
							}
						}
					} else if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
						record('client-factory', 'namespaceImport');
					}
				}
			}

			if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
				const moduleName =
					statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
						? statement.moduleSpecifier.text
						: undefined;
				if (moduleName !== undefined && isSupabaseModule(moduleName)) {
					if (isAdminModule(moduleName)) {
						record('admin-client', 'createAdminClient');
					}
					if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
						for (const element of statement.exportClause.elements) {
							if (element.isTypeOnly) {
								continue;
							}
							const exportedName = element.propertyName?.text ?? element.name.text;
							record('client-factory', `reexport:${exportedName}`);
						}
					} else {
						record('client-factory', 'starReexport');
					}
				}
			}
		}

		const visit = (node: ts.Node): void => {
			if (
				(ts.isFunctionDeclaration(node) && node.name?.text === 'createAdminClient') ||
				(ts.isVariableDeclaration(node) &&
					ts.isIdentifier(node.name) &&
					node.name.text === 'createAdminClient')
			) {
				record('admin-client', 'createAdminClient');
			}

			if (ts.isCallExpression(node)) {
				if (
					ts.isIdentifier(node.expression) &&
					node.expression.text === 'require' &&
					node.arguments[0] &&
					ts.isStringLiteralLike(node.arguments[0]) &&
					isSupabaseModule(node.arguments[0].text)
				) {
					if (isAdminModule(node.arguments[0].text)) {
						record('admin-client', 'createAdminClient');
					} else {
						record('client-factory', 'commonJsRequire');
					}
				}

				if (
					node.expression.kind === ts.SyntaxKind.ImportKeyword &&
					node.arguments[0] &&
					ts.isStringLiteralLike(node.arguments[0]) &&
					isSupabaseModule(node.arguments[0].text)
				) {
					if (isAdminModule(node.arguments[0].text)) {
						record('admin-client', 'createAdminClient');
					} else {
						record('client-factory', 'dynamicImport');
					}
				}

				const segments = calleeChainSegments(node.expression);
				const method = segments[segments.length - 1];
				const receiverRoot = segments.length >= 2 ? segments[0] : undefined;

				if (method === 'from' || method === 'rpc') {
					const isBuiltin =
						segments.length === 2 &&
						receiverRoot !== undefined &&
						BUILTIN_FROM_RECEIVERS.has(receiverRoot) &&
						node.expression &&
						memberReceiver(unwrapExpression(node.expression)) !== undefined &&
						ts.isIdentifier(
							unwrapExpression(memberReceiver(unwrapExpression(node.expression)) as ts.Expression)
						);
					if (!isBuiltin) {
						record(method === 'from' ? 'table' : 'rpc', literalResource(node));
					}
				} else if (
					segments.slice(0, -1).includes('auth') ||
					(segments.length >= 2 && authAliases.has(segments[0]))
				) {
					record('auth-session', method ?? DYNAMIC_ACCESS_NAME);
				} else {
					const service = segments.slice(0, -1).find((segment) => SERVICE_SEGMENTS.has(segment));
					if (service !== undefined) {
						record('service', `${service}.${method ?? DYNAMIC_ACCESS_NAME}`);
					} else if (method === 'channel') {
						record('service', 'channel');
					}
				}

				if (method === 'createAdminClient') {
					record('admin-client', 'createAdminClient');
				} else if (method !== undefined && FACTORY_CALL_NAMES.has(method)) {
					record('client-factory', method);
				}
			}

			if (
				(ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
				memberName(node) === 'auth'
			) {
				// Climb through the member/call chain this access is embedded in; if it
				// terminates as the callee of a call, the call rules above own it.
				// Otherwise it is a bare auth reference (alias, argument, return) and
				// must leave a classifiable footprint at the alias site.
				let current: ts.Node = node;
				let parent: ts.Node | undefined = current.parent;
				while (
					parent &&
					((ts.isPropertyAccessExpression(parent) && parent.expression === current) ||
						(ts.isElementAccessExpression(parent) && parent.expression === current) ||
						(ts.isCallExpression(parent) && parent.expression === current) ||
						((ts.isParenthesizedExpression(parent) ||
							ts.isAsExpression(parent) ||
							ts.isNonNullExpression(parent) ||
							ts.isSatisfiesExpression(parent)) &&
							parent.expression === current))
				) {
					if (ts.isCallExpression(parent) && parent.expression === current) {
						break;
					}
					current = parent;
					parent = current.parent;
				}
				const isCallee =
					parent !== undefined && ts.isCallExpression(parent) && parent.expression === current;
				if (!isCallee) {
					record('auth-session', '<memberAccess>');
				}
			}

			ts.forEachChild(node, visit);
		};

		visit(parsed);
	}

	return [...accessesByKey.values()];
}

function walk(dir: string, out: string[]): void {
	for (const entry of readdirSync(dir).sort()) {
		const full = join(dir, entry);
		const stats = statSync(full);
		if (stats.isDirectory()) {
			walk(full, out);
		} else if (stats.isFile()) {
			out.push(full);
		}
	}
}

/** Collects runtime and operational Supabase candidates under the scanned roots. */
export function collectAccesses(rootDir: string): Access[] {
	const files: string[] = [];
	for (const scannedRoot of SCANNED_ROOTS) {
		const directory = join(rootDir, scannedRoot);
		if (existsSync(directory)) {
			walk(directory, files);
		}
	}

	const accesses: Access[] = [];
	for (const file of files) {
		const relPath = relative(rootDir, file).split('\\').join('/');
		if (!isRuntimeFile(relPath)) {
			continue;
		}
		accesses.push(...scanSource(readFileSync(file, 'utf8'), relPath));
	}

	return accesses.sort(
		(a, b) =>
			a.file.localeCompare(b.file) || a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)
	);
}

function accessKey(access: { file: string; kind: string; name: string }): string {
	return `${access.file} [${access.kind}:${access.name}]`;
}

/** Validates manifest shape, suppression shape, and retained-classification constraints. */
export function validateManifest(manifest: Manifest): string[] {
	const errors: string[] = [];
	const seen = new Set<string>();

	if (!Array.isArray(manifest.entries)) {
		return ['Manifest is missing an "entries" array.'];
	}
	const suppressions = manifest.suppressions ?? [];
	if (!Array.isArray(suppressions)) {
		return ['Manifest "suppressions" must be an array when present.'];
	}

	for (const suppression of suppressions) {
		const key = accessKey(suppression);
		if (!suppression.file || !suppression.name || !VALID_KINDS.has(suppression.kind)) {
			errors.push(`Invalid suppression (file, kind, and name are required): ${key}`);
			continue;
		}
		if (!suppression.reason) {
			errors.push(`Suppression is missing a reason asserting it is not Supabase access: ${key}`);
		}
		if (seen.has(key)) {
			errors.push(`Duplicate manifest record: ${key}`);
			continue;
		}
		seen.add(key);
	}

	for (const entry of manifest.entries) {
		const key = accessKey(entry);

		if (!entry.file || !entry.name || !VALID_KINDS.has(entry.kind)) {
			errors.push(`Invalid manifest entry (file, kind, and name are required): ${key}`);
			continue;
		}
		if (entry.kind === 'markup') {
			errors.push(
				`Supabase access in Svelte template markup cannot be classified; move it into a script block: ${key}`
			);
			continue;
		}
		if (entry.name === DYNAMIC_ACCESS_NAME) {
			errors.push(
				`Dynamic Supabase table/RPC access cannot be allowlisted; use a literal resource name: ${key}`
			);
			continue;
		}
		if (seen.has(key)) {
			errors.push(`Duplicate manifest record: ${key}`);
			continue;
		}
		seen.add(key);

		if (!entry.disposition) {
			errors.push(`Manifest entry is missing a disposition: ${key}`);
		}

		if (entry.classification === 'shared-data-debt') {
			if (entry.owner) {
				errors.push(`shared-data-debt entries must not declare a retained owner: ${key}`);
			}
			if (!entry.plannedRemovalPr || !VALID_REMOVAL_PRS.test(entry.plannedRemovalPr)) {
				errors.push(
					`shared-data-debt entries need plannedRemovalPr in PR-03..PR-10: ${key} (got ${entry.plannedRemovalPr ?? 'none'})`
				);
			}
			continue;
		}

		if (entry.classification !== 'retained-web-local') {
			errors.push(
				`Unknown classification "${entry.classification}" (expected retained-web-local or shared-data-debt): ${key}`
			);
			continue;
		}

		if (entry.plannedRemovalPr) {
			errors.push(`retained-web-local entries must not declare plannedRemovalPr: ${key}`);
		}

		if (NEVER_RETAINED_NAMES.has(entry.name)) {
			errors.push(
				`${entry.name} is product-authorization data and can never be retained-web-local: ${key}`
			);
			continue;
		}

		if (NEVER_RETAINED_FILES.has(entry.file)) {
			errors.push(
				`${entry.file} implements product-principal or credential validation and can never hold retained-web-local entries: ${key}`
			);
			continue;
		}

		if (entry.kind === 'admin-client' && !RETAINED_ADMIN_CLIENT_FILES.has(entry.file)) {
			errors.push(
				`retained admin-client custody is limited to ${[...RETAINED_ADMIN_CLIENT_FILES].sort().join(', ')}, not ${key}`
			);
			continue;
		}

		if (entry.kind === 'client-factory' && !RETAINED_CLIENT_FACTORY_FILES.has(entry.file)) {
			errors.push(
				`retained Supabase client factories are limited to ${[...RETAINED_CLIENT_FACTORY_FILES].sort().join(', ')}, not ${key}`
			);
			continue;
		}

		if (
			entry.kind === 'auth-session' &&
			entry.name === 'getUser' &&
			!RETAINED_AUTH_GET_USER_FILES.has(entry.file)
		) {
			errors.push(
				`retained auth-session getUser access is limited to explicit browser session boundaries; helper consumers of externally supplied clients must remain shared-data-debt: ${key}`
			);
			continue;
		}

		switch (entry.owner) {
			case 'auth-session':
				if (
					(entry.kind !== 'auth-session' || !RETAINED_AUTH_SESSION_METHODS.has(entry.name)) &&
					(entry.kind !== 'client-factory' ||
						![
							'createBrowserClient',
							'createServerClient',
							'createClient',
							'createSupabaseLoadClient'
						].includes(entry.name))
				) {
					errors.push(
						`retained auth-session may cover only OAuth/session lifecycle methods and browser/server session factories, not ${key}`
					);
				}
				break;
			case 'workspace-memory':
				if (entry.kind !== 'table' || !RETAINED_WORKSPACE_TABLES.has(entry.name)) {
					errors.push(
						`retained workspace-memory may cover only ${[...RETAINED_WORKSPACE_TABLES].sort().join(', ')} tables, not ${key}`
					);
				}
				break;
			case 'billing':
				if (
					entry.kind !== 'admin-client' &&
					!(entry.kind === 'client-factory' && entry.name === 'createClient') &&
					!(entry.kind === 'table' && RETAINED_BILLING_TABLES.has(entry.name))
				) {
					errors.push(
						`retained billing may cover only billing tables or admin-client/client-factory custody, not ${key}`
					);
				}
				break;
			default:
				errors.push(
					`retained-web-local entries need owner auth-session, workspace-memory, or billing: ${key}`
				);
		}
	}

	return errors;
}

export interface BoundaryResult {
	accesses: Access[];
	errors: string[];
}

/**
 * Runs the full boundary check for a repository root containing src/ and a
 * parsed manifest. Returns sorted errors; empty means the boundary holds.
 */
export function checkBoundary(rootDir: string, manifest: Manifest): BoundaryResult {
	const errors = validateManifest(manifest);
	const accesses = collectAccesses(rootDir);

	const manifestEntries = Array.isArray(manifest.entries) ? manifest.entries : [];
	const suppressions = Array.isArray(manifest.suppressions) ? manifest.suppressions : [];
	const entryKeys = new Set(manifestEntries.map(accessKey));
	const suppressionKeys = new Set(suppressions.map(accessKey));
	const accessKeys = new Set(accesses.map(accessKey));

	const adminClientFiles = new Set(
		accesses
			.filter((access) => access.kind === 'admin-client' && !suppressionKeys.has(accessKey(access)))
			.map((access) => access.file)
	);
	for (const entry of manifestEntries) {
		if (
			entry.kind === 'auth-session' &&
			entry.classification === 'retained-web-local' &&
			adminClientFiles.has(entry.file)
		) {
			errors.push(
				`Admin-client Supabase auth access can never be retained-web-local: ${accessKey(entry)}. ${entry.file} holds admin-client custody, so every auth-session entry in it must be classified shared-data-debt.`
			);
		}
	}

	for (const access of accesses) {
		const key = accessKey(access);
		if (suppressionKeys.has(key)) {
			continue;
		}
		if (access.kind === 'markup') {
			errors.push(
				`Supabase-shaped access in Svelte template markup is banned: ${key}. Move the expression into a script block so it can be scanned and classified, or add a suppression if it is genuinely not Supabase.`
			);
			continue;
		}
		if (!entryKeys.has(key)) {
			errors.push(
				`Unclassified Supabase-shaped access: ${key}. Add a classified entry (or a suppression, if this is not Supabase) to config/supabase-boundary-manifest.json.`
			);
		}
	}

	for (const key of entryKeys) {
		if (!accessKeys.has(key)) {
			errors.push(
				`Stale manifest entry: ${key}. The caller no longer exists (or moved); delete or update its manifest entry.`
			);
		}
		if (suppressionKeys.has(key)) {
			errors.push(`Manifest record is both classified and suppressed: ${key}. Pick one.`);
		}
	}

	for (const key of suppressionKeys) {
		if (!accessKeys.has(key)) {
			errors.push(
				`Stale suppression: ${key}. The call no longer exists (or moved); delete or update its suppression.`
			);
		}
	}

	return { accesses, errors: errors.sort() };
}

function main(): void {
	const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
	const manifestPath = join(rootDir, 'config', 'supabase-boundary-manifest.json');

	let manifest: Manifest;
	try {
		manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
	} catch (error) {
		console.error(
			`Failed to read boundary manifest at ${manifestPath}: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exit(1);
	}

	const { accesses, errors } = checkBoundary(rootDir, manifest);

	if (errors.length > 0) {
		console.error('Supabase boundary check failed:');
		for (const message of errors) {
			console.error(`  - ${message}`);
		}
		process.exit(1);
	}

	const counts = new Map<string, number>();
	for (const entry of manifest.entries) {
		const label =
			entry.classification === 'retained-web-local'
				? `retained-web-local:${entry.owner}`
				: `shared-data-debt:${entry.plannedRemovalPr}`;
		counts.set(label, (counts.get(label) ?? 0) + 1);
	}

	console.log(
		`Supabase boundary check passed: ${accesses.length} candidates across ${new Set(accesses.map((a) => a.file)).size} runtime and operational files (${manifest.suppressions?.length ?? 0} suppressed).`
	);
	for (const label of [...counts.keys()].sort()) {
		console.log(`  ${label}: ${counts.get(label)}`);
	}
}

const isDirectRun =
	typeof process.argv[1] === 'string' && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
	main();
}
