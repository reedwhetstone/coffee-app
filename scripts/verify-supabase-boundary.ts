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
 * - kind "table": `.from('<name>')` with a string-literal table name on a
 *   Supabase-shaped receiver. Dynamic names and unknown receivers fail closed.
 * - kind "rpc": `.rpc('<name>'` with a string-literal function name on a
 *   Supabase-shaped receiver.
 * - kind "admin-client": any reference to `createAdminClient` or an import of
 *   the `supabase-admin` module (one hit per file).
 * - kind "client-factory": a runtime import of createClient,
 *   createServerClient, or createBrowserClient from a Supabase package.
 * - kind "auth-session": any method call rooted beneath a Supabase `auth`
 *   member. Unknown methods and dynamic names fail closed through manifest
 *   classification rather than being silently ignored.
 * - kind "markup": any Supabase-shaped expression inside Svelte template
 *   markup. Markup access is banned outright (never classifiable); Supabase
 *   calls must live in script blocks where the scanner can classify them.
 *   Svelte files are parsed with svelte/compiler, not regex extraction.
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
 * - File-level admin invariant: any file with a detected admin-client access
 *   may never hold a retained-web-local auth-session entry. This is enforced
 *   on file identity (the supabase-admin import), not on call-chain tracing,
 *   so aliasing, factory-call receivers, or parameter passing inside the file
 *   cannot launder admin JWT validation into a retained classification.
 *
 * Scope contract: this guard is a deterministic review trip-wire over
 * conventional Supabase access patterns (imports of Supabase packages and the
 * supabase-admin module, supabase-named bindings, SupabaseClient-typed values,
 * and auth member chains). Deliberate intra-repo obfuscation, such as threading
 * a client through untyped renames that never mention Supabase, is out of
 * scope: it cannot occur without a conventional origin (import, factory call,
 * or typed binding) in some file, which this guard does classify, and PR review
 * owns the rest. Findings that require deliberate evasion do not contradict
 * this contract.
 *
 * Exit codes: 0 on pass, 1 on any failure.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseSvelte } from 'svelte/compiler';
import ts from 'typescript';

export type AccessKind =
	| 'table'
	| 'rpc'
	| 'admin-client'
	| 'client-factory'
	| 'auth-session'
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

export interface Manifest {
	description?: string;
	entries: ManifestEntry[];
}

const SCANNED_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs', '.svelte'];
const SCANNED_ROOTS = ['src', 'scripts'];

const EXCLUDED_FILE_PATTERNS = [/\.test\.(ts|js|mjs|cjs)$/, /\.spec\.(ts|js|mjs|cjs)$/];

const EXCLUDED_PATH_SEGMENTS = ['__fixtures__', '__mocks__', '__tests__'];

const EXCLUDED_FILES = new Set(['src/test-setup.ts']);

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

type FactoryProvenance =
	| 'createBrowserClient'
	| 'createClient'
	| 'createServerClient'
	| 'admin-client';

interface ParsedModule {
	file: string;
	units: string[];
	asts: ts.SourceFile[];
	markupFragment?: unknown;
}

interface ModuleSymbols {
	factoryBindings: Map<string, FactoryProvenance>;
	factoryNamespaces: Map<string, Map<string, FactoryProvenance>>;
	factoryExports: Map<string, FactoryProvenance>;
	supabaseNamespaces: Set<string>;
}

interface ModuleSymbolTable {
	modules: Map<string, ModuleSymbols>;
}

const EMPTY_MODULE_SYMBOLS = (): ModuleSymbols => ({
	factoryBindings: new Map(),
	factoryNamespaces: new Map(),
	factoryExports: new Map(),
	supabaseNamespaces: new Set()
});

