export const PUBLIC_PRODUCT_CATALOG = {
	mallardStudio: {
		productName: 'Mallard Studio',
		planName: 'Mallard Studio Member',
		monthlyPrice: 9,
		annualPrice: 80,
		monthlyPriceLabel: '$9/mo',
		annualPriceLabel: '$80/yr'
	},
	parchmentApi: {
		productName: 'Parchment API',
		freeTierName: 'Explorer',
		monthlyPrice: 99,
		monthlyPriceLabel: '$99/mo',
		enterpriseName: 'Enterprise',
		enterprisePriceLabel: 'Contact sales'
	},
	parchmentIntelligence: {
		productName: 'Parchment Intelligence',
		monthlyPrice: 39,
		annualPrice: 350,
		monthlyPriceLabel: '$39/mo',
		annualPriceLabel: '$350/yr'
	},
	enterprise: {
		name: 'Enterprise',
		priceLabel: 'Contact sales'
	}
} as const;

export const HOMEPAGE_PRICING_CARDS = [
	{
		key: 'mallard-studio',
		name: PUBLIC_PRODUCT_CATALOG.mallardStudio.productName,
		eyebrow: PUBLIC_PRODUCT_CATALOG.mallardStudio.planName,
		price: PUBLIC_PRODUCT_CATALOG.mallardStudio.monthlyPriceLabel,
		priceDetail: `${PUBLIC_PRODUCT_CATALOG.mallardStudio.annualPriceLabel} annual`,
		description:
			'Workflow, inventory, roast logging, tasting, profit, chat, and CLI access for roasters and operators.',
		features: [
			'Inventory, roast, tasting, and profit workflows',
			'Coffee Chat and shared workspace tools',
			'CLI access for operating workflows',
			'Annual option for lower effective monthly cost'
		],
		ctaLabel: 'Unlock Mallard Studio',
		href: '/subscription',
		highlighted: true,
		badge: 'Workflow product'
	},
	{
		key: 'parchment-api',
		name: PUBLIC_PRODUCT_CATALOG.parchmentApi.productName,
		eyebrow: `${PUBLIC_PRODUCT_CATALOG.parchmentApi.freeTierName} free baseline`,
		price: PUBLIC_PRODUCT_CATALOG.parchmentApi.monthlyPriceLabel,
		priceDetail: `${PUBLIC_PRODUCT_CATALOG.parchmentApi.freeTierName} is free`,
		description:
			'Normalized coffee data for apps, internal tools, and agents. Start free, then upgrade when you need production access.',
		features: [
			'Explorer free tier with no credit card required',
			'Production self-serve plan for sync jobs and integrations',
			'Parchment Console for API keys and usage',
			'Enterprise path for custom volume and integrations'
		],
		ctaLabel: 'Explore Parchment API',
		href: '/api',
		highlighted: false,
		badge: 'Developer product'
	},
	{
		key: 'parchment-intelligence',
		name: PUBLIC_PRODUCT_CATALOG.parchmentIntelligence.productName,
		eyebrow: 'Premium analytics layer',
		price: PUBLIC_PRODUCT_CATALOG.parchmentIntelligence.monthlyPriceLabel,
		priceDetail: `${PUBLIC_PRODUCT_CATALOG.parchmentIntelligence.annualPriceLabel} annual`,
		description:
			'Full analytics, price-index access, supplier comparison, and deeper market visibility for decision-making.',
		features: [
			'Full analytics and price-index access',
			'Supplier comparison and spread analysis',
			'Extended 90-day, 6-month, and 1-year trend views',
			"Roadmap features will ship on top of today's analytics value"
		],
		ctaLabel: 'Unlock Parchment Intelligence',
		href: '/subscription',
		highlighted: false,
		badge: 'Analytics product'
	},
	{
		key: 'enterprise',
		name: PUBLIC_PRODUCT_CATALOG.enterprise.name,
		eyebrow: 'Sales-led path',
		price: PUBLIC_PRODUCT_CATALOG.enterprise.priceLabel,
		priceDetail: 'No self-serve checkout',
		description:
			'Custom integrations, embedded analytics, higher-volume API access, and commercial support for serious operators.',
		features: [
			'Custom API and integration design',
			'Embedded analytics and reporting help',
			'Higher-volume usage planning',
			'Commercial support and procurement-friendly terms'
		],
		ctaLabel: 'Talk to us',
		href: '/contact',
		highlighted: false,
		badge: 'Custom engagement'
	}
] as const;

export const API_PUBLIC_PLANS = [
	{
		key: 'viewer',
		name: PUBLIC_PRODUCT_CATALOG.parchmentApi.freeTierName,
		accessLabel: 'Free baseline',
		price: 0,
		priceLabel: 'Free',
		monthlyRequests: '200',
		rowsPerCall: '25',
		bestFor: 'Evaluation, prototypes, and lightweight catalog pulls',
		description: 'Free baseline for trying the API and opening Parchment Console.'
	},
	{
		key: 'member',
		name: PUBLIC_PRODUCT_CATALOG.parchmentApi.productName,
		accessLabel: 'Self-serve production tier',
		price: PUBLIC_PRODUCT_CATALOG.parchmentApi.monthlyPrice,
		priceLabel: PUBLIC_PRODUCT_CATALOG.parchmentApi.monthlyPriceLabel,
		monthlyRequests: '10,000',
		rowsPerCall: 'Unlimited',
		bestFor: 'Production integrations, scheduled sync jobs, and agent workflows',
		description: 'Paid self-serve plan for production use and stronger usage allowances.'
	},
	{
		key: 'enterprise',
		name: PUBLIC_PRODUCT_CATALOG.parchmentApi.enterpriseName,
		accessLabel: 'Sales-led custom access',
		price: 0,
		priceLabel: PUBLIC_PRODUCT_CATALOG.parchmentApi.enterprisePriceLabel,
		monthlyRequests: 'Custom',
		rowsPerCall: 'Custom',
		bestFor: 'Custom integrations, embedded analytics, and larger commercial deployments',
		description: 'Contact sales for custom volume, delivery patterns, and commercial support.'
	}
] as const;

export type ApiPlanDisplayKey = (typeof API_PUBLIC_PLANS)[number]['key'];

export function getApiPlanDisplay(key: string | null | undefined) {
	return API_PUBLIC_PLANS.find((plan) => plan.key === key) ?? API_PUBLIC_PLANS[0];
}
