/**
 * Supabase boundary guard (PR 01 of the shared-data boundary retirement program).
 *
 * Scans coffee-app runtime and operational source for direct Supabase access and
 * compares every hit against the checked-in manifest at
 * config/supabase-boundary-manifest.json.
 *
 * Scan scope (explicit):
 * - Files: src/** and scripts/** with .ts, .svelte, .js, .mjs, or .cjs extensions.
 * - Excluded from the runtime classification requirement: *.test.ts, *.spec.ts,
 *   *.test.js, *.spec.js, src/test-setup.ts, and any path containing a
 *   __fixtures__, __mocks__, or __tests__ segment.
 *
 * Detections (deterministic and syntax-aware):
 * - kind "table": `.from('<name>')` with a string-literal table name. Dynamic
 *   names fail closed. Known non-Supabase receivers such as `Array.from(...)`
 *   are excluded and covered by fixture tests.
 * - kind "rpc": `.rpc('<name>'` with a string-literal function name.
 * - kind "admin-client": any reference to `createAdminClient` or an import of
 *   the `supabase-admin` module (one hit per file).
 * - kind "client-factory": a runtime import of createClient,
 *   createServerClient, or createBrowserClient from a Supabase package.
 * - kind "auth-session": any method call rooted beneath a Supabase `auth`
 *   member. Unknown methods and dynamic names fail closed through manifest
 *   classification rather than being silently ignored.
 *
 * Enforcement:
 * - Every detected access must have a manifest entry (file + kind + name).
 * - Every manifest entry must still match a detected access; deleted or renamed
 *   callers must delete or update their entries (stale entries fail).
 * - Retained classifications are constrained: auth-session may cover only
 *   OAuth/session lifecycle methods, workspace-memory only the named chat
 *   persistence tables, and billing only the named billing tables plus
 *   admin-client custody in billing code. Product-principal construction, role
 *   lookup, and entitlement resolution (user_roles, api_keys, api_usage, and
 *   admin-client JWT validation) can never be classified as retained.
 *
 * Exit codes: 0 on pass, 1 on any failure.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

export type AccessKind = 'table' | 'rpc' | 'admin-client' | 'client-factory' | 'auth-session';

export interface Access {
	file: string;
	kind: AccessKind;
	name: string;
	authContext?: 'admin-client';
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

export interface Manifest {
	description?: string;
	entries: ManifestEntry[];
}

const SCANNED_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs', '.svelte'];
const SCANNED_ROOTS = ['src', 'scripts'];

const EXCLUDED_FILE_PATTERNS = [/\.test\.(ts|js|mjs|cjs)$/, /\.spec\.(ts|js|mjs|cjs)$/];

const EXCLUDED_PATH_SEGMENTS = ['__fixtures__', '__mocks__', '__tests__'];

const EXCLUDED_FILES = new Set(['src/test-setup.ts']);

/** Receivers whose `.from(...)` is never a Supabase table read. */
const NON_SUPABASE_FROM_RECEIVERS = new Set([
	'Array',
	'ArrayBuffer',
	'BigInt64Array',
	'BigUint64Array',
	'Buffer',
	'Float32Array',
	'Float64Array',
	'Int8Array',
	'Int16Array',
	'Int32Array',
	'Object',
	'Uint8Array',
	'Uint8ClampedArray',
	'Uint16Array',
	'Uint32Array'
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
	'signUp'
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
	'src/lib/supabase.ts'
]);

const VALID_KINDS = new Set<string>([
	'table',
	'rpc',
	'admin-client',
	'client-factory',
	'auth-session'
]);

const VALID_REMOVAL_PRS = /^PR-(0[3-9]|10)$/;

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

const SUPABASE_CLIENT_FACTORIES = new Set([
	'createBrowserClient',
	'createClient',
	'createServerClient'
]);
const SUPABASE_PACKAGES = new Set(['@supabase/ssr', '@supabase/supabase-js']);
const DYNAMIC_ACCESS_NAME = '<dynamic>';

function scriptKind(file: string): ts.ScriptKind {
	return /\.(?:js|mjs|cjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}

function sourceUnits(source: string, file: string): string[] {
	if (!file.endsWith('.svelte')) {
		return [source];
	}

	const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi)].map(
		(match) => match[1]
	);
	return scripts.length > 0 ? scripts : [''];
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
		ts.isParenthesizedExpression(current)
	) {
		current = current.expression;
	}
	return current;
}