function scriptKind(file: string): ts.ScriptKind {
	return /\.(?:js|mjs|cjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}

interface SourceUnits {
	/** Script sources to run through the TypeScript scanner. */
	units: string[];
	/** Svelte template fragment retained for provenance-aware markup scanning. */
	markupFragment?: unknown;
}

interface SvelteScriptBlock {
	content?: { start?: number; end?: number };
}

function isSupabaseShapedName(name: string | undefined): boolean {
	return name === 'supabase' || name === 'client' || Boolean(name && /supabase/i.test(name));
}

/**
 * Parses a Svelte file with svelte/compiler and returns script-block sources
 * plus any Supabase-shaped expressions found in template markup. Markup access
 * is banned: it cannot be classified against the manifest, so it always fails.
 * Unparseable Svelte files fail closed by throwing.
 */
function sourceUnits(source: string, file: string): SourceUnits {
	if (!file.endsWith('.svelte')) {
		return { units: [source] };
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

	return { units, markupFragment: ast.fragment };
}

function parseModule(source: string, file: string): ParsedModule {
	const { units, markupFragment } = sourceUnits(source, file);
	return {
		file,
		units,
		asts: units.map((unit) =>
			ts.createSourceFile(file, unit, ts.ScriptTarget.Latest, true, scriptKind(file))
		),
		markupFragment
	};
}

function normalizedModulePath(file: string): string {
	return normalize(file).split('\\').join('/').replace(/^\.\//, '');
}

function resolveModuleSpecifier(
	fromFile: string,
	specifier: string,
	knownFiles: Set<string>
): string | undefined {
	let base: string;
	if (specifier.startsWith('./') || specifier.startsWith('../')) {
		base = normalizedModulePath(join(dirname(fromFile), specifier));
	} else if (specifier.startsWith('$lib/')) {
		base = normalizedModulePath(join('src/lib', specifier.slice('$lib/'.length)));
	} else {
		return undefined;
	}

	const withoutExtension = base.replace(/\.(?:ts|js|mjs|cjs|svelte)$/, '');
	const candidates = [
		base,
		`${withoutExtension}.ts`,
		`${withoutExtension}.js`,
		`${withoutExtension}.mjs`,
		`${withoutExtension}.cjs`,
		`${withoutExtension}.svelte`,
		`${withoutExtension}/index.ts`,
		`${withoutExtension}/index.js`
	];
	return candidates.find((candidate) => knownFiles.has(candidate));
}

function literalModuleSpecifier(expression: ts.Expression | undefined): string | undefined {
	if (!expression) {
		return undefined;
	}
	let current = unwrapExpression(expression);
	if (ts.isAwaitExpression(current)) {
		current = unwrapExpression(current.expression);
	}
	if (!ts.isCallExpression(current)) {
		return undefined;
	}
	const isRequire = ts.isIdentifier(current.expression) && current.expression.text === 'require';
	const isDynamicImport = current.expression.kind === ts.SyntaxKind.ImportKeyword;
	if (!(isRequire || isDynamicImport)) {
		return undefined;
	}
	const argument = current.arguments[0];
	return argument && ts.isStringLiteralLike(argument) ? argument.text : undefined;
}

function addFactoryBinding(
	bindings: Map<string, FactoryProvenance>,
	name: string,
	provenance: FactoryProvenance
): boolean {
	if (bindings.get(name) === provenance) {
		return false;
	}
	if (bindings.has(name)) {
		return false;
	}
	bindings.set(name, provenance);
	return true;
}

function sameFactoryMap(
	left: Map<string, FactoryProvenance> | undefined,
	right: Map<string, FactoryProvenance>
): boolean {
	if (!left || left.size !== right.size) {
		return false;
	}
	for (const [name, provenance] of right) {
		if (left.get(name) !== provenance) {
			return false;
		}
	}
	return true;
}

function factoryFromProperty(
	expression: ts.Expression,
	facts: ModuleSymbols
): FactoryProvenance | undefined {
	const member = unwrapExpression(expression);
	if (!ts.isPropertyAccessExpression(member) && !ts.isElementAccessExpression(member)) {
		return undefined;
	}
	const receiver = member.expression;
	if (!ts.isIdentifier(receiver)) {
		return undefined;
	}
	const name = memberName(member);
	if (!name) {
		return undefined;
	}
	if (facts.supabaseNamespaces.has(receiver.text) && SUPABASE_CLIENT_FACTORIES.has(name)) {
		return name as FactoryProvenance;
	}
	return facts.factoryNamespaces.get(receiver.text)?.get(name);
}

function factoryFromExpression(
	expression: ts.Expression | undefined,
	facts: ModuleSymbols
): FactoryProvenance | undefined {
	if (!expression) {
		return undefined;
	}
	const current = unwrapExpression(expression);
	if (ts.isIdentifier(current)) {
		return facts.factoryBindings.get(current.text);
	}
	return factoryFromProperty(current, facts);
}

function bindingElements(name: ts.BindingName): Array<{ localName: string; importedName: string }> {
	if (ts.isIdentifier(name)) {
		return [{ localName: name.text, importedName: name.text }];
	}
	const result: Array<{ localName: string; importedName: string }> = [];
	for (const element of name.elements) {
		if (!ts.isBindingElement(element) || !ts.isIdentifier(element.name)) {
			continue;
		}
		const propertyName = element.propertyName;
		const importedName =
			propertyName && ts.isIdentifier(propertyName) ? propertyName.text : element.name.text;
		result.push({ localName: element.name.text, importedName });
	}
	return result;
}

function buildModuleSymbolTable(parsedModules: ParsedModule[]): ModuleSymbolTable {
	const knownFiles = new Set(parsedModules.map((module) => normalizedModulePath(module.file)));
	const modules = new Map<string, ModuleSymbols>();
	for (const module of parsedModules) {
		modules.set(normalizedModulePath(module.file), EMPTY_MODULE_SYMBOLS());
	}
	const packageFactoryExports = (): Map<string, FactoryProvenance> =>
		new Map([...SUPABASE_CLIENT_FACTORIES].map((name) => [name, name as FactoryProvenance]));

	const addNamespace = (
		facts: ModuleSymbols,
		name: string,
		exports: Map<string, FactoryProvenance>
	) => {
		const existing = facts.factoryNamespaces.get(name);
		if (sameFactoryMap(existing, exports)) {
			return false;
		}
		facts.factoryNamespaces.set(name, new Map(exports));
		return true;
	};

	const resolveExports = (fromFile: string, specifier: string): Map<string, FactoryProvenance> => {
		const resolved = resolveModuleSpecifier(fromFile, specifier, knownFiles);
		return resolved ? (modules.get(resolved)?.factoryExports ?? new Map()) : new Map();
	};

	const applyExportDeclaration = (
		module: ParsedModule,
		facts: ModuleSymbols,
		statement: ts.ExportDeclaration
	): boolean => {
		const specifier = statement.moduleSpecifier;
		const source = specifier && ts.isStringLiteral(specifier) ? specifier.text : undefined;
		const sourceExports = source
			? SUPABASE_PACKAGES.has(source)
				? packageFactoryExports()
				: resolveExports(module.file, source)
			: new Map<string, FactoryProvenance>();
		let changed = false;

		if (!statement.exportClause) {
			for (const [name, provenance] of sourceExports) {
				changed = addFactoryBinding(facts.factoryExports, name, provenance) || changed;
			}
			return changed;
		}

		if (!ts.isNamedExports(statement.exportClause)) {
			return false;
		}
		for (const element of statement.exportClause.elements) {
			const importedName = element.propertyName?.text ?? element.name.text;
			const exportedName = element.name.text;
			let provenance: FactoryProvenance | undefined;
			if (source) {
				if (SUPABASE_PACKAGES.has(source) && SUPABASE_CLIENT_FACTORIES.has(importedName)) {
					provenance = importedName as FactoryProvenance;
				} else {
					provenance = sourceExports.get(importedName);
				}
			} else {
				provenance = facts.factoryBindings.get(importedName);
			}
			if (provenance) {
				changed = addFactoryBinding(facts.factoryExports, exportedName, provenance) || changed;
			}
		}
		return changed;
	};

	const applyModule = (module: ParsedModule, facts: ModuleSymbols): boolean => {
		let changed = false;
		for (const ast of module.asts) {
			const visit = (node: ts.Node): void => {
				if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
					const source = node.moduleSpecifier.text;
					const clause = node.importClause;
					if (!clause || clause.isTypeOnly) {
						return;
					}
					if (source.includes('supabase-admin')) {
						if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
							for (const element of clause.namedBindings.elements) {
								if (
									!element.isTypeOnly &&
									(element.propertyName?.text ?? element.name.text) === 'createAdminClient'
								) {
									changed =
										addFactoryBinding(facts.factoryBindings, element.name.text, 'admin-client') ||
										changed;
								}
							}
						}
						return;
					}
					if (SUPABASE_PACKAGES.has(source)) {
						if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
							facts.supabaseNamespaces.add(clause.namedBindings.name.text);
						}
						if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
							for (const element of clause.namedBindings.elements) {
								if (element.isTypeOnly) continue;
								const importedName = element.propertyName?.text ?? element.name.text;
								if (SUPABASE_CLIENT_FACTORIES.has(importedName)) {
									changed =
										addFactoryBinding(
											facts.factoryBindings,
											element.name.text,
											importedName as FactoryProvenance
										) || changed;
								}
							}
						}
						if (clause.name && SUPABASE_CLIENT_FACTORIES.has(clause.name.text)) {
							changed =
								addFactoryBinding(
									facts.factoryBindings,
									clause.name.text,
									clause.name.text as FactoryProvenance
								) || changed;
						}
					} else {
						const sourceExports = resolveExports(module.file, source);
						if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
							changed =
								addNamespace(facts, clause.namedBindings.name.text, sourceExports) || changed;
						}
						if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
							for (const element of clause.namedBindings.elements) {
								if (element.isTypeOnly) continue;
								const importedName = element.propertyName?.text ?? element.name.text;
								const provenance = sourceExports.get(importedName);
								if (provenance) {
									changed =
										addFactoryBinding(facts.factoryBindings, element.name.text, provenance) ||
										changed;
								}
							}
						}
					}
					return;
				}

				if (ts.isVariableDeclaration(node) && node.initializer) {
					const source = literalModuleSpecifier(node.initializer);
					if (source) {
						const sourceExports = SUPABASE_PACKAGES.has(source)
							? packageFactoryExports()
							: resolveExports(module.file, source);
						if (ts.isIdentifier(node.name)) {
							if (SUPABASE_PACKAGES.has(source)) {
								facts.supabaseNamespaces.add(node.name.text);
							} else {
								changed = addNamespace(facts, node.name.text, sourceExports) || changed;
							}
						} else {
							for (const { localName, importedName } of bindingElements(node.name)) {
								const provenance = sourceExports.get(importedName);
								if (provenance) {
									changed =
										addFactoryBinding(facts.factoryBindings, localName, provenance) || changed;
								}
							}
						}
					} else if (ts.isIdentifier(node.name)) {
						const provenance = factoryFromExpression(node.initializer, facts);
						if (provenance) {
							changed =
								addFactoryBinding(facts.factoryBindings, node.name.text, provenance) || changed;
						}
					}
				}

				if (ts.isExportDeclaration(node)) {
					changed = applyExportDeclaration(module, facts, node) || changed;
				}

				if (
					ts.isVariableStatement(node) &&
					node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
				) {
					for (const declaration of node.declarationList.declarations) {
						if (ts.isIdentifier(declaration.name)) {
							const provenance = facts.factoryBindings.get(declaration.name.text);
							if (provenance) {
								changed =
									addFactoryBinding(facts.factoryExports, declaration.name.text, provenance) ||
									changed;
							}
						}
					}
				}

				ts.forEachChild(node, visit);
			};
			visit(ast);
		}
		return changed;
	};

	const limit = Math.max(2, parsedModules.length * 2);
	for (let pass = 0; pass < limit; pass += 1) {
		let changed = false;
		for (const module of parsedModules) {
			const facts = modules.get(normalizedModulePath(module.file));
			if (facts) changed = applyModule(module, facts) || changed;
		}
		if (!changed) break;
	}

	return { modules };
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

