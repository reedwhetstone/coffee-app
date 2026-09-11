import { decodeHTML } from 'entities';
import { newsletterSupplierName } from '$lib/newsletter';
import GithubSlugger from 'github-slugger';
import { marked, type Token, type Tokens } from 'marked';

import type { BlogPost, MarketBriefReaderExport } from '$lib/types/blog.types';
import { getBlogPostPath } from '$lib/types/blog.types';

export const MARKET_BRIEF_CANONICAL_ORIGIN = 'https://www.purveyors.io';

const rawMarketBriefSources = import.meta.glob<string>('/src/content/blog/market-brief-*.svx', {
	eager: true,
	query: '?raw',
	import: 'default'
});

const MAX_SOURCE_BYTES = 256 * 1024;
const FRONTMATTER_BOUNDARY = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

export function getRawMarketBriefSource(slug: string): string | undefined {
	return rawMarketBriefSources[`/src/content/blog/${slug}.svx`];
}

export function extractMarketBriefMarkdownBody(source: string): string {
	if (new TextEncoder().encode(source).byteLength > MAX_SOURCE_BYTES) {
		throw new Error(`Market Brief source exceeds ${MAX_SOURCE_BYTES} bytes`);
	}

	const boundary = source.match(FRONTMATTER_BOUNDARY);
	if (!boundary) {
		throw new Error('Market Brief source requires a closed YAML frontmatter block');
	}

	return source.slice(boundary[0].length).trim();
}

export function resolveMarketBriefHref(value: string, canonicalUrl: string): string {
	let resolved: URL;
	try {
		resolved = new URL(value, canonicalUrl);
	} catch {
		throw new Error(`Market Brief email link is invalid: ${value}`);
	}

	if (!['http:', 'https:', 'mailto:'].includes(resolved.protocol)) {
		throw new Error(`Market Brief email link uses an unsupported protocol: ${resolved.protocol}`);
	}

	return resolved.toString();
}

export function resolveMarketBriefImageSrc(value: string, canonicalUrl: string): string {
	let resolved: URL;
	try {
		resolved = new URL(value, canonicalUrl);
	} catch {
		throw new Error(`Market Brief email image is invalid: ${value}`);
	}

	if (resolved.protocol !== 'https:') {
		throw new Error('Market Brief email images must use HTTPS');
	}

	return resolved.toString();
}

function containsSvelteConstruct(tokens: Token[]): boolean {
	let braceDepth = 0;
	let foundBrace = false;

	marked.walkTokens(tokens, (token) => {
		if (token.type !== 'text') return;

		for (const character of token.text) {
			if (character === '{') {
				foundBrace = true;
				braceDepth += 1;
			} else if (character === '}') {
				if (braceDepth === 0) {
					foundBrace = true;
					continue;
				}
				braceDepth -= 1;
			}
		}
	});

	return foundBrace || braceDepth > 0;
}

function validateTokens(tokens: Token[], canonicalUrl: string): void {
	marked.walkTokens(tokens, (token) => {
		if (token.type === 'html') {
			throw new Error('Market Brief email source cannot contain raw HTML or Svelte markup');
		}
		if (token.type === 'checkbox' || (token.type === 'list_item' && token.task)) {
			throw new Error('Market Brief email source cannot contain task-list controls');
		}
		if (token.type === 'link') {
			resolveMarketBriefHref(token.href, canonicalUrl);
		}
		if (token.type === 'image') {
			resolveMarketBriefImageSrc(token.href, canonicalUrl);
		}
	});
}

export function tokenizeMarketBrief(source: string, canonicalUrl: string): Token[] {
	const markdown = extractMarketBriefMarkdownBody(source);
	const tokens = marked.lexer(markdown, { gfm: true, breaks: false });
	if (containsSvelteConstruct(tokens)) {
		throw new Error('Market Brief email source cannot contain Svelte expressions or directives');
	}
	const spotlights = tokens.filter(
		(token) =>
			token.type === 'heading' &&
			token.depth === 2 &&
			normalizeMarketBriefSectionTitle(token.tokens ?? []).toLowerCase() === 'research spotlight'
	);
	if (spotlights.length > 1) {
		throw new Error('Market Brief supports at most one Research Spotlight per edition');
	}
	validateTokens(tokens, canonicalUrl);
	return tokens;
}

function escapeStructuredHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function escapeStructuredMarkdown(value: string): string {
	return escapeStructuredHtml(value)
		.replace(/([\\`*_[\]{}()#+.!|>-])/g, '\\$1')
		.replace(/\r?\n/g, ' ');
}

// Structured frontmatter is plain text, not Markdown: construct tokens directly so
// punctuation, HTML, and Svelte-like strings cannot become executable markup.
export function withStructuredMarketBriefTokens(
	post: BlogPost,
	body: Token[],
	canonicalUrl: string
): Token[] {
	const text = (value: string): Tokens.Text => ({
		type: 'text',
		raw: value,
		text: escapeStructuredHtml(value)
	});
	const paragraph = (value: string): Tokens.Paragraph => ({
		type: 'paragraph',
		raw: `${escapeStructuredMarkdown(value)}\n\n`,
		text: value,
		tokens: [text(value)]
	});
	const heading = (value: string, depth: number): Tokens.Heading => ({
		type: 'heading',
		raw: `\n\n${'#'.repeat(depth)} ${escapeStructuredMarkdown(value)}\n\n`,
		depth,
		text: value,
		tokens: [text(value)]
	});
	const links = (entries: [string, string][]): Tokens.Paragraph => ({
		type: 'paragraph',
		raw: `${entries.map(([label, url]) => `[${escapeStructuredMarkdown(label)}](<${resolveMarketBriefHref(url, canonicalUrl).replaceAll('<', '%3C').replaceAll('>', '%3E')}>)`).join(' · ')}\n\n`,
		text: '',
		tokens: entries.flatMap(([label, url], index): Token[] => [
			...(index ? [text(' · ')] : []),
			{
				type: 'link',
				raw: '',
				text: label,
				href: resolveMarketBriefHref(url, canonicalUrl),
				tokens: [text(label)]
			}
		])
	});
	const result = [...body];
	const snapshot = post.marketSnapshot;
	if (snapshot) {
		result.unshift(
			heading('Market snapshot', 2),
			paragraph(`As of ${snapshot.asOf} · ${snapshot.scope}`),
			paragraph(
				`${snapshot.movementLabel}: ${snapshot.movementPercent > 0 ? '+' : ''}${snapshot.movementPercent}% · ${snapshot.listings} listings · ${snapshot.matchedListings} matched listings · ${snapshot.suppliers} suppliers`
			),
			paragraph(
				`${snapshot.totalSignals} signals: ${snapshot.belowBenchmark} below benchmark · ${snapshot.scoreOutliers} score outliers · ${snapshot.priceDrops} price drops`
			),
			links([
				['Price statistics', snapshot.priceStatsUrl],
				['Market signals', snapshot.signalsUrl]
			])
		);
	}
	if (post.coffeeHighlights?.length) {
		const coffees = post.coffeeHighlights.flatMap((coffee): Token[] => [
			heading(coffee.name, 3),
			paragraph(
				[
					newsletterSupplierName(coffee.supplier),
					coffee.origin,
					coffee.region,
					coffee.process,
					coffee.variety
				]
					.filter(Boolean)
					.join(' · ')
			),
			paragraph(coffee.rationale),
			paragraph(
				`Listed price for this edition: $${coffee.pricePerLb.toFixed(2)}/lb${coffee.priceContext ? ` · ${coffee.priceContext}` : ''}`
			),
			paragraph(coffee.stockedDate ? `Stocked ${coffee.stockedDate}` : 'Available when selected'),
			links([
				['View catalog coffee', coffee.catalogUrl],
				['Supplier listing', coffee.supplierUrl]
			])
		]);
		// Preserve legacy authored highlights; add the structured cards within that
		// section, or before sources when the web cards own all highlight content.
		const highlightIndex = result.findIndex(
			(token) =>
				token.type === 'heading' &&
				token.depth === 2 &&
				/^coffee highlights$/i.test(token.text.trim())
		);
		const nextSection =
			highlightIndex >= 0
				? result.findIndex(
						(token, index) => index > highlightIndex && token.type === 'heading' && token.depth <= 2
					)
				: result.findIndex(
						(token) =>
							token.type === 'heading' && token.depth === 2 && /^sources$/i.test(token.text.trim())
					);
		result.splice(
			nextSection < 0 ? result.length : nextSection,
			0,
			...(highlightIndex < 0 ? [heading('Coffee highlights', 2)] : []),
			...coffees
		);
	}
	return result;
}

function isRelativeMarkdownTarget(value: string): boolean {
	return !/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith('//');
}

function formatMarkdownTitle(title: string | null | undefined): string {
	return title === null || title === undefined
		? ''
		: ` "${title.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function normalizeMarkdownTarget(
	raw: string,
	href: string,
	title: string | null | undefined,
	canonicalUrl: string,
	resolveTarget: (value: string, baseUrl: string) => string
): string {
	if (!isRelativeMarkdownTarget(href)) return raw;

	const resolved = resolveTarget(href, canonicalUrl);
	const destinationStart = raw.indexOf('](');
	if (destinationStart < 0) return raw;

	return `${raw.slice(0, destinationStart + 2)}<${resolved}>${formatMarkdownTitle(title)})`;
}

function normalizeMarkdownDefinition(
	raw: string,
	href: string,
	title: string | null | undefined,
	canonicalUrl: string
): string {
	if (!isRelativeMarkdownTarget(href)) return raw;

	const resolved = resolveMarketBriefHref(href, canonicalUrl);
	const destinationStart = raw.indexOf(']:');
	if (destinationStart < 0) return raw;

	const lineBreakStart = raw.search(/\r?\n/);
	const trailing = lineBreakStart < 0 ? '' : raw.slice(lineBreakStart);
	return `${raw.slice(0, destinationStart + 2)} <${resolved}>${formatMarkdownTitle(title)}${trailing}`;
}

function normalizeMarkdownTargets(markdown: string, tokens: Token[], canonicalUrl: string): string {
	const replacements = new Map<string, string>();

	marked.walkTokens(tokens, (token) => {
		if (token.type === 'link') {
			const link = token as Tokens.Link;
			const normalized = normalizeMarkdownTarget(
				link.raw,
				link.href,
				link.title,
				canonicalUrl,
				resolveMarketBriefHref
			);
			if (normalized !== link.raw) replacements.set(link.raw, normalized);
		}
		if (token.type === 'image') {
			const image = token as Tokens.Image;
			const normalized = normalizeMarkdownTarget(
				image.raw,
				image.href,
				image.title,
				canonicalUrl,
				resolveMarketBriefImageSrc
			);
			if (normalized !== image.raw) replacements.set(image.raw, normalized);
		}
		if (token.type === 'def') {
			const definition = token as Tokens.Def;
			const normalized = normalizeMarkdownDefinition(
				definition.raw,
				definition.href,
				definition.title,
				canonicalUrl
			);
			if (normalized !== definition.raw) replacements.set(definition.raw, normalized);
		}
	});

	let normalized = markdown;
	for (const [raw, replacement] of replacements) {
		normalized = normalized.replaceAll(raw, replacement);
	}
	return normalized;
}

function inlineTokensText(tokens: Token[]): string {
	return tokens
		.map((token) => {
			switch (token.type) {
				case 'text': {
					const text = token as Tokens.Text;
					return text.tokens ? inlineTokensText(text.tokens) : decodeHTML(text.text);
				}
				case 'escape':
					return decodeHTML(token.text);
				case 'codespan':
					return token.text;
				case 'strong':
				case 'em':
				case 'del':
				case 'link':
					return inlineTokensText(token.tokens ?? []);
				case 'image':
					return decodeHTML(token.text);
				default:
					return 'tokens' in token && Array.isArray(token.tokens)
						? inlineTokensText(token.tokens)
						: '';
			}
		})
		.join('');
}

function normalizeMarketBriefSectionTitle(tokens: Token[]): string {
	return inlineTokensText(tokens).replace(/\s+/gu, ' ').trim();
}

export function buildMarketBriefReaderExport(
	post: BlogPost,
	source: string
): MarketBriefReaderExport {
	if (post.format !== 'market-brief' || post.edition === undefined) {
		throw new Error(`Blog post ${post.slug} is not a Market Brief edition`);
	}

	const canonicalUrl = `${MARKET_BRIEF_CANONICAL_ORIGIN}${getBlogPostPath(post.slug)}`;
	const markdown = extractMarketBriefMarkdownBody(source);
	const tokens = tokenizeMarketBrief(source, canonicalUrl);
	const slugger = new GithubSlugger();
	const sections: MarketBriefReaderExport['sections'] = [];

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		if (token.type !== 'heading' || (token as Tokens.Heading).depth !== 2) continue;

		const heading = token as Tokens.Heading;
		const title = normalizeMarketBriefSectionTitle(heading.tokens ?? []);
		const id = slugger.slug(title);
		if (title.toLowerCase() === 'sources') continue;

		const bodyTokens: Token[] = [];
		for (let bodyIndex = index + 1; bodyIndex < tokens.length; bodyIndex += 1) {
			const bodyToken = tokens[bodyIndex];
			if (bodyToken.type === 'heading' && (bodyToken as Tokens.Heading).depth === 2) break;
			bodyTokens.push(bodyToken);
		}

		const normalizedTitle = title.toLowerCase();
		sections.push({
			id,
			title,
			kind: normalizedTitle.startsWith('market read')
				? 'market-read'
				: normalizedTitle === 'research spotlight'
					? 'research-spotlight'
					: normalizedTitle === 'coffee highlights'
						? 'coffee-highlights'
						: 'take',
			html: marked.parser(bodyTokens)
		});
	}

	const portableTokens = withStructuredMarketBriefTokens(post, tokens, canonicalUrl);
	const portableMarkdown =
		post.marketSnapshot || post.coffeeHighlights?.length
			? portableTokens
					.map((token) => token.raw)
					.join('')
					.trim()
			: markdown;
	return {
		canonicalUrl,
		markdown: `${normalizeMarkdownTargets(portableMarkdown, portableTokens, canonicalUrl)}\n`,
		sections
	};
}