function memberChainSegments(expression: ts.Expression): string[] {
	const segments: string[] = [];
	let current: ts.Expression | undefined = unwrapExpression(expression);

	while (current) {
		if (ts.isIdentifier(current)) {
			segments.unshift(current.text);
			break;
		}
		if (ts.isPropertyAccessExpression(current)) {
			segments.unshift(current.name.text);
			current = current.expression;
			continue;
		}
		if (ts.isElementAccessExpression(current)) {
			if (current.argumentExpression && ts.isStringLiteralLike(current.argumentExpression)) {
				segments.unshift(current.argumentExpression.text);
			}
			current = current.expression;
			continue;
		}
		break;
	}

	return segments;
}

function isSupabaseAuthReceiver(
	receiver: ts.Expression,
	supabaseClientNames: Set<string>
): boolean {
	const segments = memberChainSegments(receiver);
	const authIndex = segments.indexOf('auth');
	if (authIndex === -1) {
		return false;
	}

	const root = segments[0];
	return (
		(supabaseClientNames.has(root) || segments.some((segment) => /supabase/i.test(segment))) &&
		root !== undefined
	);
}

function isAdminAuthReceiver(receiver: ts.Expression, adminClientNames: Set<string>): boolean {
	const segments = memberChainSegments(receiver);
	const authIndex = segments.indexOf('auth');
	return (
		authIndex !== -1 &&
		(segments.slice(authIndex + 1).includes('admin') || adminClientNames.has(segments[0] ?? ''))
	);
}

function literalResource(call: ts.CallExpression): string {
	const argument = call.arguments[0];
	return argument && ts.isStringLiteralLike(argument) ? argument.text : DYNAMIC_ACCESS_NAME;
}

