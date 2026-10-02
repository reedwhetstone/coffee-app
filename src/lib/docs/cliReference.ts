// CLI command reference pages generated from the published @purveyors/cli manifest.
// The JSON snapshot is written at build time by scripts/generate-cli-reference.mjs;
// only manifest data is used here, never CLI runtime code (ADR-017).
import type {
	CliAuthRequirement,
	CliCommandContract,
	CliCommandGroupContract,
	CliManifest
} from '@purveyors/cli/manifest';
import snapshot from './generated/cli-manifest.json';
import type {
	DocsCallout,
	DocsContentSection,
	DocsLink,
	DocsNavItem,
	DocsPage,
	DocsTable
} from './types';

export interface CliReferenceSnapshot {
	packageName: string;
	version: string;
	nodeEngine: string | null;
	manifest: CliManifest;
}

export const CLI_REFERENCE = snapshot as unknown as CliReferenceSnapshot;
const manifest = CLI_REFERENCE.manifest;

/**
 * Implementation detail that must never reach a public CLI page: backing endpoints,
 * SDK plumbing, database table names, server ownership, and design references.
 * A test fails if any generated page matches.
 */
export const CLI_INTERNAL_COPY =
	/@purveyors\/sdk|\bSDK\b|\bBacked by\b|\/v1\/|PADR-\d|§\d|\bRPC\b|server-owned|server-side|canonical API|query layer|\b(?:coffee_catalog|green_coffee_inv|roast_data|coffee_sales)\b/;

/**
 * Customer-facing wording for manifest text written for CLI maintainers. Keys must
 * match a summary, description, ID source, or note in the pinned manifest exactly;
 * a null value drops a note. Remove an entry once the CLI rewrites or drops the text.
 */
export const CLI_COPY_REWRITES: Record<string, string | null> = {};

/**
 * Access levels where the pinned manifest contradicts the Parchment contract, keyed
 * by command path. An override applies only while the manifest still has the listed
 * value; remove it once a CLI release corrects the manifest.
 */
export const CLI_ACCESS_OVERRIDES: Record<string, { manifest: CliAuthRequirement; label: string }> =
	{};

function stripInternalClauses(text: string): string {
	return text
		.replace(/\s+(?:via|from|through) the canonical API\b/g, '')
		.replace(/,\s*enforced server-side(?:\s*\(\d{3}(?:\/\d{3})? on denial\))?/g, '');
}

/** Public wording for a manifest summary, description, or ID source. */
function publicText(text: string): string {
	const rewrite = CLI_COPY_REWRITES[text];
	return typeof rewrite === 'string' ? rewrite : stripInternalClauses(text);
}

/** Public wording for a manifest note, or null when the note only describes internals. */
function publicNote(note: string): string | null {
	if (note in CLI_COPY_REWRITES) return CLI_COPY_REWRITES[note];
	if (/^Backed by\b/.test(note)) return null;
	const text = stripInternalClauses(note);
	return CLI_INTERNAL_COPY.test(text) ? null : text;
}

function publicNotes(notes: readonly string[] | undefined): string[] {
	return (notes ?? []).map(publicNote).filter((note): note is string => Boolean(note));
}

interface CliPageContext {
	title: string;
	navSummary?: string;
	eyebrow: string;
	intro?: string[];
	callout?: DocsCallout;
	related?: DocsLink[];
}

const OVERVIEW_LINK: DocsLink = {
	href: '/docs/cli/overview',
	label: 'CLI overview',
	description: 'Install, sign in, and see every command group.'
};

