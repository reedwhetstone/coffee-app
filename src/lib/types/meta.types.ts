/**
 * Enhanced meta interface for SEO and rich results
 */
export interface PageMeta {
	// Basic SEO
	title?: string;
	description?: string;
	keywords?: string;
	canonical?: string;
	robots?: string;

	// Open Graph
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	ogImageAlt?: string;
	ogImageWidth?: number;
	ogImageHeight?: number;
	ogUrl?: string;
	ogType?: 'website' | 'article' | 'product' | 'profile';
	ogSiteName?: string;
	ogLocale?: string;

	// Twitter Cards
	twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player';
	twitterTitle?: string;
	twitterDescription?: string;
	twitterImage?: string;
	twitterImageAlt?: string;
	twitterSite?: string;
	twitterCreator?: string;

	// Structured Data
	structuredData?: Record<string, unknown>; // Legacy support
	schemaData?: object | object[];

	// Additional meta tags
	author?: string;
	viewport?: string;
	themeColor?: string;

	// Hreflang for international SEO
	hreflang?: Array<{
		lang: string;
		href: string;
	}>;

	// Article-specific (for blog posts, etc.)
	articlePublishedTime?: string;
	articleModifiedTime?: string;
	articleAuthor?: string;
	articleSection?: string;
	articleTags?: string[];

	// Product-specific (for coffee catalog, etc.)
	productPrice?: string;
	productCurrency?: string;
	productAvailability?: 'in stock' | 'out of stock' | 'preorder';
	productCondition?: 'new' | 'used' | 'refurbished';
	productBrand?: string;

	// Performance hints
	preconnect?: string[];
	dnsPrefetch?: string[];
}

/**
 * Helper function to generate default meta tags
 */
export function createDefaultMeta(overrides: Partial<PageMeta> = {}): PageMeta {
	return {
		title: 'Purveyors',
		description: 'Professional coffee roasting platform',
		ogType: 'website',
		ogSiteName: 'Purveyors',
		ogLocale: 'en_US',
		twitterCard: 'summary_large_image',
		robots: 'index, follow',
		viewport: 'width=device-width, initial-scale=1',
		themeColor: '#D97706',
		...overrides
	};
}

/**
 * Helper function to generate coffee product meta
 */
export function createCoffeeProductMeta(
	coffee: {
		name: string;
		description?: string;
		price?: number;
		availability?: boolean;
		origin?: string;
		roaster?: string;
		imageUrl?: string;
	},
	baseUrl: string
): PageMeta {
	const coffeeUrl = `${baseUrl}/coffee/${coffee.name.toLowerCase().replace(/\s+/g, '-')}`;
	const imageUrl = coffee.imageUrl || `${baseUrl}/og/default.png`;
	const imageAlt = `Preview image for ${coffee.name}`;

	return createDefaultMeta({
		title: `${coffee.name} - ${coffee.origin || 'Premium Coffee'} | Purveyors`,
		description:
			coffee.description ||
			`Premium ${coffee.name} coffee from ${coffee.origin || 'specialty origins'}. Available through Purveyors coffee platform.`,
		keywords: `${coffee.name}, ${coffee.origin}, green coffee, specialty coffee, ${coffee.roaster || 'premium coffee'}`,
		canonical: coffeeUrl,
		ogTitle: coffee.name,
		ogDescription:
			coffee.description || `Premium coffee from ${coffee.origin || 'specialty origins'}`,
		ogImage: imageUrl,
		ogImageAlt: imageAlt,
		ogUrl: coffeeUrl,
		ogType: 'product',
		twitterImage: imageUrl,
		twitterImageAlt: imageAlt,
		productPrice: coffee.price?.toString(),
		productCurrency: 'USD',
		productAvailability: coffee.availability ? 'in stock' : 'out of stock',
		productCondition: 'new',
		productBrand: coffee.roaster || 'Specialty Coffee'
	});
}

/**
 * Helper function to generate blog/article meta
 */
export function createArticleMeta(
	article: {
		title: string;
		description: string;
		author?: string;
		publishedDate?: string;
		modifiedDate?: string;
		section?: string;
		tags?: string[];
		imageUrl?: string;
	},
	baseUrl: string,
	articlePath: string
): PageMeta {
	const articleUrl = `${baseUrl}${articlePath}`;
	const imageUrl = article.imageUrl || `${baseUrl}/og/default.png`;
	const author = article.author || 'Reed Whetstone';
	const imageAlt = `Social preview for ${article.title}`;

	return createDefaultMeta({
		title: `${article.title} | Purveyors Blog`,
		description: article.description,
		keywords: article.tags?.join(', '),
		canonical: articleUrl,
		author,
		ogTitle: article.title,
		ogDescription: article.description,
		ogImage: imageUrl,
		ogImageAlt: imageAlt,
		ogUrl: articleUrl,
		ogType: 'article',
		twitterCard: 'summary_large_image',
		twitterTitle: article.title,
		twitterDescription: article.description,
		twitterImage: imageUrl,
		twitterImageAlt: imageAlt,
		articlePublishedTime: article.publishedDate,
		articleModifiedTime: article.modifiedDate ?? article.publishedDate,
		articleAuthor: author,
		articleSection: article.section,
		articleTags: article.tags
	});
}