/** Scans one source file with TypeScript's syntax tree and returns deduplicated accesses. */
export function scanSource(source: string, file: string): Access[] {
	const accessesByKey = new Map<string, Access>();

	const record = (kind: AccessKind, name: string, metadata: Pick<Access, 'authContext'> = {}) => {
		const key = `${kind}|${name}`;
		const existing = accessesByKey.get(key);
		if (!existing) {
			accessesByKey.set(key, { file, kind, name, ...metadata });
		} else if (metadata.authContext === 'admin-client') {
			// If the same file uses a method through both session and admin clients,
			// preserve the stricter context for retained-classification validation.
			existing.authContext = metadata.authContext;
		}
	};

	for (const unit of sourceUnits(source, file)) {
		const parsed = ts.createSourceFile(file, unit, ts.ScriptTarget.Latest, true, scriptKind(file));
		const importedFactories = new Map<string, string>();
		const supabaseNamespaces = new Set<string>();
		const supabaseClientNames = new Set<string>();
		const adminClientNames = new Set<string>();
		const adminFactoryNames = new Set(['createAdminClient']);

		for (const statement of parsed.statements) {
			if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
				const moduleName = statement.moduleSpecifier.text;
				const clause = statement.importClause;

				if (moduleName.includes('supabase-admin') && clause && !clause.isTypeOnly) {
					record('admin-client', 'createAdminClient');
					if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
						for (const element of clause.namedBindings.elements) {
							if (!element.isTypeOnly && element.propertyName?.text === 'createAdminClient') {
								adminFactoryNames.add(element.name.text);
							}
						}
					}
				}

				if (!SUPABASE_PACKAGES.has(moduleName) || !clause || clause.isTypeOnly) {
					continue;
				}

				const bindings = clause.namedBindings;
				if (bindings && ts.isNamedImports(bindings)) {
					for (const element of bindings.elements) {
						if (element.isTypeOnly) {
							continue;
						}
						const importedName = element.propertyName?.text ?? element.name.text;
						if (SUPABASE_CLIENT_FACTORIES.has(importedName)) {
							importedFactories.set(element.name.text, importedName);
							record('client-factory', importedName);
						}
					}
				} else if (bindings && ts.isNamespaceImport(bindings)) {
					supabaseNamespaces.add(bindings.name.text);
				}
			}
		}

		const factoryCallName = (expression: ts.Expression): string | undefined => {
			const call = unwrapExpression(expression);
			if (!ts.isCallExpression(call)) {
				return undefined;
			}

			if (ts.isIdentifier(call.expression)) {
				if (adminFactoryNames.has(call.expression.text)) {
					return 'admin-client';
				}
				return importedFactories.get(call.expression.text);
			}

			if (ts.isPropertyAccessExpression(call.expression)) {
				const receiver = call.expression.expression;
				if (ts.isIdentifier(receiver) && supabaseNamespaces.has(receiver.text)) {
					return SUPABASE_CLIENT_FACTORIES.has(call.expression.name.text)
						? call.expression.name.text
						: undefined;
				}
			}

			return undefined;
		};

		const collectClientBindings = (node: ts.Node): void => {
			if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
				const factory = factoryCallName(node.initializer);
				if (factory) {
					supabaseClientNames.add(node.name.text);
					if (factory === 'admin-client') {
						adminClientNames.add(node.name.text);
					}
				}
			}
			ts.forEachChild(node, collectClientBindings);
		};
		collectClientBindings(parsed);

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
					SUPABASE_PACKAGES.has(node.arguments[0].text)
				) {
					record('client-factory', 'commonJsRequire');
				}

				if (
					node.expression.kind === ts.SyntaxKind.ImportKeyword &&
					node.arguments[0] &&
					ts.isStringLiteralLike(node.arguments[0]) &&
					SUPABASE_PACKAGES.has(node.arguments[0].text)
				) {
					record('client-factory', 'dynamicImport');
				}

				if (ts.isIdentifier(node.expression)) {
					if (node.expression.text === 'createAdminClient') {
						record('admin-client', 'createAdminClient');
					}
					const importedFactory = importedFactories.get(node.expression.text);
					if (importedFactory) {
						record('client-factory', importedFactory);
					}
				}

				const name = memberName(node.expression);
				const receiver = memberReceiver(node.expression);
				if (
					name &&
					SUPABASE_CLIENT_FACTORIES.has(name) &&
					receiver &&
					ts.isIdentifier(receiver) &&
					supabaseNamespaces.has(receiver.text)
				) {
					record('client-factory', name);
				}

				if (name === 'from') {
					if (
						receiver &&
						ts.isIdentifier(receiver) &&
						NON_SUPABASE_FROM_RECEIVERS.has(receiver.text)
					) {
						ts.forEachChild(node, visit);
						return;
					}
					record('table', literalResource(node));
				} else if (name === 'rpc') {
					record('rpc', literalResource(node));
				} else if (receiver && isSupabaseAuthReceiver(receiver, supabaseClientNames)) {
					record('auth-session', name ?? DYNAMIC_ACCESS_NAME, {
						...(isAdminAuthReceiver(receiver, adminClientNames)
							? { authContext: 'admin-client' as const }
							: {})
					});
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

/** Collects runtime and operational Supabase accesses under the scanned roots. */
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

/** Validates manifest shape and retained-classification constraints. */
export function validateManifest(manifest: Manifest): string[] {
	const errors: string[] = [];
	const seen = new Set<string>();

	if (!Array.isArray(manifest.entries)) {
		return ['Manifest is missing an "entries" array.'];
	}

	for (const entry of manifest.entries) {
		const key = accessKey(entry);

		if (!entry.file || !entry.name || !VALID_KINDS.has(entry.kind)) {
			errors.push(`Invalid manifest entry (file, kind, and name are required): ${key}`);
			continue;
		}
		if (entry.name === DYNAMIC_ACCESS_NAME) {
			errors.push(
				`Dynamic Supabase table/RPC access cannot be allowlisted; use a literal resource name: ${key}`
			);
			continue;
		}
		if (seen.has(key)) {
			errors.push(`Duplicate manifest entry: ${key}`);
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

		switch (entry.owner) {
			case 'auth-session':
				if (
					(entry.kind !== 'auth-session' || !RETAINED_AUTH_SESSION_METHODS.has(entry.name)) &&
					(entry.kind !== 'client-factory' ||
						!['createBrowserClient', 'createServerClient'].includes(entry.name))
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

	const manifestKeys = new Set(
		Array.isArray(manifest.entries) ? manifest.entries.map(accessKey) : []
	);
	const manifestEntries = Array.isArray(manifest.entries) ? manifest.entries : [];
	const accessKeys = new Set(accesses.map(accessKey));

	for (const access of accesses) {
		const entry = manifestEntries.find((candidate) => accessKey(candidate) === accessKey(access));
		if (access.authContext === 'admin-client' && entry?.classification === 'retained-web-local') {
			errors.push(
				`Admin-client Supabase auth access can never be retained-web-local: ${accessKey(access)}. Classify admin JWT or administrative auth work as shared-data-debt.`
			);
		}
		if (!manifestKeys.has(accessKey(access))) {
			errors.push(
				`Unclassified Supabase access: ${accessKey(access)}. Add a classified entry to config/supabase-boundary-manifest.json or remove the access.`
			);
		}
	}

	for (const key of manifestKeys) {
		if (!accessKeys.has(key)) {
			errors.push(
				`Stale manifest entry: ${key}. The caller no longer exists (or moved); delete or update its manifest entry.`
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
		`Supabase boundary check passed: ${accesses.length} classified accesses across ${new Set(accesses.map((a) => a.file)).size} runtime and operational files.`
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
