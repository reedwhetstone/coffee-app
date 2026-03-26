import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import type { PageMeta } from '$lib/types/meta.types';

export interface SocialImageMeta {
	path: string;
	url: string;
	alt: string;
	width: number;
	height: number;
}

interface ResolveSocialImageInput {
	baseUrl: string;
	path: string;
	alt: string;
	width?: number;
	height?: number;
}

interface ResolvePublicPageSocialImageInput {
	baseUrl: string;
	preferredPath?: string;
	alt?: string;
	width?: number;
	height?: number;
}

interface ResolveBlogPostSocialImageInput {
	baseUrl: string;
	slug: string;
	title: string;
}

interface BuildPublicMetaInput {
	baseUrl: string;
	path: string;
	title: string;
	description: string;
	keywords?: string | string[];
	ogTitle?: string;
	ogDescription?: string;
	twitterTitle?: string;
	twitterDescription?: string;
	type?: PageMeta['ogType'];
	image?: SocialImageMeta;
	twitterCard?: PageMeta['twitterCard'];
	robots?: string;
	author?: string;
	schemaData?: PageMeta['schemaData'];
	themeColor?: string;
	viewport?: string;
	preconnect?: string[];
	dnsPrefetch?: string[];
	article?: {
		publishedTime?: string;
		modifiedTime?: string;
		author?: string;
		section?: string;
		tags?: string[];
	};
}

export const DEFAULT_SOCIAL_IMAGE_PATH = '/og/default.jpg';
const DEFAULT_SOCIAL_IMAGE_ALT =
	'Purveyors green coffee marketplace, market intelligence, and API platform';
const DEFAULT_SOCIAL_IMAGE_WIDTH = 1200;
const DEFAULT_SOCIAL_IMAGE_HEIGHT = 627;

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/$/, '');
}

export function buildAbsoluteUrl(baseUrl: string, path = ''): string {
	if (/^https?:\/\//.test(path)) {
		return path;
	}

	const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
	if (!path) {
		return normalizedBaseUrl;
	}

	return `${normalizedBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function normalizeStaticPath(path: string): string {
	if (/^https?:\/\//.test(path)) {
		const url = new URL(path);
		return url.pathname;
	}

	return path.startsWith('/') ? path : `/${path}`;
}

function staticFileExists(path: string): boolean {
	const filePath = resolve(process.cwd(), 'static', normalizeStaticPath(path).slice(1));
	return existsSync(filePath);
}

function resolveSocialImage({
	baseUrl,
	path,
	alt,
	width = DEFAULT_SOCIAL_IMAGE_WIDTH,
	height = DEFAULT_SOCIAL_IMAGE_HEIGHT
}: ResolveSocialImageInput): SocialImageMeta {
	const normalizedPath = normalizeStaticPath(path);

	return {
		path: normalizedPath,
		url: buildAbsoluteUrl(baseUrl, normalizedPath),
		alt,
		width,
		height
	};
}

export function resolvePublicPageSocialImage({
	baseUrl,
	preferredPath,
	alt = DEFAULT_SOCIAL_IMAGE_ALT,
	width,
	height
}: ResolvePublicPageSocialImageInput): SocialImageMeta {
	const path =
		preferredPath && staticFileExists(preferredPath) ? preferredPath : DEFAULT_SOCIAL_IMAGE_PATH;

	return resolveSocialImage({
		baseUrl,
		path,
		alt,
		width,
		height
	});
}

export function resolveBlogPostSocialImage({
	baseUrl,
	slug,
	title
}: ResolveBlogPostSocialImageInput): SocialImageMeta {
	const candidates = [
		`/blog/images/${slug}/social.jpg`,
		`/blog/images/${slug}/social.png`,
		`/blog/images/${slug}/hero.webp`,
		`/blog/images/${slug}/hero.jpg`,
		`/blog/images/${slug}/hero.png`
	];
	const imagePath =
		candidates.find((candidate) => staticFileExists(candidate)) ?? DEFAULT_SOCIAL_IMAGE_PATH;

	return resolveSocialImage({
		baseUrl,
		path: imagePath,
		alt: `Social preview for ${title} on the Purveyors blog`
	});
}

function normalizeKeywords(keywords?: string | string[]): string | undefined {
	if (!keywords) {
		return undefined;
	}

	return Array.isArray(keywords) ? keywords.join(', ') : keywords;
}

export function buildPublicMeta({
	baseUrl,
	path,
	title,
	description,
	keywords,
	ogTitle,
	ogDescription,
	twitterTitle,
	twitterDescription,
	type = 'website',
	image,
	twitterCard = 'summary_large_image',
	robots = 'index, follow',
	author,
	schemaData,
	themeColor = '#D97706',
	viewport = 'width=device-width, initial-scale=1',
	preconnect,
	dnsPrefetch,
	article
}: BuildPublicMetaInput): PageMeta {
	const canonical = buildAbsoluteUrl(baseUrl, path);
	const resolvedImage =
		image ?? resolvePublicPageSocialImage({ baseUrl, alt: `Preview image for ${title}` });
	const normalizedKeywords = normalizeKeywords(keywords);

	return {
		title,
		description,
		keywords: normalizedKeywords,
		canonical,
		robots,
		author,
		viewport,
		themeColor,
		ogTitle: ogTitle ?? title,
		ogDescription: ogDescription ?? description,
		ogImage: resolvedImage.url,
		ogImageAlt: resolvedImage.alt,
		ogImageWidth: resolvedImage.width,
		ogImageHeight: resolvedImage.height,
		ogUrl: canonical,
		ogType: type,
		ogSiteName: 'Purveyors',
		ogLocale: 'en_US',
		twitterCard,
		twitterTitle: twitterTitle ?? ogTitle ?? title,
		twitterDescription: twitterDescription ?? ogDescription ?? description,
		twitterImage: resolvedImage.url,
		twitterImageAlt: resolvedImage.alt,
		schemaData,
		articlePublishedTime: article?.publishedTime,
		articleModifiedTime: article?.modifiedTime,
		articleAuthor: article?.author ?? author,
		articleSection: article?.section,
		articleTags: article?.tags,
		preconnect,
		dnsPrefetch
	};
}