const GROUP_CONTEXT: Record<string, CliPageContext> = {
	catalog: {
		title: 'Catalog commands',
		navSummary: 'Search, rank, and compare green coffees and suppliers.',
		eyebrow: 'Catalog data',
		intro: [
			'Search the normalized green coffee catalog, rank candidates, compare suppliers, and find similar coffees from your terminal. For no-login browsing, use the web catalog at https://purveyors.io/catalog.'
		],
		related: [
			{
				href: '/catalog',
				label: 'Web catalog',
				description: 'Browse the same catalog in the browser.'
			},
			{
				href: '/docs/catalog/purveyor-score',
				label: 'Purveyor Score',
				description: 'How the score used by rank commands is calculated.'
			},
			OVERVIEW_LINK
		]
	},
	inventory: {
		title: 'Inventory commands',
		navSummary: 'List and manage your green coffee inventory.',
		eyebrow: 'Member workflows',
		intro: [
			'Manage the green coffee inventory you see on the Beans page of the web app. Inventory IDs are separate from catalog IDs; roast and tasting commands expect inventory IDs.'
		],
		callout: {
			tone: 'warning',
			title: 'Use inventory IDs for roast work',
			body: 'purvey roast --coffee-id expects an inventory ID from purvey inventory list, not a catalog ID.'
		},
		related: [
			{
				href: '/docs/cli/roast',
				label: 'Roast commands',
				description: 'Inventory IDs feed roast create, import, and watch.'
			},
			{ href: '/beans', label: 'Beans page', description: 'Manage inventory in the web app.' },
			OVERVIEW_LINK
		]
	},
	roast: {
		title: 'Roast commands',
		navSummary: 'Record roasts, import Artisan files, and watch folders.',
		eyebrow: 'Roasting',
		intro: [
			'Record roast profiles, import Artisan .alog files with their curves and milestones, and watch a folder so new roasts are captured automatically.'
		],
		related: [
			{ href: '/roast', label: 'Roast page', description: 'Charts and profile editing.' },
			{
				href: '/docs/cli/sales',
				label: 'Sales commands',
				description: 'Record sales against roast IDs.'
			},
			OVERVIEW_LINK
		]
	},
	sales: {
		title: 'Sales commands',
		navSummary: 'Record and update roasted-coffee sales.',
		eyebrow: 'Sales',
		intro: [
			'Record roasted-coffee sales against roast profiles. Sales roll into the Profit page in the web app.'
		],
		related: [
			{ href: '/profit', label: 'Profit page', description: 'See margins built from sales.' },
			{
				href: '/docs/cli/roast',
				label: 'Roast commands',
				description: 'Find the roast IDs that sales reference.'
			},
			OVERVIEW_LINK
		]
	},
	tasting: {
		title: 'Tasting commands',
		navSummary: 'Read supplier notes and record your own cupping scores.',
		eyebrow: 'Tasting',
		intro: [
			'Read supplier tasting notes from the catalog and record your own cupping scores on inventory items.'
		],
		related: [
			{
				href: '/docs/cli/inventory',
				label: 'Inventory commands',
				description: 'Cupping scores are stored on inventory items.'
			},
			OVERVIEW_LINK
		]
	},
	market: {
		title: 'Market commands',
		navSummary: 'Value signals, price movement, trends, and evidence.',
		eyebrow: 'Market Index',
		intro: [
			'Check market value signals, price movement, metadata trends, and the evidence behind them. Summary views are open to everyone; filtered views require Parchment Intelligence access.'
		],
		related: [
			{
				href: '/analytics',
				label: 'Market Index',
				description: 'The same market data as charts in the web app.'
			},
			{
				href: '/docs/cli/price-index',
				label: 'Price index commands',
				description: 'Aggregate price snapshots and matched comparisons.'
			},
			OVERVIEW_LINK
		]
	},
	'price-index': {
		title: 'Price index commands',
		navSummary: 'Price snapshots, 30-day comparisons, and chart history.',
		eyebrow: 'Parchment Price Index',
		intro: [
			'Read Parchment Price Index snapshots, matched 30-day price comparisons, and chart history for origins and processes.'
		],
		related: [
			{
				href: '/docs/cli/market',
				label: 'Market commands',
				description: 'Value signals and movement statistics.'
			},
			OVERVIEW_LINK
		]
	},
	procurement: {
		title: 'Procurement commands',
		navSummary: 'Read saved sourcing briefs and their catalog matches.',
		eyebrow: 'Sourcing',
		intro: [
			'Read the sourcing briefs you have saved and page through the catalog coffees that match them.'
		],
		related: [OVERVIEW_LINK]
	},
	'reference-profile': {
		title: 'Reference profile commands',
		navSummary: 'Compare, preview, save, and export Studio reference plans.',
		eyebrow: 'Studio',
		intro: [
			'Work with Studio reference profiles: compare roasts against a reference, preview and save plan changes, and export an Artisan file for your next batch.'
		],
		related: [
			{
				href: '/docs/cli/roast',
				label: 'Roast commands',
				description: 'Import the roasts you compare against references.'
			},
			OVERVIEW_LINK
		]
	},
	skill: {
		title: 'Agent skill commands',
		navSummary: 'Print or install the Purveyors skill for AI agents.',
		eyebrow: 'Agent setup',
		intro: [
			'Print or install instructions that teach an AI agent the Purveyors commands, ID types, and output rules.'
		],
		related: [
			{
				href: '/docs/agents/setup',
				label: 'Set up your agent',
				description: 'The full install, sign-in, and skill setup flow.'
			},
			OVERVIEW_LINK
		]
	}
};

/** Groups rendered on combined pages instead of their own page. */
const COMBINED_PAGES: Array<{ slug: string; groups: string[] }> = [
	{ slug: 'auth-output', groups: ['auth', 'config'] },
	{ slug: 'context-manifest', groups: ['context', 'manifest'] }
];

