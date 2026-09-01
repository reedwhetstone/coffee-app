import { createHash } from 'node:crypto';

import { decodeHTML } from 'entities';
import { marked, type Token, type Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';

import type { BlogPost } from '$lib/types/blog.types';
import { formatMarketBriefEdition, getBlogPostPath } from '$lib/types/blog.types';
import {
	MARKET_BRIEF_CANONICAL_ORIGIN,
	resolveMarketBriefHref,
	resolveMarketBriefImageSrc,
	tokenizeMarketBrief
} from '$lib/server/marketBriefReader';

export {
	buildMarketBriefReaderExport,
	getRawMarketBriefSource,
	MARKET_BRIEF_CANONICAL_ORIGIN
} from '$lib/server/marketBriefReader';

export const MARKET_BRIEF_EMAIL_RENDERER_VERSION = 'market-brief-email-v1';
export const RESEND_UNSUBSCRIBE_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}';
const MAX_PROJECTION_BYTES = 512 * 1024;
const MAX_SUBJECT_LENGTH = 200;
const PRODUCTION_COMMIT = /^[0-9a-f]{40}$/;

const ALLOWED_TAGS = [
	'p',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'ul',
	'ol',
	'li',
	'blockquote',
	'strong',
	'em',
	'del',
	'a',
	'hr',
	'code',
	'pre',
	'img',
	'br',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td'
] as const;

const TAG_STYLES: Readonly<Record<string, string>> = {
	p: 'margin:0 0 18px;color:#3f3a34;font-family:Georgia,serif;font-size:17px;line-height:1.65;',
	h1: 'margin:32px 0 14px;color:#1f1b17;font-family:Georgia,serif;font-size:30px;line-height:1.2;',
	h2: 'margin:30px 0 12px;color:#1f1b17;font-family:Georgia,serif;font-size:25px;line-height:1.25;',
	h3: 'margin:26px 0 10px;color:#1f1b17;font-family:Georgia,serif;font-size:21px;line-height:1.3;',
	h4: 'margin:22px 0 8px;color:#1f1b17;font-family:Georgia,serif;font-size:18px;line-height:1.35;',
	h5: 'margin:20px 0 8px;color:#1f1b17;font-family:Georgia,serif;font-size:17px;line-height:1.35;',
	h6: 'margin:20px 0 8px;color:#1f1b17;font-family:Georgia,serif;font-size:16px;line-height:1.35;',
	ul: 'margin:0 0 18px;padding-left:24px;color:#3f3a34;font-family:Georgia,serif;font-size:17px;line-height:1.6;',
	ol: 'margin:0 0 18px;padding-left:24px;color:#3f3a34;font-family:Georgia,serif;font-size:17px;line-height:1.6;',
	li: 'margin:0 0 8px;',
	blockquote:
		'margin:24px 0;padding:14px 18px;border-left:4px solid #d97706;background-color:#fff8ed;color:#4f473f;font-family:Georgia,serif;font-size:17px;line-height:1.6;',
	a: 'color:#9a4d00;text-decoration:underline;',
	hr: 'margin:30px 0;border:0;border-top:1px solid #ddd4c8;',
	code: 'font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px;word-break:break-word;',
	pre: 'margin:22px 0;padding:16px;background-color:#211e1a;color:#f8f3ec;white-space:pre-wrap;word-break:break-word;',
	img: 'display:block;max-width:100%;height:auto;margin:24px auto;',
	table:
		'width:100%;margin:24px 0;border-collapse:collapse;color:#3f3a34;font-family:Georgia,serif;font-size:15px;line-height:1.45;',
	th: 'padding:9px;border:1px solid #ddd4c8;background-color:#fff8ed;text-align:left;',
	td: 'padding:9px;border:1px solid #ddd4c8;vertical-align:top;'
};

export interface MarketBriefEmailProjection {
	rendererVersion: typeof MARKET_BRIEF_EMAIL_RENDERER_VERSION;
	edition: number;
	slug: string;
	canonicalUrl: string;
	subject: string;
	previewText: string;
	html: string;
	text: string;
	sha256: string;
}

export interface MarketBriefDeploymentManifest {
	schemaVersion: 1;
	publication: 'market-brief';
	edition: number;
	slug: string;
	canonicalUrl: string;
	productionCommit: string;
	rendererVersion: typeof MARKET_BRIEF_EMAIL_RENDERER_VERSION;
	projectionSha256: string;
}