function authClientExpression(expression: ts.Expression): ts.Expression | undefined {
	let current: ts.Expression | undefined = unwrapExpression(expression);

	while (current) {
		if (memberName(current) === 'auth') {
			return memberReceiver(current);
		}
		current = memberReceiver(current);
		if (current) {
			current = unwrapExpression(current);
		}
	}

	return undefined;
}

function isRecognizedFactoryCall(
	expression: ts.Expression,
	factoryNames: Set<string>,
	supabaseNamespaces: Set<string>,
	factoryNamespaces: Map<string, Map<string, FactoryProvenance>> = new Map()
): boolean {
	const call = unwrapExpression(expression);
	if (!ts.isCallExpression(call)) {
		return false;
	}

	if (ts.isIdentifier(call.expression)) {
		return factoryNames.has(call.expression.text);
	}

	return (
		ts.isPropertyAccessExpression(call.expression) &&
		ts.isIdentifier(call.expression.expression) &&
		((supabaseNamespaces.has(call.expression.expression.text) &&
			SUPABASE_CLIENT_FACTORIES.has(call.expression.name.text)) ||
			factoryNamespaces.get(call.expression.expression.text)?.has(call.expression.name.text))
	);
}

function isSupabaseClientType(type: ts.TypeNode | undefined, typeNames: Set<string>): boolean {
	if (!type) {
		return false;
	}

	const normalized = type.getText().replace(/\s/g, '');
	return [...typeNames].some(
		(name) =>
			normalized === name || normalized.startsWith(`${name}<`) || normalized.startsWith(`${name}[`)
	);
}