const combinedGroupNames = new Set(COMBINED_PAGES.flatMap((page) => page.groups));

const ACCESS_LABELS: Record<CliAuthRequirement | 'mixed', string> = {
	none: 'None. Works without signing in.',
	viewer: 'Viewer. Any signed-in account.',
	member: 'Member. Requires member access on your account.',
	mixed: 'Varies by command.'
};

export function formatNodeRequirement(engine: string | null = CLI_REFERENCE.nodeEngine): string {
	const match = engine?.match(/^>=\s*(\d+)(?:\.0)*(?:\.0)?$/);
	if (match) return `Node.js ${match[1]} or later`;
	return engine ? `Node.js ${engine}` : 'a current Node.js LTS release';
}

function commandAccessLabel(path: string, auth: CliAuthRequirement): string {
	const override = CLI_ACCESS_OVERRIDES[path];
	return override?.manifest === auth ? override.label : ACCESS_LABELS[auth];
}

function titleCase(name: string): string {
	return name
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function groupContext(group: CliCommandGroupContract): CliPageContext {
	return (
		GROUP_CONTEXT[group.name] ?? {
			title: `${titleCase(group.name)} commands`,
			eyebrow: 'Command reference',
			related: [OVERVIEW_LINK]
		}
	);
}

function commandPath(group: CliCommandGroupContract, command: CliCommandContract): string {
	return command.name === group.name
		? `purvey ${group.name}`
		: `purvey ${group.name} ${command.name}`;
}

function usageLine(group: CliCommandGroupContract, command: CliCommandContract): string {
	const args = (command.arguments ?? []).map((arg) => {
		const token = arg.cliToken ?? arg.name;
		return arg.required ? `<${token}>` : `[${token}]`;
	});
	const parts = [commandPath(group, command), ...args];
	if (command.options?.length) parts.push('[options]');
	return parts.join(' ');
}

function sentence(text: string): string {
	const trimmed = text.trim();
	// A closing parenthesis ends a sentence only after its own punctuation: "(see above.)"
	return /[.!?]\)?$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function optionDetails(option: NonNullable<CliCommandContract['options']>[number]): string {
	const details: string[] = [];
	if (option.description) details.push(sentence(publicText(option.description)));
	if (option.requiredInFlagMode) details.push('Required unless you use --form.');
	if (option.defaultValue !== undefined) details.push(`Default: ${String(option.defaultValue)}.`);
	if (option.minimum !== undefined || option.maximum !== undefined) {
		details.push(`Range: ${option.minimum ?? '…'} to ${option.maximum ?? '…'}.`);
	}
	for (const note of publicNotes(option.notes)) details.push(sentence(note));
	return details.join(' ');
}

function commandTable(command: CliCommandContract): DocsTable | undefined {
	const rows: string[][] = [];
	for (const arg of command.arguments ?? []) {
		const token = arg.cliToken ?? arg.name;
		const label = arg.required ? `<${token}>` : `[${token}]`;
		rows.push([
			`\`${label}\``,
			`${arg.required ? 'Required' : 'Optional'}: ${sentence(publicText(arg.description))}`
		]);
	}
	for (const option of command.options ?? []) {
		rows.push([`\`${option.flags}\``, optionDetails(option)]);
	}
	if (!rows.length) return undefined;
	if (rows.every(([, details]) => !details)) {
		return { headers: ['Flags'], rows: rows.map(([flag]) => [flag]) };
	}
	return { headers: ['Argument or flag', 'Details'], rows };
}

function commandSection(
	group: CliCommandGroupContract,
	command: CliCommandContract
): DocsContentSection {
	const path = commandPath(group, command);
	const notes = publicNotes(command.notes);
	const section: DocsContentSection = {
		title: path,
		body: [
			sentence(publicText(command.summary)),
			`Usage: \`${usageLine(group, command)}\``,
			`Access: ${commandAccessLabel(path, command.auth)}`
		]
	};
	const table = commandTable(command);
	if (table) section.table = table;
	if (notes.length) section.bullets = notes.map(sentence);
	if (command.examples?.length) {
		section.codeBlocks = [
			{ label: 'Examples', language: 'bash', code: command.examples.join('\n') }
		];
	}
	return section;
}

export function getGroupCommands(group: CliCommandGroupContract): CliCommandContract[] {
	return [group.command, ...(group.subcommands ?? [])].filter(
		(command): command is CliCommandContract => Boolean(command)
	);
}

export function buildGroupSections(groupName: string): DocsContentSection[] {
	const group = manifest.commandGroups.find((candidate) => candidate.name === groupName);
	if (!group) return [];
	return getGroupCommands(group).map((command) => commandSection(group, command));
}

function groupPage(group: CliCommandGroupContract): DocsPage {
	const context = groupContext(group);
	return {
		section: 'cli',
		slug: group.name,
		title: context.title,
		summary: sentence(publicText(group.summary)),
		eyebrow: context.eyebrow,
		intro: [...(context.intro ?? []), `Access: ${ACCESS_LABELS[group.auth]}`],
		sections: [
			...(context.callout
				? [{ title: 'Before you start', callout: context.callout } satisfies DocsContentSection]
				: []),
			...buildGroupSections(group.name)
		],
		related: context.related ?? [OVERVIEW_LINK]
	};
}

/** Command-group pages in manifest order, excluding groups shown on combined pages. */
export function getCliGroupPages(): DocsPage[] {
	return manifest.commandGroups
		.filter((group) => !combinedGroupNames.has(group.name))
		.map(groupPage);
}

export function getCliGroupNavItems(): DocsNavItem[] {
	return getCliGroupPages().map((page) => ({
		slug: page.slug,
		title: page.title,
		summary: GROUP_CONTEXT[page.slug]?.navSummary ?? page.summary
	}));
}

/** Map of manifest command group to the docs page slug that documents it. */
export function getCliGroupPageSlugs(): Record<string, string> {
	const slugs: Record<string, string> = {};
	for (const group of manifest.commandGroups) {
		const combined = COMBINED_PAGES.find((page) => page.groups.includes(group.name));
		slugs[group.name] = combined?.slug ?? group.name;
	}
	return slugs;
}

export function buildCommandGroupTable(): DocsTable {
	const slugs = getCliGroupPageSlugs();
	return {
		headers: ['Group', 'What it does', 'Access', 'Reference'],
		rows: manifest.commandGroups.map((group) => [
			`\`purvey ${group.name}\``,
			sentence(publicText(group.summary)),
			ACCESS_LABELS[group.auth],
			`/docs/cli/${slugs[group.name]}`
		])
	};
}

export function buildWorkflowSection(): DocsContentSection {
	return {
		title: 'Common workflows',
		codeBlocks: manifest.workflows.map((workflow) => ({
			label: workflow.title,
			language: 'bash',
			code: workflow.commands.join('\n')
		}))
	};
}

export function buildOutputSections(): DocsContentSection[] {
	const { outputContract } = manifest;
	return [
		{
			title: 'Access roles',
			body: [
				'Commands list the access they need. purvey auth login stores a scoped key for your account; PARCHMENT_API_KEY or PURVEYORS_API_KEY overrides it when set.'
			],
			table: {
				headers: ['Role', 'Meaning'],
				rows: manifest.roles.map((role) => [role.role, sentence(publicText(role.description))])
			}
		},
		{
			title: 'Global options',
			table: {
				headers: ['Flag', 'Details'],
				rows: manifest.globalOptions.map((option) => [`\`${option.flags}\``, optionDetails(option)])
			}
		},
		{
			title: 'Output and errors',
			body: [
				`Standard output: ${sentence(publicText(outputContract.stdout))}`,
				`Standard error: ${sentence(publicText(outputContract.stderr))}`
			],
			bullets: publicNotes(outputContract.notes).map(sentence),
			callout: {
				tone: 'note',
				title: 'Structured errors',
				body: `${sentence(outputContract.structuredErrors.when)} Every error includes ${outputContract.structuredErrors.guaranteedFields.join(', ')}.${
					outputContract.structuredErrors.exception
						? ` ${sentence(outputContract.structuredErrors.exception)}`
						: ''
				}`
			}
		},
		{
			title: 'Exit codes',
			table: {
				headers: ['Exit code', 'Code', 'Meaning'],
				rows: manifest.exitCodes.map((code) => [
					String(code.exitCode),
					code.code,
					sentence(publicText(code.description))
				])
			}
		},
		{
			title: 'ID reference',
			body: [
				'Each ID belongs to one kind of record. Passing the wrong kind is the most common reason a command returns NOT_FOUND.'
			],
			table: {
				headers: ['ID', 'Identifies', 'Used by'],
				rows: manifest.idTypes.map((id) => [
					`\`${id.name}\``,
					publicText(id.source),
					id.usedBy.map((usage) => `\`${usage}\``).join(', ')
				])
			}
		},
		{
			title: 'Common errors',
			table: {
				headers: ['Problem', 'Exit codes', 'What to do'],
				rows: manifest.errorPatterns.map((pattern) => [
					pattern.title,
					pattern.exitCodes.join(', ') || 'None',
					pattern.guidance.map((line) => sentence(publicText(line))).join(' ')
				])
			}
		},
		{
			title: 'Local files',
			table: {
				headers: ['File', 'Path'],
				rows: [
					['Stored sign-in', manifest.files.credentials],
					['Settings', manifest.files.config]
				]
			}
		}
	];
}
