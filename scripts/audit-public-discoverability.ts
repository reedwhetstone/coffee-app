import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

type RouteSpec = {
	label: string;
	path: string;
	expectArticleMeta?: boolean;
	expectInSitemap?: boolean;
	expectInLlms?: boolean;
};

type MetaTag = Record<string, string>;
type LinkTag = Record<string, string>;

type RouteAuditResult = {
	label: string;
	path: string;
	status: number;
	score: number;
	passedChecks: number;
	totalChecks: number;
	issues: string[];
};

type BlogInventory = {
	slug: string | null;
	tag: string | null;
};

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/$/, '');
}

function getBaseUrl(): string {
	const cliBaseUrl = process.argv[2];
	const envBaseUrl = process.env.AUDIT_BASE_URL;
	return normalizeBaseUrl(cliBaseUrl || envBaseUrl || 'http://127.0.0.1:4173');
}

function parseFrontmatterArray(fileContent: string, fieldName: string): string[] {
	const match = fileContent.match(new RegExp(`^${fieldName}:\\s*(\\[[^\\n]+\\])`, 'm'));
	if (!match) {
		return [];
	}

	try {
		return JSON.parse(match[1]) as string[];
	} catch {
		return [];
	}
}

function getBlogInventory(): BlogInventory {
	const blogDir = join(process.cwd(), 'src', 'content', 'blog');
	const files = readdirSync(blogDir)
		.filter((file) => file.endsWith('.svx'))
		.sort();

	const firstFile = files[0];
	if (!firstFile) {
		return { slug: null, tag: null };
	}

	const slug = firstFile.replace(/\.svx$/, '');
	const firstFileContent = readFileSync(join(blogDir, firstFile), 'utf8');
	const tags = parseFrontmatterArray(firstFileContent, 'tags');

	return {
		slug,
		tag: tags[0] ?? null
	};
}

function parseAttributes(tag: string): Record<string, string> {
	const attributes: Record<string, string> = {};

	for (const match of tag.matchAll(/([a-zA-Z0-9:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
		attributes[match[1].toLowerCase()] = match[3] ?? match[4] ?? '';
	}

	return attributes;
}

function extractHead(html: string): string {
	return html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
}

function extractTitle(head: string): string | undefined {
	return head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
}

function extractMetaTags(head: string): MetaTag[] {
	return Array.from(head.matchAll(/<meta\s+[^>]*>/gi), (match) => parseAttributes(match[0]));
}

function extractLinkTags(head: string): LinkTag[] {
	return Array.from(head.matchAll(/<link\s+[^>]*>/gi), (match) => parseAttributes(match[0]));
}

function getMetaContent(
	tags: MetaTag[],
	attrName: 'name' | 'property',
	attrValue: string
): string | undefined {
	return tags.find((tag) => tag[attrName] === attrValue)?.content;
}

function getLinkHref(tags: LinkTag[], relValue: string): string | undefined {
	return tags.find((tag) => tag.rel === relValue)?.href;
}

function hasStructuredData(head: string): boolean {
	return /<script[^>]+type=("|')application\/ld\+json\1/i.test(head);
}

function hasSingleH1(html: string): boolean {
	const matches = html.match(/<h1\b/gi) ?? [];
	return matches.length === 1;
}

async function fetchText(url: string): Promise<{ status: number; text: string }> {
	const response = await fetch(url, {
		headers: {
			'user-agent': 'PurveyorsDiscoverabilityAudit/1.0'
		}
	});

	return {
		status: response.status,
		text: await response.text()
	};
}

async function checkUrl(url: string): Promise<number | null> {
	try {
		const response = await fetch(url, {
			headers: {
				'user-agent': 'PurveyorsDiscoverabilityAudit/1.0'
			}
		});
		return response.status;
	} catch {
		return null;
	}
}

function isAbsoluteUrl(value: string | undefined): boolean {
	return Boolean(value && /^https?:\/\//.test(value));
}

function makeCheck(condition: boolean, issue: string, issues: string[]): number {
	if (!condition) {
		issues.push(issue);
		return 0;
	}

	return 1;
}

async function auditRoute(
	baseUrl: string,
	route: RouteSpec,
	sitemapText: string,
	llmsText: string
) {
	const url = `${baseUrl}${route.path}`;
	const { status, text } = await fetchText(url);
	const issues: string[] = [];

	if (status !== 200) {
		issues.push(`returned HTTP ${status}`);
		return {
			label: route.label,
			path: route.path,
			status,
			score: 0,
			passedChecks: 0,
			totalChecks: 1,
			issues
		} satisfies RouteAuditResult;
	}

	const head = extractHead(text);
	const metaTags = extractMetaTags(head);
	const linkTags = extractLinkTags(head);
	const ogImage = getMetaContent(metaTags, 'property', 'og:image');
	const ogType = getMetaContent(metaTags, 'property', 'og:type');
	const imageStatus = ogImage ? await checkUrl(ogImage) : null;
	const checks = [
		makeCheck(Boolean(extractTitle(head)), 'missing <title>', issues),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'name', 'description')),
			'missing meta description',
			issues
		),
		makeCheck(
			isAbsoluteUrl(getLinkHref(linkTags, 'canonical')),
			'missing or non-absolute canonical URL',
			issues
		),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'property', 'og:title')),
			'missing og:title',
			issues
		),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'property', 'og:description')),
			'missing og:description',
			issues
		),
		makeCheck(isAbsoluteUrl(ogImage), 'missing or non-absolute og:image', issues),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'property', 'og:image:alt')),
			'missing og:image:alt',
			issues
		),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'property', 'og:image:width')),
			'missing og:image:width',
			issues
		),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'property', 'og:image:height')),
			'missing og:image:height',
			issues
		),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'name', 'twitter:card')),
			'missing twitter:card',
			issues
		),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'name', 'twitter:title')),
			'missing twitter:title',
			issues
		),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'name', 'twitter:description')),
			'missing twitter:description',
			issues
		),
		makeCheck(
			isAbsoluteUrl(getMetaContent(metaTags, 'name', 'twitter:image')),
			'missing or non-absolute twitter:image',
			issues
		),
		makeCheck(
			Boolean(getMetaContent(metaTags, 'name', 'twitter:image:alt')),
			'missing twitter:image:alt',
			issues
		),
		makeCheck(hasStructuredData(head), 'missing JSON-LD structured data', issues),
		makeCheck(hasSingleH1(text), 'expected exactly one H1', issues),
		makeCheck(Boolean(ogType), 'missing og:type', issues),
		makeCheck(
			imageStatus === 200,
			`og:image did not return HTTP 200 (${imageStatus ?? 'error'})`,
			issues
		)
	];

	if (route.expectArticleMeta) {
		checks.push(
			makeCheck(
				Boolean(getMetaContent(metaTags, 'property', 'article:published_time')),
				'missing article:published_time',
				issues
			),
			makeCheck(
				Boolean(getMetaContent(metaTags, 'property', 'article:modified_time')),
				'missing article:modified_time',
				issues
			),
			makeCheck(
				Boolean(getMetaContent(metaTags, 'property', 'article:author')),
				'missing article:author',
				issues
			),
			makeCheck(
				metaTags.some((tag) => tag.property === 'article:tag'),
				'missing article:tag metadata',
				issues
			),
			makeCheck(
				ogType === 'article',
				`expected og:type=article but got ${ogType ?? 'missing'}`,
				issues
			)
		);
	}

	if (route.expectInSitemap) {
		checks.push(makeCheck(sitemapText.includes(url), 'route missing from sitemap.xml', issues));
	}

	if (route.expectInLlms) {
		checks.push(makeCheck(llmsText.includes(url), 'route missing from llms.txt', issues));
	}

	const passedChecks = checks.reduce((sum, value) => sum + value, 0);
	const totalChecks = checks.length;
	const score = Math.round((passedChecks / totalChecks) * 100);

	return {
		label: route.label,
		path: route.path,
		status,
		score,
		passedChecks,
		totalChecks,
		issues
	} satisfies RouteAuditResult;
}