function isSupabaseClientExpression(
	expression: ts.Expression,
	supabaseClientNames: Set<string>,
	supabaseFactoryNames: Set<string>,
	supabaseNamespaces: Set<string>,
	factoryNamespaces: Map<string, Map<string, FactoryProvenance>> = new Map()
): boolean {
	const current = unwrapExpression(expression);
	if (ts.isCallExpression(current) && memberName(current.expression) === 'schema') {
		const schemaReceiver = memberReceiver(current.expression);
		return (
			schemaReceiver !== undefined &&
			isSupabaseClientExpression(
				schemaReceiver,
				supabaseClientNames,
				supabaseFactoryNames,
				supabaseNamespaces,
				factoryNamespaces
			)
		);
	}
	const segments = memberChainSegments(expression);
	const root = segments[0];
	return (
		(root !== undefined &&
			!segments.includes('auth') &&
			(supabaseClientNames.has(root) ||
				isSupabaseShapedName(root) ||
				segments.some((segment) => /supabase/i.test(segment)))) ||
		isRecognizedFactoryCall(expression, supabaseFactoryNames, supabaseNamespaces, factoryNamespaces)
	);
}

function isSupabaseAuthExpression(
	expression: ts.Expression,
	supabaseClientNames: Set<string>,
	supabaseAuthNames: Set<string>,
	supabaseFactoryNames: Set<string>,
	supabaseNamespaces: Set<string>,
	factoryNamespaces: Map<string, Map<string, FactoryProvenance>> = new Map()
): boolean {
	const segments = memberChainSegments(expression);
	const root = segments[0];
	const authIndex = segments.indexOf('auth');
	if (root !== undefined && supabaseAuthNames.has(root)) {
		return true;
	}
	const client = authClientExpression(expression);
	if (
		client &&
		isSupabaseClientExpression(
			client,
			supabaseClientNames,
			supabaseFactoryNames,
			supabaseNamespaces,
			factoryNamespaces
		)
	) {
		return true;
	}
	if (authIndex === -1 || root === undefined) {
		return false;
	}

	return (
		supabaseClientNames.has(root) ||
		segments.slice(0, authIndex).some((segment) => /supabase/i.test(segment))
	);
}