interface DeploymentEnvironment {
	[key: string]: string | undefined;
	VERCEL_ENV?: string;
	VERCEL_GIT_COMMIT_SHA?: string;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function transformTag(canonicalUrl: string) {
	return (tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag => {
		const transformed: sanitizeHtml.Attributes = { ...attribs };
		const style = TAG_STYLES[tagName];
		if (style) transformed.style = style;

		if (tagName === 'a' && Object.hasOwn(transformed, 'href')) {
			transformed.href = resolveMarketBriefHref(transformed.href, canonicalUrl);
			transformed.rel = 'noopener noreferrer';
		}
		if (tagName === 'img' && Object.hasOwn(transformed, 'src')) {
			transformed.src = resolveMarketBriefImageSrc(transformed.src, canonicalUrl);
		}

		return { tagName, attribs: transformed };
	};
}

function renderSanitizedFragment(tokens: Token[], canonicalUrl: string): string {
	const rendered = marked.parser(tokens, { gfm: true, breaks: false });
	const transforms = Object.fromEntries(
		ALLOWED_TAGS.map((tagName) => [tagName, transformTag(canonicalUrl)])
	);

	return sanitizeHtml(rendered, {
		allowedTags: [...ALLOWED_TAGS],
		allowedAttributes: {
			'*': ['style'],
			a: ['href', 'title', 'style', 'rel'],
			img: ['src', 'alt', 'title', 'width', 'height', 'style'],
			th: ['align', 'style'],
			td: ['align', 'style']
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowProtocolRelative: false,
		transformTags: transforms
	}).trim();
}

function tokenText(token: Token, canonicalUrl: string): string {
	switch (token.type) {
		case 'space':
			return '\n';
		case 'hr':
			return '\n---\n';
		case 'br':
			return '\n';
		case 'code':
		case 'codespan':
		case 'escape':
			return token.text;
		case 'text':
			return token.tokens ? tokensText(token.tokens, canonicalUrl) : decodeHTML(token.text);
		case 'strong':
		case 'em':
		case 'del':
			return tokensText((token as Tokens.Strong | Tokens.Em | Tokens.Del).tokens, canonicalUrl);
		case 'heading':
		case 'paragraph':
			return `${tokensText((token as Tokens.Heading | Tokens.Paragraph).tokens, canonicalUrl)}\n\n`;
		case 'blockquote':
			return `${tokensText((token as Tokens.Blockquote).tokens, canonicalUrl)
				.trim()
				.split('\n')
				.map((line) => `> ${line}`)
				.join('\n')}\n\n`;
		case 'link': {
			const link = token as Tokens.Link;
			const label = tokensText(link.tokens, canonicalUrl).trim();
			const href = resolveMarketBriefHref(link.href, canonicalUrl);
			return label === href ? href : `${label} (${href})`;
		}
		case 'image': {
			const image = token as Tokens.Image;
			return `[Image: ${decodeHTML(image.text || 'Market Brief image')}] (${resolveMarketBriefImageSrc(image.href, canonicalUrl)})`;
		}
		case 'list': {
			const list = token as Tokens.List;
			return `${list.items
				.map((item, index) => {
					const marker = list.ordered ? `${Number(list.start || 1) + index}.` : '-';
					return `${marker} ${tokensText(item.tokens, canonicalUrl).trim().replaceAll('\n', '\n  ')}`;
				})
				.join('\n')}\n\n`;
		}
		case 'list_item':
			return tokensText((token as Tokens.ListItem).tokens, canonicalUrl);
		case 'table': {
			const table = token as Tokens.Table;
			const rows = [table.header, ...table.rows];
			return `${rows
				.map((row) => row.map((cell) => tokensText(cell.tokens, canonicalUrl).trim()).join(' | '))
				.join('\n')}\n\n`;
		}
		case 'def':
		case 'html':
		case 'checkbox':
			return '';
		default:
			return 'tokens' in token && Array.isArray(token.tokens)
				? tokensText(token.tokens, canonicalUrl)
				: '';
	}
}

function tokensText(tokens: Token[], canonicalUrl: string): string {
	return tokens.map((token) => tokenText(token, canonicalUrl)).join('');
}

function renderText(tokens: Token[], canonicalUrl: string): string {
	const body = tokensText(tokens, canonicalUrl)
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	return `${body}\n\nRead this edition on Purveyors: ${canonicalUrl}\n\nUnsubscribe from Market Brief: ${RESEND_UNSUBSCRIBE_PLACEHOLDER}`;
}

function renderHtml(
	post: BlogPost,
	canonicalUrl: string,
	subject: string,
	fragment: string
): string {
	const edition = formatMarketBriefEdition(post.edition!);
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f0e8;color:#1f1b17;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(post.description)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background-color:#f5f0e8;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;border-collapse:collapse;background-color:#ffffff;">
<tr><td style="padding:36px 34px 14px;border-top:5px solid #d97706;">
<p style="margin:0 0 10px;color:#9a4d00;font-family:Arial,sans-serif;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Purveyors Market Brief · Edition ${edition}</p>
<h1 style="margin:0 0 14px;color:#1f1b17;font-family:Georgia,serif;font-size:34px;line-height:1.18;">${escapeHtml(post.title)}</h1>
<p style="margin:0;color:#625a52;font-family:Georgia,serif;font-size:18px;line-height:1.55;">${escapeHtml(post.description)}</p>
</td></tr>
<tr><td style="padding:18px 34px 30px;">${fragment}</td></tr>
<tr><td style="padding:24px 34px;border-top:1px solid #ddd4c8;background-color:#fffaf3;">
<p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:14px;line-height:1.5;"><a href="${escapeHtml(canonicalUrl)}" style="color:#9a4d00;text-decoration:underline;">Read this edition on Purveyors</a></p>
<p style="margin:0 0 8px;color:#625a52;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;">You are receiving this because you subscribed to Purveyors Market Brief.</p>
<p style="margin:0;color:#625a52;font-family:Arial,sans-serif;font-size:12px;line-height:1.5;"><a href="${RESEND_UNSUBSCRIBE_PLACEHOLDER}" style="color:#625a52;text-decoration:underline;">Unsubscribe from Market Brief</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function assertMarketBriefEmailSource(post: BlogPost, source: string): void {
	if (post.format !== 'market-brief' || post.edition === undefined) {
		throw new Error(`Blog post ${post.slug} is not a Market Brief edition`);
	}
	const canonicalUrl = `${MARKET_BRIEF_CANONICAL_ORIGIN}${getBlogPostPath(post.slug)}`;
	tokenizeMarketBrief(source, canonicalUrl);
}

export function buildMarketBriefEmailProjection(
	post: BlogPost,
	source: string
): MarketBriefEmailProjection {
	if (post.format !== 'market-brief' || post.edition === undefined) {
		throw new Error(`Blog post ${post.slug} is not a Market Brief edition`);
	}

	const canonicalUrl = `${MARKET_BRIEF_CANONICAL_ORIGIN}${getBlogPostPath(post.slug)}`;
	const tokens = tokenizeMarketBrief(source, canonicalUrl);
	const subject = `Market Brief ${formatMarketBriefEdition(post.edition)} · ${post.title}`;
	if (subject.length > MAX_SUBJECT_LENGTH) {
		throw new Error(`Market Brief email subject exceeds ${MAX_SUBJECT_LENGTH} characters`);
	}

	const fragment = renderSanitizedFragment(tokens, canonicalUrl);
	const text = renderText(tokens, canonicalUrl);
	const html = renderHtml(post, canonicalUrl, subject, fragment);
	if (Buffer.byteLength(html, 'utf8') > MAX_PROJECTION_BYTES) {
		throw new Error(`Market Brief email HTML exceeds ${MAX_PROJECTION_BYTES} bytes`);
	}

	const digestPayload = JSON.stringify({
		rendererVersion: MARKET_BRIEF_EMAIL_RENDERER_VERSION,
		edition: post.edition,
		slug: post.slug,
		canonicalUrl,
		subject,
		html,
		text
	});

	return {
		rendererVersion: MARKET_BRIEF_EMAIL_RENDERER_VERSION,
		edition: post.edition,
		slug: post.slug,
		canonicalUrl,
		subject,
		previewText: post.description,
		html,
		text,
		sha256: createHash('sha256').update(digestPayload, 'utf8').digest('hex')
	};
}

export function buildMarketBriefDeploymentManifest(
	projection: MarketBriefEmailProjection,
	environment: DeploymentEnvironment
): MarketBriefDeploymentManifest | undefined {
	if (
		environment.VERCEL_ENV !== 'production' ||
		!environment.VERCEL_GIT_COMMIT_SHA ||
		!PRODUCTION_COMMIT.test(environment.VERCEL_GIT_COMMIT_SHA)
	) {
		return undefined;
	}

	return {
		schemaVersion: 1,
		publication: 'market-brief',
		edition: projection.edition,
		slug: projection.slug,
		canonicalUrl: projection.canonicalUrl,
		productionCommit: environment.VERCEL_GIT_COMMIT_SHA,
		rendererVersion: projection.rendererVersion,
		projectionSha256: projection.sha256
	};
}