async function main() {
	const baseUrl = getBaseUrl();
	const { slug, tag } = getBlogInventory();
	const sampleArticlePath = slug ? `/blog/${slug}` : '/blog';
	const sampleTagPath = tag ? `/blog/tag/${encodeURIComponent(tag)}` : '/blog';

	const routeSpecs: RouteSpec[] = [
		{ label: 'Homepage', path: '/', expectInSitemap: true },
		{ label: 'Catalog', path: '/catalog', expectInSitemap: true, expectInLlms: true },
		{ label: 'Analytics', path: '/analytics', expectInSitemap: true, expectInLlms: true },
		{ label: 'API', path: '/api', expectInSitemap: true, expectInLlms: true },
		{ label: 'Contact', path: '/contact', expectInSitemap: true },
		{ label: 'Blog index', path: '/blog', expectInSitemap: true, expectInLlms: true },
		{
			label: 'Sample blog article',
			path: sampleArticlePath,
			expectArticleMeta: true,
			expectInSitemap: true,
			expectInLlms: true
		},
		{ label: 'Sample blog tag page', path: sampleTagPath }
	];

	console.log(`Public discoverability audit for ${baseUrl}`);
	console.log('');

	const [{ text: sitemapText, status: sitemapStatus }, { text: llmsText, status: llmsStatus }] =
		await Promise.all([fetchText(`${baseUrl}/sitemap.xml`), fetchText(`${baseUrl}/llms.txt`)]);

	console.log(`Surface checks:`);
	console.log(`- sitemap.xml: HTTP ${sitemapStatus}`);
	console.log(`- llms.txt: HTTP ${llmsStatus}`);
	console.log('');

	const results = await Promise.all(
		routeSpecs.map((route) => auditRoute(baseUrl, route, sitemapText, llmsText))
	);

	for (const result of results) {
		const icon = result.issues.length === 0 ? '✅' : '⚠️';
		console.log(
			`${icon} ${result.label} (${result.path}) — ${result.passedChecks}/${result.totalChecks} checks passed, score ${result.score}`
		);
		for (const issue of result.issues) {
			console.log(`   - ${issue}`);
		}
	}

	const totalIssues = results.reduce((sum, result) => sum + result.issues.length, 0);
	const averageScore = Math.round(
		results.reduce((sum, result) => sum + result.score, 0) / results.length
	);

	console.log('');
	console.log(`Average score: ${averageScore}`);
	console.log(`Total issues: ${totalIssues}`);

	if (sitemapStatus !== 200 || llmsStatus !== 200 || totalIssues > 0) {
		process.exitCode = 1;
	}
}

await main();