function isSupabaseAuthReceiver(
	receiver: ts.Expression,
	supabaseClientNames: Set<string>,
	supabaseAuthNames: Set<string>,
	supabaseFactoryNames: Set<string>,
	supabaseNamespaces: Set<string>,
	factoryNamespaces: Map<string, Map<string, FactoryProvenance>> = new Map()
): boolean {
	const segments = memberChainSegments(receiver);
	const authIndex = segments.indexOf('auth');
	const root = segments[0];
	const client = authClientExpression(receiver);
	return (
		(root !== undefined &&
			(supabaseAuthNames.has(root) ||
				(authIndex !== -1 &&
					(supabaseClientNames.has(root) ||
						segments.slice(0, authIndex).some((segment) => /supabase/i.test(segment)))))) ||
		(client !== undefined &&
			isSupabaseClientExpression(
				client,
				supabaseClientNames,
				supabaseFactoryNames,
				supabaseNamespaces,
				factoryNamespaces
			))
	);
}

function isSupabaseDataReceiver(
	receiver: ts.Expression | undefined,
	supabaseClientNames: Set<string>,
	supabaseFactoryNames: Set<string>,
	supabaseNamespaces: Set<string>,
	factoryNamespaces: Map<string, Map<string, FactoryProvenance>>
): boolean {
	if (!receiver) {
		return false;
	}
	return isSupabaseClientExpression(
		receiver,
		supabaseClientNames,
		supabaseFactoryNames,
		supabaseNamespaces,
		factoryNamespaces
	);
}

function literalResource(call: ts.CallExpression): string {
	const argument = call.arguments[0];
	return argument && ts.isStringLiteralLike(argument) ? argument.text : DYNAMIC_ACCESS_NAME;
}

function markupMemberName(expression: unknown): string | undefined {
	if (!expression || typeof expression !== 'object') {
		return undefined;
	}
	const member = expression as {
		type?: string;
		property?: { type?: string; name?: unknown; value?: unknown };
		computed?: boolean;
	};
	if (member.type !== 'MemberExpression' || !member.property) {
		return undefined;
	}
	if (member.property.type === 'Identifier' && typeof member.property.name === 'string') {
		return member.property.name;
	}
	if (
		member.computed &&
		member.property.type === 'Literal' &&
		typeof member.property.value === 'string'
	) {
		return member.property.value;
	}
	return undefined;
}

function markupMemberReceiver(expression: unknown): unknown {
	if (!expression || typeof expression !== 'object') {
		return undefined;
	}
	const member = expression as { type?: string; object?: unknown };
	return member.type === 'MemberExpression' ? member.object : undefined;
}

function unwrapMarkupExpression(expression: unknown): unknown {
	let current = expression as { type?: string; expression?: unknown } | undefined;
	while (
		current &&
		['ChainExpression', 'ParenthesizedExpression', 'TSAsExpression', 'TSTypeAssertion'].includes(
			current.type ?? ''
		)
	) {
		current = current.expression as { type?: string; expression?: unknown } | undefined;
	}
	return current;
}

function markupMemberChainSegments(expression: unknown): string[] {
	const segments: string[] = [];
	let current = unwrapMarkupExpression(expression) as { type?: string; name?: unknown } | undefined;
	while (current) {
		if (current.type === 'Identifier' && typeof current.name === 'string') {
			segments.unshift(current.name);
			break;
		}
		const name = markupMemberName(current);
		if (name) {
			segments.unshift(name);
			current = unwrapMarkupExpression(markupMemberReceiver(current)) as
				| { type?: string; name?: unknown }
				| undefined;
			continue;
		}
		if (current.type === 'CallExpression') {
			current = unwrapMarkupExpression((current as { callee?: unknown }).callee) as
				| { type?: string; name?: unknown }
				| undefined;
			continue;
		}
		break;
	}
	return segments;
}

