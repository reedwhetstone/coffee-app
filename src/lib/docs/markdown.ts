// Markdown rendering for docs pages. The HTML pages and these Markdown twins read the
// same DocsPage data from content.ts, so there is one source for both.
import {
	getDocsSection,
	getPublishedDocsPages,
	getPublishedDocsSections,
	type DocsContentSection,
	type DocsNavSection,
	type DocsPage,
	type DocsTable
} from './content';

export const MARKDOWN_HEADERS = {
	'content-type': 'text/markdown; charset=utf-8',
	'cache-control': 'public, max-age=300, s-maxage=3600'
} as const;

export function docsPagePath(page: Pick<DocsPage, 'section' | 'slug'>): string {
	return `/docs/${page.section}/${page.slug}`;
}

export function docsMarkdownPath(page: Pick<DocsPage, 'section' | 'slug'>): string {
	return `${docsPagePath(page)}.md`;
}

function absolute(href: string, origin: string): string {
	return href.startsWith('/') ? `${origin}${href}` : href;
}

/**
 * Escape Markdown-significant characters outside inline code: backslashes, and `<` so
 * placeholders like <uuid> are not read as HTML. Table cells also escape `|`, which
 * GFM requires even inside code spans.
 */
function escapeText(text: string, inTable = false): string {
	const proseChars = inTable ? /[\\<|]/g : /[\\<]/g;
	return text
		.split('`')
		.map((part, index) =>
			index % 2 === 0
				? part.replace(proseChars, (char) => `\\${char}`)
				: inTable
					? part.split('|').join('\\|')
					: part
		)
		.join('`');
}

function prose(text: string): string {
	return escapeText(text);
}

function escapeCell(cell: string): string {
	return escapeText(cell.replace(/\r?\n/g, ' '), true);
}

function renderTable(table: DocsTable): string {
	const header = `| ${table.headers.map(escapeCell).join(' | ')} |`;
	const divider = `| ${table.headers.map(() => '---').join(' | ')} |`;
	const rows = table.rows.map((row) => `| ${row.map(escapeCell).join(' | ')} |`);
	return [header, divider, ...rows].join('\n');
}

function fence(code: string, language = ''): string {
	const longestRun = Math.max(2, ...(code.match(/`+/g) ?? []).map((run) => run.length));
	const marker = '`'.repeat(longestRun + 1);
	return `${marker}${language}\n${code}\n${marker}`;
}

function renderSection(section: DocsContentSection): string {
	const blocks: string[] = [`## ${section.title}`];
	if (section.body?.length) blocks.push(...section.body.map(prose));
	if (section.bullets?.length) {
		blocks.push(section.bullets.map((item) => `- ${prose(item)}`).join('\n'));
	}
	if (section.table) blocks.push(renderTable(section.table));
	for (const code of section.codeBlocks ?? []) {
		if (code.label) blocks.push(`${code.label}:`);
		blocks.push(fence(code.code, code.language));
	}
	if (section.callout) {
		blocks.push(`> **${section.callout.title}**\n>\n> ${prose(section.callout.body)}`);
	}
	return blocks.join('\n\n');
}

export function renderDocsPageMarkdown(page: DocsPage, origin: string): string {
	const blocks: string[] = [
		`# ${page.title}`,
		`> ${prose(page.summary)}`,
		`HTML version: ${origin}${docsPagePath(page)}`,
		...page.intro.map(prose),
		...page.sections.map(renderSection)
	];
	if (page.related.length) {
		blocks.push(
			[
				'## Related',
				'',
				...page.related.map(
					(link) => `- [${link.label}](${absolute(link.href, origin)}): ${link.description}`
				)
			].join('\n')
		);
	}
	return `${blocks.join('\n\n')}\n`;
}

function renderSectionIndex(section: DocsNavSection, origin: string, heading = '##'): string {
	return [
		`${heading} ${section.title}`,
		'',
		section.description,
		'',
		...section.items.map(
			(item) => `- [${item.title}](${origin}${section.basePath}/${item.slug}.md): ${item.summary}`
		)
	].join('\n');
}

export function renderDocsSectionMarkdown(sectionKey: string, origin: string): string | undefined {
	const section = getDocsSection(sectionKey);
	if (!section || section.key === 'api') return undefined;
	return `${renderSectionIndex(section, origin, '#')}\n`;
}

export function renderDocsIndexMarkdown(origin: string): string {
	return `${[
		'# Purveyors documentation',
		'> Product, catalog methodology, CLI, and AI agent documentation for Purveyors. Every page below is plain Markdown.',
		`AI agents: to install the Purveyors CLI, sign in, and add the Purveyors skill, follow ${origin}/docs/agents/setup.md`,
		`Parchment API reference (OpenAPI): https://api.purveyors.io/docs`,
		`All pages in one file: ${origin}/llms-full.txt`,
		...getPublishedDocsSections().map((section) => renderSectionIndex(section, origin))
	].join('\n\n')}\n`;
}

export function renderLlmsFull(origin: string): string {
	const pages = getPublishedDocsPages();
	const header = [
		'# Purveyors documentation (full text)',
		'> Every Purveyors docs page as Markdown, in navigation order. For the Parchment HTTP API, see https://api.purveyors.io/docs.',
		`AI agents: to install the Purveyors CLI, sign in, and add the Purveyors skill, follow ${origin}/docs/agents/setup.md`
	].join('\n\n');
	const body = pages
		.map(
			(page) =>
				`---\n\nSource: ${origin}${docsMarkdownPath(page)}\n\n${renderDocsPageMarkdown(page, origin)}`
		)
		.join('\n');
	return `${header}\n\n${body}`;
}