function isRecognizedMarkupFactory(
	expression: unknown,
	supabaseFactoryNames: Set<string>,
	facts: ModuleSymbols
): boolean {
	const current = unwrapMarkupExpression(expression) as
		| { type?: string; callee?: unknown }
		| undefined;
	if (!current || current.type !== 'CallExpression') {
		return false;
	}
	const callee = unwrapMarkupExpression(current.callee) as
		| { type?: string; name?: unknown }
		| undefined;
	if (callee?.type === 'Identifier' && typeof callee.name === 'string') {
		return supabaseFactoryNames.has(callee.name);
	}
	const memberNameValue = markupMemberName(callee);
	const receiver = unwrapMarkupExpression(markupMemberReceiver(callee)) as
		| { type?: string; name?: unknown }
		| undefined;
	return (
		typeof memberNameValue === 'string' &&
		receiver?.type === 'Identifier' &&
		typeof receiver.name === 'string' &&
		((facts.supabaseNamespaces.has(receiver.name) &&
			SUPABASE_CLIENT_FACTORIES.has(memberNameValue)) ||
			facts.factoryNamespaces.get(receiver.name)?.has(memberNameValue))
	);
}

function isSupabaseMarkupClientExpression(
	expression: unknown,
	supabaseClientNames: Set<string>,
	supabaseFactoryNames: Set<string>,
	facts: ModuleSymbols
): boolean {
	const current = unwrapMarkupExpression(expression) as
		| {
				type?: string;
				name?: unknown;
				callee?: unknown;
		  }
		| undefined;
	if (!current) {
		return false;
	}
	if (current.type === 'Identifier' && typeof current.name === 'string') {
		return supabaseClientNames.has(current.name) || isSupabaseShapedName(current.name);
	}
	if (current.type !== 'CallExpression') {
		return false;
	}
	if (isRecognizedMarkupFactory(current, supabaseFactoryNames, facts)) {
		return true;
	}
	const callee = unwrapMarkupExpression(current.callee);
	if (markupMemberName(callee) === 'schema') {
		return isSupabaseMarkupClientExpression(
			markupMemberReceiver(callee),
			supabaseClientNames,
			supabaseFactoryNames,
			facts
		);
	}
	return false;
}

function markupAuthClientExpression(expression: unknown): unknown {
	const current = unwrapMarkupExpression(expression);
	if (markupMemberName(current) === 'auth') {
		return markupMemberReceiver(current);
	}
	const receiver = markupMemberReceiver(current);
	return receiver === undefined ? undefined : markupAuthClientExpression(receiver);
}

function isSupabaseMarkupAuthReceiver(
	receiver: unknown,
	supabaseClientNames: Set<string>,
	supabaseAuthNames: Set<string>,
	supabaseFactoryNames: Set<string>,
	facts: ModuleSymbols
): boolean {
	const segments = markupMemberChainSegments(receiver);
	const root = segments[0];
	if (root && supabaseAuthNames.has(root)) {
		return true;
	}
	const client = markupAuthClientExpression(receiver);
	return (
		client !== undefined &&
		isSupabaseMarkupClientExpression(client, supabaseClientNames, supabaseFactoryNames, facts)
	);
}

function markupRootName(expression: unknown): string | undefined {
	const segments = markupMemberChainSegments(expression);
	return segments[0];
}

function collectMarkupAccesses(
	fragment: unknown,
	file: string,
	supabaseClientNames: Set<string>,
	supabaseAuthNames: Set<string>,
	supabaseFactoryNames: Set<string>,
	facts: ModuleSymbols
): Access[] {
	if (!fragment) {
		return [];
	}
	const accesses = new Map<string, Access>();
	const record = (name: string | undefined) => {
		if (!name) {
			return;
		}
		const key = `markup|${name}`;
		if (!accesses.has(key)) {
			accesses.set(key, { file, kind: 'markup', name });
		}
	};
	const visit = (node: unknown): void => {
		if (!node || typeof node !== 'object') {
			return;
		}
		if (Array.isArray(node)) {
			for (const child of node) visit(child);
			return;
		}
		const recordNode = node as { type?: string; callee?: unknown };
		if (recordNode.type === 'CallExpression') {
			const callee = unwrapMarkupExpression(recordNode.callee);
			const method = markupMemberName(callee);
			const receiver = markupMemberReceiver(callee);
			if (
				receiver !== undefined &&
				(method === 'from' || method === 'rpc') &&
				isSupabaseMarkupClientExpression(receiver, supabaseClientNames, supabaseFactoryNames, facts)
			) {
				record(markupRootName(receiver) ?? method);
			} else if (
				receiver !== undefined &&
				isSupabaseMarkupAuthReceiver(
					receiver,
					supabaseClientNames,
					supabaseAuthNames,
					supabaseFactoryNames,
					facts
				)
			) {
				record(markupRootName(receiver) ?? method);
			} else if (isRecognizedMarkupFactory(callee, supabaseFactoryNames, facts)) {
				const factoryRoot = markupRootName(callee);
				record(factoryRoot ?? method ?? 'factory');
			}
		}
		for (const [key, value] of Object.entries(node)) {
			if (key === 'start' || key === 'end' || key === 'loc' || key === 'parent') continue;
			visit(value);
		}
	};
	visit(fragment);
	return [...accesses.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function scanParsedModule(module: ParsedModule, table: ModuleSymbolTable): Access[] {
	const accessesByKey = new Map<string, Access>();
	const facts = table.modules.get(normalizedModulePath(module.file)) ?? EMPTY_MODULE_SYMBOLS();
	const record = (kind: AccessKind, name: string) => {
		const key = `${kind}|${name}`;
		if (!accessesByKey.has(key)) {
			accessesByKey.set(key, { file: module.file, kind, name });
		}
	};

	const supabaseClientNames = new Set<string>(['supabase']);
	const supabaseAuthNames = new Set<string>();
	const supabaseFactoryNames = new Set<string>([
		'createAdminClient',
		...facts.factoryBindings.keys()
	]);
	const supabaseClientTypeNames = new Set<string>(['SupabaseClient']);

	for (const ast of module.asts) {
		const collectTypeNames = (node: ts.Node): void => {
			if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
				const clause = node.importClause;
				if (
					node.moduleSpecifier.text === '@supabase/supabase-js' &&
					clause?.namedBindings &&
					ts.isNamedImports(clause.namedBindings)
				) {
					for (const element of clause.namedBindings.elements) {
						const importedName = element.propertyName?.text ?? element.name.text;
						if (importedName === 'SupabaseClient') {
							supabaseClientTypeNames.add(element.name.text);
						}
					}
				}
			}
			if (
				ts.isTypeAliasDeclaration(node) &&
				isSupabaseClientType(node.type, supabaseClientTypeNames)
			) {
				supabaseClientTypeNames.add(node.name.text);
			}
			if (ts.isInterfaceDeclaration(node)) {
				const extendsSupabaseClient = node.heritageClauses?.some((clause) =>
					clause.types.some((type) => isSupabaseClientType(type, supabaseClientTypeNames))
				);
				if (extendsSupabaseClient) {
					supabaseClientTypeNames.add(node.name.text);
				}
			}
			if (
				ts.isTypeParameterDeclaration(node) &&
				node.constraint &&
				isSupabaseClientType(node.constraint, supabaseClientTypeNames)
			) {
				supabaseClientTypeNames.add(node.name.text);
			}
			ts.forEachChild(node, collectTypeNames);
		};
		collectTypeNames(ast);
	}

	const isRecognizedFactory = (expression: ts.Expression): boolean =>
		isRecognizedFactoryCall(
			expression,
			supabaseFactoryNames,
			facts.supabaseNamespaces,
			facts.factoryNamespaces
		);

	const collectClientBindings = (node: ts.Node): void => {
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
			if (isRecognizedFactory(node.initializer)) {
				supabaseClientNames.add(node.name.text);
			} else if (
				isSupabaseAuthExpression(
					node.initializer,
					supabaseClientNames,
					supabaseAuthNames,
					supabaseFactoryNames,
					facts.supabaseNamespaces,
					facts.factoryNamespaces
				)
			) {
				supabaseAuthNames.add(node.name.text);
			} else if (
				isSupabaseClientExpression(
					node.initializer,
					supabaseClientNames,
					supabaseFactoryNames,
					facts.supabaseNamespaces,
					facts.factoryNamespaces
				) ||
				isSupabaseClientType(node.type, supabaseClientTypeNames)
			) {
				supabaseClientNames.add(node.name.text);
			}
		}
		if (
			ts.isParameter(node) &&
			ts.isIdentifier(node.name) &&
			isSupabaseClientType(node.type, supabaseClientTypeNames)
		) {
			supabaseClientNames.add(node.name.text);
		}
		ts.forEachChild(node, collectClientBindings);
	};

	for (let pass = 0; pass < module.asts.length + 1; pass += 1) {
		for (const ast of module.asts) {
			collectClientBindings(ast);
		}
	}

	for (const access of collectMarkupAccesses(
		module.markupFragment,
		module.file,
		supabaseClientNames,
		supabaseAuthNames,
		supabaseFactoryNames,
		facts
	)) {
		record(access.kind, access.name);
	}

	for (const ast of module.asts) {
		const visit = (node: ts.Node): void => {
			if (
				(ts.isFunctionDeclaration(node) && node.name?.text === 'createAdminClient') ||
				(ts.isVariableDeclaration(node) &&
					ts.isIdentifier(node.name) &&
					node.name.text === 'createAdminClient')
			) {
				record('admin-client', 'createAdminClient');
			}

			if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
				const source = node.moduleSpecifier.text;
				const clause = node.importClause;
				if (clause && !clause.isTypeOnly && source.includes('supabase-admin')) {
					record('admin-client', 'createAdminClient');
				}
				if (clause && !clause.isTypeOnly && SUPABASE_PACKAGES.has(source)) {
					if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
						for (const element of clause.namedBindings.elements) {
							if (!element.isTypeOnly) {
								const importedName = element.propertyName?.text ?? element.name.text;
								if (SUPABASE_CLIENT_FACTORIES.has(importedName)) {
									record('client-factory', importedName);
								}
							}
						}
					}
				}
				if (
					clause &&
					!clause.isTypeOnly &&
					!SUPABASE_PACKAGES.has(source) &&
					!source.includes('supabase-admin')
				) {
					if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
						for (const element of clause.namedBindings.elements) {
							const provenance = facts.factoryBindings.get(element.name.text);
							if (provenance) {
								record(
									provenance === 'admin-client' ? 'admin-client' : 'client-factory',
									provenance === 'admin-client' ? 'createAdminClient' : provenance
								);
							}
						}
					}
				}
				return;
			}

			if (
				ts.isExportDeclaration(node) &&
				node.moduleSpecifier &&
				ts.isStringLiteral(node.moduleSpecifier)
			) {
				const source = node.moduleSpecifier.text;
				if (SUPABASE_PACKAGES.has(source)) {
					const exportedFactories =
						node.exportClause && ts.isNamedExports(node.exportClause)
							? node.exportClause.elements
									.map((element) => element.propertyName?.text ?? element.name.text)
									.filter((name) => SUPABASE_CLIENT_FACTORIES.has(name))
							: [...SUPABASE_CLIENT_FACTORIES];
					for (const factory of exportedFactories) {
						record('client-factory', factory);
					}
				} else if (facts.factoryExports.size > 0) {
					for (const element of node.exportClause && ts.isNamedExports(node.exportClause)
						? node.exportClause.elements
						: []) {
						const provenance = facts.factoryExports.get(element.name.text);
						if (provenance) {
							record(
								provenance === 'admin-client' ? 'admin-client' : 'client-factory',
								provenance === 'admin-client' ? 'createAdminClient' : provenance
							);
						}
					}
				}
				return;
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
					const provenance = facts.factoryBindings.get(node.expression.text);
					if (node.expression.text === 'createAdminClient' || provenance === 'admin-client') {
						record('admin-client', 'createAdminClient');
					} else if (provenance) {
						record('client-factory', provenance);
					}
				}
				const propertyProvenance = factoryFromProperty(node.expression, facts);
				if (propertyProvenance) {
					record(
						propertyProvenance === 'admin-client' ? 'admin-client' : 'client-factory',
						propertyProvenance === 'admin-client' ? 'createAdminClient' : propertyProvenance
					);
				}

				const name = memberName(node.expression);
				const receiver = memberReceiver(node.expression);
				if (
					name === 'from' &&
					isSupabaseDataReceiver(
						receiver,
						supabaseClientNames,
						supabaseFactoryNames,
						facts.supabaseNamespaces,
						facts.factoryNamespaces
					)
				) {
					record('table', literalResource(node));
				} else if (
					name === 'rpc' &&
					isSupabaseDataReceiver(
						receiver,
						supabaseClientNames,
						supabaseFactoryNames,
						facts.supabaseNamespaces,
						facts.factoryNamespaces
					)
				) {
					record('rpc', literalResource(node));
				} else if (
					receiver &&
					isSupabaseAuthReceiver(
						receiver,
						supabaseClientNames,
						supabaseAuthNames,
						supabaseFactoryNames,
						facts.supabaseNamespaces,
						facts.factoryNamespaces
					)
				) {
					record('auth-session', name ?? DYNAMIC_ACCESS_NAME);
				}
			}

			ts.forEachChild(node, visit);
		};
		visit(ast);
	}

	return [...accessesByKey.values()];
}

export function scanSource(source: string, file: string): Access[] {
	const module = parseModule(source, file);
	return scanParsedModule(module, buildModuleSymbolTable([module]));
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

	const modules: ParsedModule[] = [];
	for (const file of files) {
		const relPath = relative(rootDir, file).split('\\').join('/');
		if (!isRuntimeFile(relPath)) {
			continue;
		}
		modules.push(parseModule(readFileSync(file, 'utf8'), relPath));
	}

	const table = buildModuleSymbolTable(modules);
	const accesses = modules.flatMap((module) => scanParsedModule(module, table));

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

	const adminClientFiles = new Set(
		accesses.filter((access) => access.kind === 'admin-client').map((access) => access.file)
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
		if (access.kind === 'markup') {
			errors.push(
				`Supabase access in Svelte template markup is banned: ${accessKey(access)}. Move the expression into a script block so it can be scanned and classified.`
			);
			continue;
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
