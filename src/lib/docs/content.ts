import { formatAllowedValues, PUBLIC_CATALOG_SORT_FIELDS } from '$lib/catalog/publicQueryContract';
import {
	DEFAULT_CATALOG_LISTING_LIMIT,
	DEFAULT_PAGINATED_PAGE_SIZE,
	MAX_CATALOG_PAGE_LIMIT
} from '$lib/constants/catalog';

const PUBLIC_CATALOG_SORT_FIELD_LIST = formatAllowedValues(PUBLIC_CATALOG_SORT_FIELDS);
const DEFAULT_CATALOG_SIMILARITY_THRESHOLD = 0.7;
const DEFAULT_CATALOG_SIMILARITY_LIMIT = 10;
const MAX_CATALOG_SIMILARITY_LIMIT = 25;

export type DocsSectionKey = 'api' | 'catalog' | 'cli';

export interface DocsCodeBlock {
	label?: string;
	language?: string;
	code: string;
}

export interface DocsTable {
	headers: string[];
	rows: string[][];
}

export interface DocsCallout {
	tone: 'note' | 'warning' | 'success';
	title: string;
	body: string;
}

export interface DocsContentSection {
	title: string;
	body?: string[];
	bullets?: string[];
	codeBlocks?: DocsCodeBlock[];
	table?: DocsTable;
	callout?: DocsCallout;
}

export interface DocsLink {
	href: string;
	label: string;
	description: string;
}

export interface DocsPage {
	section: DocsSectionKey;
	slug: string;
	title: string;
	summary: string;
	eyebrow: string;
	intro: string[];
	sections: DocsContentSection[];
	related: DocsLink[];
}

export interface DocsNavItem {
	slug: string;
	title: string;
	summary: string;
}

export interface DocsNavSection {
	key: DocsSectionKey;
	title: string;
	description: string;
	basePath: string;
	items: DocsNavItem[];
}

export const DOCS_NAV: DocsNavSection[] = [
	{
		key: 'api',
		title: 'API docs',
		description:
			'Public catalog and price-index contracts, internal route matrix, analytics, billing flows, auth, and operational guidance.',
		basePath: '/docs/api',
		items: [
			{
				slug: 'overview',
				title: 'Overview',
				summary: 'Public versus internal surfaces, auth modes, and how the product fits together.'
			},
			{
				slug: 'catalog',
				title: 'Catalog',
				summary:
					'The stable public /v1/catalog contract: fields, limits, compatibility aliases, headers, and query parameters.'
			},
			{
				slug: 'catalog-similarity',
				title: 'Catalog similarity',
				summary:
					'The beta /v1/catalog/{id}/similar endpoint for member and paid API matching workflows.'
			},
			{
				slug: 'procurement-briefs',
				title: 'Procurement briefs',
				summary:
					'User-owned saved sourcing criteria and manual catalog matches for procurement workflows.'
			},
			{
				slug: 'platform',
				title: 'Internal app routes',
				summary:
					'Authenticated and internal /api/* route matrix for catalog app flows, chat, workspaces, and tools.'
			},
			{
				slug: 'inventory',
				title: 'Inventory',
				summary: 'Inventory CRUD, share links, stocked-state recalculation, and ownership behavior.'
			},
			{
				slug: 'roast-profiles',
				title: 'Roast profiles',
				summary: 'Roast CRUD, Artisan import, chart data, clear flows, and AI classification.'
			},
			{
				slug: 'analytics',
				title: 'Analytics',
				summary:
					'The /analytics product surface and the session-auth roast analysis helpers behind it.'
			},
			{
				slug: 'billing-admin',
				title: 'Billing and admin',
				summary:
					'Stripe lifecycle routes, Console-adjacent flows, webhooks, and admin-only maintenance endpoints.'
			},
			{
				slug: 'errors',
				title: 'Errors and auth',
				summary: 'Status codes, auth edge cases, rate limits, and practical troubleshooting notes.'
			}
		]
	},
	{
		key: 'catalog',
		title: 'Catalog methodology',
		description:
			'Buyer-facing methodology for Purveyor Score, metadata quality, and catalog trust signals.',
		basePath: '/docs/catalog',
		items: [
			{
				slug: 'purveyor-score',
				title: 'Purveyor Score',
				summary:
					'How Purveyors scores listing metadata depth, structure, buyer usefulness, and confidence.'
			}
		]
	},
	{
		key: 'cli',
		title: 'CLI docs',
		description:
			'Install, authenticate, and use the Parchment CLI for catalog queries, inventory, roasting, scripting, and agent automation.',
		basePath: '/docs/cli',
		items: [
			{
				slug: 'overview',
				title: 'Overview',
				summary: 'Install, authenticate, and explore the CLI command structure.'
			},
			{
				slug: 'auth-output',
				title: 'Auth, config, and output',
				summary: 'Viewer versus member auth, local config, output modes, and scripting guarantees.'
			},
			{
				slug: 'catalog',
				title: 'Catalog',
				summary: 'Search the catalog from your terminal with an authenticated viewer session.'
			},
			{
				slug: 'inventory',
				title: 'Inventory',
				summary: 'List and manage your green coffee inventory.'
			},
			{
				slug: 'roast',
				title: 'Roast',
				summary: 'Create roast records, import Artisan files, and watch folders.'
			},
			{
				slug: 'sales',
				title: 'Sales',
				summary: 'Record and update roasted-coffee sales.'
			},
			{
				slug: 'tasting',
				title: 'Tasting',
				summary: 'Read supplier notes and record personal cupping data.'
			},
			{
				slug: 'context-manifest',
				title: 'Context and manifest',
				summary:
					'Dense reference text, machine-readable manifest output, and onboarding patterns for agents and wrappers.'
			},
			{
				slug: 'agent-integration',
				title: 'Agent integration',
				summary: 'Use the CLI as a stable interface for AI tools and external agents.'
			}
		]
	}
];

const docsPages: DocsPage[] = [
	{
		section: 'catalog',
		slug: 'purveyor-score',
		title: 'Purveyor Score',
		summary:
			'Purveyor Score is a metadata and listing-intelligence score for green coffee listings.',
		eyebrow: 'Catalog methodology',
		intro: [
			'Purveyor Score makes green coffee metadata quality visible at the point of comparison. It rewards structured, comparable, buyer-useful listing information because buyers cannot evaluate what suppliers do not disclose.',
			'The score is proprietary to Purveyors, deterministic, and intentionally narrow. It is not a cup quality score, supplier verification, certification, regulatory assurance, or a promise that a coffee is better than another coffee.',
			'This methodology follows the argument in Who Profits When Coffee Data Stays Scarce?: the industry has made progress on price transparency, but product metadata remains inconsistent and relationship-gated. Purveyor Score turns that disclosure gap into an inspectable product signal.'
		],
		sections: [
			{
				title: 'What it measures',
				body: [
					'Purveyor Score is scored from the normalized coffee_catalog metadata already used by the catalog, API, CLI, and analytics surfaces. It favors fields that help a buyer compare similar listings across suppliers: provenance, process transparency, freshness, pricing comparability, and sensory context.',
					'Confidence is separate from the score. Score measures metadata richness and buyer usefulness. Confidence measures how reliable and structured the inputs look, including recency, processing confidence, and evidence availability.'
				],
				table: {
					headers: ['Dimension', 'Max points', 'Examples'],
					rows: [
						[
							'Provenance depth',
							'25',
							'Country, region, farm or producer notes, cultivar, grade, and appearance.'
						],
						[
							'Process transparency',
							'25',
							'Base method, fermentation, additives, drying method, duration, disclosure level, and processing confidence.'
						],
						[
							'Freshness and availability',
							'20',
							'Stock status, stocked date, arrival date, and last-updated date.'
						],
						[
							'Pricing comparability',
							'15',
							'Per-pound price, tiered pricing, and wholesale classification.'
						],
						[
							'Sensory context',
							'15',
							'Tasting notes, supplier cup score when present, roast recommendations, and useful catalog descriptions.'
						]
					]
				}
			},
			{
				title: 'Tier language',
				table: {
					headers: ['Score', 'Tier', 'Meaning'],
					rows: [
						[
							'85-100',
							'Exceptional',
							'Deep, structured metadata across most buyer-relevant dimensions.'
						],
						['70-84', 'Strong', 'Enough structured disclosure for confident comparison.'],
						[
							'50-69',
							'Developing',
							'Useful listing, but key metadata is missing or less structured.'
						],
						[
							'1-49',
							'Limited',
							'Sparse metadata. Treat as a starting point, not a complete sourcing picture.'
						],
						['0', 'Unscored', 'No usable score inputs are available.']
					]
				}
			},
			{
				title: 'Why metadata matters',
				bullets: [
					'Price answers whether a transaction may be fair. Metadata answers whether this is the right coffee to buy.',
					'Decision-critical fields such as arrival date, farm provenance, processing detail, cup score, and cultivar are less consistently disclosed than broad fields such as country.',
					'Normalizing listings across suppliers makes both disclosed data and missing data visible. That visibility creates an incentive for richer disclosure.',
					'The scraper and audit loop behind Purveyors treats data quality as something measurable: extraction gaps, field completeness, format validation, and source health all become signals the product can improve over time.'
				],
				callout: {
					tone: 'warning',
					title: 'Not verification',
					body: 'Purveyor Score does not verify supplier claims, certify a coffee, replace buyer due diligence, or rate cup quality. It summarizes the listing intelligence Purveyors can currently see.'
				}
			},
			{
				title: 'Implementation contract',
				bullets: [
					'Purveyor Score v1 is stored on coffee_catalog as purveyor_score, purveyor_score_confidence, purveyor_score_tier, purveyor_score_factors, purveyor_score_version, and purveyor_score_updated_at.',
					'A database function computes the score from normalized fields and a trigger refreshes score fields when relevant metadata changes.',
					'The score can be recalculated when the formula changes. Consumers should read purveyor_score_version before comparing scores across major methodology updates.',
					'Raw supplier evidence remains withheld from public catalog responses unless a future product surface explicitly supports safe evidence inspection.'
				],
				codeBlocks: [
					{
						label: 'Response fragment',
						language: 'json',
						code: '{\n  "purveyor_score": 82,\n  "purveyor_score_tier": "Strong",\n  "purveyor_score_confidence": 0.78,\n  "purveyor_score_version": "purveyor-score-v1"\n}'
					}
				]
			}
		],
		related: [
			{
				href: '/catalog',
				label: 'Green Coffee Catalog',
				description: 'Browse the public catalog using the same score language.'
			},
			{
				href: '/docs/api/catalog',
				label: 'Catalog API',
				description: 'The public catalog contract that carries normalized listing data.'
			},
			{
				href: '/blog/who-profits-when-coffee-data-stays-scarce',
				label: 'Metadata scarcity thesis',
				description: 'The public essay that frames metadata as the real sourcing asymmetry.'
			}
		]
	},
	{
		section: 'api',
		slug: 'overview',
		title: 'API overview',
		summary:
			'Parchment ships stable public catalog and price-index APIs plus the internal route layer that powers the web app.',
		eyebrow: 'Parchment',
		intro: [
			'Parchment is the API and Console layer inside Purveyors. It exposes normalized green coffee catalog data, beta catalog similarity matching, and aggregate market intelligence through small public HTTP contracts plus a broader authenticated product backend. Those surfaces share domain logic, but they do not carry the same compatibility promises.',
			'The stable public catalog contract is GET /v1/catalog. Anonymous requests are supported for public discovery, while API-key requests are the intended production integration path because they carry plan enforcement and X-RateLimit-* usage headers. GET /v1/catalog/{id}/similar is a beta member and paid API route for candidate matching, not a canonical identity claim. GET /v1/price-index is a Parchment Intelligence API-key contract for aggregate price_index_snapshots data only. It does not expose raw supplier rows, CSV exports, alerts, or webhook support. Most /api/* routes exist to power the Purveyors web platform: catalog UI helpers, inventory, roast workflows, sales tracking, AI chat, workspaces, billing, and admin tooling.'
		],
		sections: [
			{
				title: 'Surface map',
				body: [
					'Treat the API model as two layers. /v1/* is the public namespace for external integrations. /api/* is the first-party application layer. Some /api/* routes are still externally reachable, but that does not make them stable public contracts.'
				],
				table: {
					headers: ['Surface', 'Auth', 'Audience', 'Contract'],
					rows: [
						[
							'GET /v1',
							'Anonymous, session, or API key',
							'External integrators and discovery',
							'Public namespace root. Advertises the v1 family.'
						],
						[
							'GET /v1/catalog',
							'Anonymous, session, or API key',
							'External integrations, CLI complements, first-party app',
							'Stable public contract.'
						],
						[
							'GET /v1/catalog/{id}/similar',
							'Member session or API key with API Origin or Enterprise and catalog:read',
							'Matching workflows, substitution research, and account-linked agents',
							'Beta public contract. Returns cautious candidates, score dimensions, and price deltas, not canonical identity decisions.'
						],
						[
							'GET /v1/price-index',
							'API key with Parchment Intelligence access',
							'External integrations and agent workflows consuming market aggregates',
							'Stable aggregate contract backed by price_index_snapshots. No raw supplier rows, CSV export, alerts, or webhooks.'
						],
						[
							'GET /api/catalog-api',
							'API key only',
							'Legacy callers only',
							'Deprecated API-key-only alias. Delegates to /v1/catalog with Deprecation and Sunset headers while remaining public-only. Sunset: Dec 31 2026.'
						],
						[
							'GET /api/catalog and /api/catalog/filters',
							'Anonymous or session; API key for /api/catalog only',
							'First-party catalog UI',
							'Internal compatibility layer. Do not treat as broad external promise.'
						],
						[
							'/api/beans, /api/roast-profiles, /api/profit',
							'Session-authenticated; ownership enforced on writes',
							'Authenticated product users',
							'Internal application routes.'
						],
						[
							'/api/chat, /api/workspaces, /api/tools/*',
							'Member session',
							'Paid workspace and AI workflows',
							'Internal product routes. /api/tools/* are deprecated compatibility shims.'
						],
						[
							'/api/stripe/* and /api/admin/*',
							'Session, webhook signature, or admin session depending on route',
							'Billing, operations, and support workflows',
							'Internal operational routes.'
						]
					]
				}
			},
			{
				title: 'Authentication model',
				bullets: [
					'GET /v1/catalog supports anonymous requests for public-only catalog discovery. Anonymous callers get the same public payload shape, but no API-key billing, quota, or X-RateLimit-* usage headers.',
					'GET /v1/catalog also supports first-party session requests. Viewer sessions stay public-only; member and admin sessions may unlock richer in-app visibility.',
					'GET /v1/catalog supports API-key requests via Authorization: Bearer <api_key>. API Green stays on the basic public query surface; paid API tiers add structured process facet filtering while remaining public-catalog scoped. API keys use plan-based limits and are the intended production path for server-to-server integrations.',
					'GET /v1/catalog/{id}/similar requires a member session or an API key with API Origin or Enterprise plus catalog:read. It returns beta similarity candidates for account-linked matching workflows; anonymous callers get 401 and viewer or API Green callers get 403.',
					'GET /v1/price-index requires an API key whose owner has Parchment Intelligence access. It returns aggregate price-index snapshots, not raw supplier-level rows.',
					'GET /api/catalog-api is a deprecated legacy alias to /v1/catalog, but it remains API-key-only for backward-compatible machine access.',
					'Cookies only matter when they resolve to a valid first-party session. A raw Cookie header is not part of the public API contract.',
					'Inventory share links are the one notable anonymous data exception on the product side: GET /api/beans?share=... can return a scoped inventory view without a user session.'
				],
				codeBlocks: [
					{
						label: 'Public catalog request',
						language: 'bash',
						code: 'curl https://purveyors.io/v1/catalog \\\n  -H "Authorization: Bearer pk_live_your_key_here"'
					}
				]
			},
			{
				title: 'Choose the right access mode',
				table: {
					headers: ['Surface', 'Best for', 'Auth', 'Operational contract'],
					rows: [
						[
							'Anonymous GET /v1/catalog',
							'Public discovery, quick evaluation, and proof-of-value embeds',
							'None',
							'Public-only data. No X-RateLimit-* headers or API-key usage accounting.'
						],
						[
							'API-key GET /v1/catalog',
							'Production integrations, sync jobs, and server-to-server tooling',
							'Authorization: Bearer <api_key>',
							'Public-only data with plan enforcement, X-RateLimit-* headers, and stable HTTP compatibility guarantees.'
						],
						[
							'API-key GET /v1/catalog/{id}/similar',
							'Beta similar-coffee matching and substitution research',
							'Authorization: Bearer <api_key> with API Origin or Enterprise plus catalog:read',
							'Plan-limited beta response with target, matches, score dimensions, match category, confidence labels, price_delta_1lb, X-RateLimit-* headers, and cautious copy.'
						],
						[
							'API-key GET /v1/price-index',
							'Market-intelligence integrations and agents',
							'Authorization: Bearer <api_key> plus Parchment Intelligence entitlement',
							'Aggregate price_index_snapshots data with pagination and rate-limit headers. No CSV, alerts, webhooks, or supplier-level rows.'
						],
						[
							'Session GET /v1/catalog',
							'First-party product reads that share the canonical resource',
							'Valid Purveyors session cookie',
							'Viewer sessions stay public-only. Member and admin sessions may unlock richer in-app visibility. First-party product path only; not the recommended external integration mode.'
						],
						[
							'purvey catalog',
							'Terminal workflows, account-linked agents, and stable command automation',
							'Authenticated viewer session',
							'CLI contract with explicit auth prompts and predictable stdout/stderr behavior. Use HTTP instead when anonymous or API-key access is the goal.'
						]
					]
				}
			},
			{
				title: 'How the product surfaces connect',
				bullets: [
					'/api is the public-facing product page for plans, positioning, and quick start.',
					'/api-dashboard is the Parchment Console for API keys, usage, subscriptions, and account-aware billing flows.',
					'/catalog and /analytics are end-user product surfaces that reflect the same coffee domain model as the API.',
					'/docs is the shared public documentation tree for both the HTTP API and @purveyors/cli.',
					'/llms.txt, /sitemap.xml, and /blog/feed.xml are anonymous discoverability endpoints for agents, crawlers, and feed readers. They expose navigation metadata, not integration data contracts.',
					'/auth/callback and /auth/cli-callback are OAuth handoff surfaces. They are part of login flow reliability, not REST API resources.',
					'The web app imports @purveyors/cli modules directly for chat tooling, so CLI and product behavior should stay aligned.'
				]
			}
		],
		related: [
			{
				href: '/docs/api/catalog',
				label: 'Catalog contract',
				description: 'Canonical /v1/catalog request and response reference.'
			},
			{
				href: '/docs/api/platform',
				label: 'Platform route matrix',
				description: 'Internal and authenticated /api/* route inventory.'
			},
			{
				href: '/api-dashboard',
				label: 'Parchment Console',
				description: 'Generate keys, inspect usage, and manage billing.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'Terminal workflows that complement the HTTP API.'
			}
		]
	},
	{
		section: 'api',
		slug: 'catalog',
		title: 'Catalog API',
		summary:
			'GET /v1/catalog is the stable public contract for normalized green coffee listings and tier-aware API access.',
		eyebrow: 'Public endpoint',
		intro: [
			'GET /v1/catalog is the canonical external endpoint. It returns normalized coffee listings with origin, legacy processing labels, structured process transparency fields, Purveyor Score metadata, pricing, price tiers, and availability metadata.',
			`The endpoint supports three canonical auth contexts: anonymous, first-party session, and API key. Anonymous, viewer-session, and API Green requests share the basic public catalog query surface. Member/admin sessions and paid API tiers additionally unlock structured process facet filters. Public callers can still inspect factual process fields in full rows; the gated feature is process search leverage, not data visibility. API-key requests use plan-based limits and are the intended production integration path because they emit X-RateLimit-* headers and durable quota metadata. When page and limit are both omitted, the canonical listing path defaults to page 1 and up to ${DEFAULT_CATALOG_LISTING_LIMIT} rows before any plan-based cap is applied. Explicit limit values above ${MAX_CATALOG_PAGE_LIMIT} are rejected with HTTP 400 so pagination metadata stays truthful.`,
			'Use include=proof when callers need compact proof-summary families for process, provenance, freshness, and pricing. Proof summaries are cautious catalog signals, not certifications, and raw supplier evidence remains withheld. Use GET /v1/catalog/proof-coverage when callers need aggregate proof label distributions and gap counts for the same visible catalog scope.'
		],
		sections: [
			{
				title: 'Namespace and compatibility',
				bullets: [
					'GET /v1 returns the public namespace descriptor and links callers to /v1/catalog and /v1/price-index.',
					'GET /v1/catalog is the source-of-truth public contract for integrations.',
					'GET /v1/catalog/proof-coverage returns aggregate proof-summary coverage for the visible catalog scope without raw evidence, supplier quotes, certification language, or row-level proof search leverage.',
					'GET /v1/catalog/{id}/similar is the beta matching endpoint in the catalog family. It is not anonymous, and it should be presented as candidate discovery rather than accepted identity resolution.',
					'GET /api/catalog-api is a deprecated API-key-only alias to the canonical handler. Responses include Deprecation: true, Link: </v1/catalog>; rel="successor-version", and Sunset: Thu, 31 Dec 2026 23:59:59 GMT.',
					'GET /api/catalog also delegates to the same catalog resource, but it is an internal adapter with legacy response-shape behavior and should not be treated as a long-term external contract.'
				],
				callout: {
					tone: 'note',
					title: 'External integrations should target /v1/catalog',
					body: 'If a caller currently uses /api/catalog-api or /api/catalog, migrate it to /v1/catalog. The v1 route is the compatibility promise. The others are transitional or first-party adapters.'
				}
			},
			{
				title: 'Request and response',
				body: [
					'The canonical response includes data, pagination, and meta blocks. The meta block reports auth kind, role, plan, access scope, row-limit state, and cache metadata.',
					'Full catalog rows include legacy structured processing fields, Purveyor Score fields, plus a nested process object. Null values stay null when the supplier has not disclosed structured metadata. process.evidence_available reports whether internal provenance exists without exposing raw evidence quotes in the public response.',
					'The example below shows an API-key response. Anonymous and session responses keep the same top-level shape. The main differences are headers and search leverage: only API-key requests emit X-RateLimit-* headers, and only member/admin sessions or paid API tiers can use structured process facet filters.',
					`Viewer-tier API keys are capped to 25 rows per call and cannot use structured process facet filters. Member and enterprise API plans remove that lower plan cap and unlock process facet filters, while still sharing the ${MAX_CATALOG_PAGE_LIMIT}-row per-request ceiling. Anonymous and viewer-session requests are public-only unless a privileged member session explicitly enables richer first-party visibility.`,
					'Cookies are not part of the public API contract. They only matter when they resolve to a valid first-party session, and the legacy /api/catalog-api alias does not accept session auth as a substitute for an API key.'
				],
				codeBlocks: [
					{
						label: 'GET /v1/catalog',
						language: 'json',
						code: '{\n  "data": [\n    {\n      "id": 128,\n      "name": "Ethiopia Guji",\n      "region": "Guji",\n      "processing": "Natural",\n      "drying_method": "Raised beds",\n      "purveyor_score": 82,\n      "purveyor_score_tier": "Strong",\n      "purveyor_score_confidence": 0.78,\n      "purveyor_score_version": "purveyor-score-v1",\n      "process": {\n        "base_method": "Natural",\n        "fermentation_type": "Anaerobic",\n        "additives": null,\n        "additive_detail": null,\n        "fermentation_duration_hours": 72,\n        "drying_method": "Raised beds",\n        "notes": "Anaerobic natural process disclosed by supplier notes",\n        "disclosure_level": "high_detail",\n        "confidence": 0.92,\n        "evidence_available": true\n      },\n      "price_per_lb": 7.5,\n      "price_tiers": [{ "min_lbs": 1, "price": 7.5 }],\n      "stocked": true,\n      "source": "sweet_marias",\n      "country": "Ethiopia",\n      "continent": "Africa"\n    }\n  ],\n  "pagination": {\n    "page": 1,\n    "limit": 25,\n    "total": 814,\n    "totalPages": 33,\n    "hasNext": true,\n    "hasPrev": false\n  },\n  "meta": {\n    "resource": "catalog",\n    "namespace": "/v1/catalog",\n    "version": "v1",\n    "auth": { "kind": "api-key", "role": "viewer", "apiPlan": "viewer" },\n    "access": {\n      "publicOnly": true,\n      "showWholesale": false,\n      "wholesaleOnly": false,\n      "rowLimit": 25,\n      "limited": true,\n      "totalAvailable": 814\n    },\n    "cache": { "hit": false, "timestamp": null }\n  }\n}'
					},
					{
						label: 'GET /v1/catalog?fields=dropdown&page=2&limit=2',
						language: 'json',
						code: '{\n  "data": [\n    {\n      "id": 205,\n      "source": "sweet_marias",\n      "name": "Kenya Nyeri AB",\n      "stocked": true,\n      "cost_lb": 8.1,\n      "price_per_lb": 8.1,\n      "price_tiers": [{ "min_lbs": 1, "price": 8.1 }],\n      "public_coffee": true\n    },\n    {\n      "id": 204,\n      "source": "cafe_imports",\n      "name": "Colombia Huila Washed",\n      "stocked": true,\n      "cost_lb": 7.65,\n      "price_per_lb": 7.65,\n      "price_tiers": [{ "min_lbs": 1, "price": 7.65 }],\n      "public_coffee": true\n    }\n  ],\n  "pagination": {\n    "page": 2,\n    "limit": 2,\n    "total": 814,\n    "totalPages": 407,\n    "hasNext": true,\n    "hasPrev": true\n  },\n  "meta": {\n    "resource": "catalog",\n    "namespace": "/v1/catalog",\n    "version": "v1",\n    "auth": { "kind": "anonymous", "role": null, "apiPlan": null },\n    "access": {\n      "publicOnly": true,\n      "showWholesale": false,\n      "wholesaleOnly": false,\n      "rowLimit": null,\n      "limited": false,\n      "totalAvailable": 814\n    },\n    "cache": { "hit": false, "timestamp": null }\n  }\n}'
					}
				]
			},
			{
				title: 'Query parameters',
				body: [
					`The table below describes the full canonical query surface. If page is supplied without limit, the route uses a ${DEFAULT_PAGINATED_PAGE_SIZE}-row pagination fallback. If both page and limit are omitted, the canonical listing path uses the ${DEFAULT_CATALOG_LISTING_LIMIT}-row default listing contract.`,
					'Anonymous, viewer-session, and API Green requests share the basic public query surface. Structured process facet filters are gated to member/admin sessions and paid API tiers.',
					'fields=dropdown stays compatible with normal page and limit params. The reduced projection is limited to id, source, name, stocked, cost_lb, price_per_lb, price_tiers, and public_coffee.',
					'include=proof is opt-in. Default full rows keep their existing shape, while proof requests add a cautious proof object with process, provenance, freshness, and pricing families plus explicit limitations.',
					'Privileged member and admin sessions may additionally use showWholesale and wholesaleOnly to widen first-party visibility. Paid API tiers unlock process facet filters but remain public-catalog scoped.',
					`Malformed typed params now fail closed with 400 responses instead of silently falling back or bubbling into generic 500s. That applies to include, fields, stocked, showWholesale, wholesaleOnly, has_additives, sortField, sortDirection, page, limit, stocked_date, stocked_days, score_value_min, score_value_max, price_per_lb_min, price_per_lb_max, processing_confidence_min, and deprecated cost_lb aliases. Supported sortField values are ${PUBLIC_CATALOG_SORT_FIELD_LIST}.`
				],
				table: {
					headers: ['Parameter', 'Type', 'Default', 'Description'],
					rows: [
						['page', 'integer', '1', 'Page number for paginated results.'],
						[
							'limit',
							'integer',
							'100 when page and limit are both omitted; otherwise 15 fallback',
							`Rows per page before any plan cap is applied, up to ${MAX_CATALOG_PAGE_LIMIT}. Values above ${MAX_CATALOG_PAGE_LIMIT} return 400.`
						],
						[
							'ids',
							'integer (repeatable)',
							'none',
							'Fetch specific catalog IDs. When present, pagination is ignored and results are sorted by name ascending.'
						],
						[
							'fields',
							'full | dropdown',
							'full',
							'dropdown returns the reduced projection used by filter UIs and select menus (id, source, name, stocked, cost_lb, price_per_lb, price_tiers, public_coffee), and it works with normal page and limit params. Invalid values return 400.'
						],
						[
							'include',
							'proof',
							'none',
							'Opt-in proof summaries for full catalog rows. Unsupported include values return 400. Proof summaries include cautious family signals and limitations, not raw evidence or certification claims.'
						],
						[
							'stocked',
							'true | false | all',
							'true',
							'Filter to stocked-only, unstocked-only, or the full catalog. Invalid values return 400.'
						],
						['origin', 'string', 'none', 'Partial match across continent, country, and region.'],
						[
							'country',
							'string (repeatable)',
							'none',
							'Exact match on country. Repeat the parameter to match any of several country labels.'
						],
						['continent', 'string', 'none', 'Exact match on continent.'],
						[
							'source',
							'string (repeatable)',
							'none',
							'Repeat to filter across multiple supplier slugs.'
						],
						[
							'processing',
							'string',
							'none',
							'Partial match on the legacy processing label. This remains supported for compatibility.'
						],
						['name', 'string', 'none', 'Partial match on coffee name.'],
						[
							'processing_base_method',
							'string',
							'none',
							'Paid process facet. Exact match on normalized base process, for example Washed, Natural, Honey, Wet-Hulled, Decaf, Other, or Unknown. Requires a member/admin session or paid API tier.'
						],
						[
							'fermentation_type',
							'string',
							'none',
							'Paid process facet. Exact match on normalized fermentation technique, for example Anaerobic, Carbonic Maceration, Yeast Inoculated, Co-Fermented, None Stated, or Unknown. Requires a member/admin session or paid API tier.'
						],
						[
							'process_additive',
							'string',
							'none',
							'Paid process facet. Array containment filter for disclosed additives such as fruit, yeast, hops, mossto, starter-culture, none, or unspecified. Requires a member/admin session or paid API tier.'
						],
						[
							'has_additives',
							'true | false',
							'none',
							'Paid process facet. true returns rows with a disclosed additive value. false returns explicit none only, not unknown or unspecified rows. Requires a member/admin session or paid API tier.'
						],
						[
							'processing_disclosure_level',
							'string',
							'none',
							'Paid process facet. Exact match on supplier disclosure quality: none, label_only, structured, narrative, or high_detail. Requires a member/admin session or paid API tier.'
						],
						[
							'processing_confidence_min',
							'number',
							'none',
							'Paid process facet. Minimum 0 to 1 confidence score for the structured process breakdown. Requires a member/admin session or paid API tier.'
						],
						['region', 'string', 'none', 'Partial match on region.'],
						['cultivar_detail', 'string', 'none', 'Partial match on cultivar or variety detail.'],
						['type', 'string', 'none', 'Partial match on type.'],
						['grade', 'string', 'none', 'Partial match on grade.'],
						['appearance', 'string', 'none', 'Partial match on appearance.'],
						['price_per_lb_min / price_per_lb_max', 'number', 'none', 'Canonical price filters.'],
						[
							'cost_lb_min / cost_lb_max',
							'number',
							'none',
							'Deprecated compatibility aliases for the canonical price filters. Prefer price_per_lb_min / price_per_lb_max in new integrations.'
						],
						['score_value_min', 'number', 'none', 'Minimum cupping or quality score (inclusive).'],
						['score_value_max', 'number', 'none', 'Maximum cupping or quality score (inclusive).'],
						[
							'arrival_date',
							'string',
							'none',
							'Exact match on the stored arrival_date value. Use YYYY-MM-DD when the supplier row has a normalized date.'
						],
						[
							'stocked_date',
							'string (YYYY-MM-DD)',
							'none',
							'Filter to coffees stocked on or after a given absolute date. Invalid formats return 400.'
						],
						[
							'stocked_days',
							'integer',
							'none',
							'Filter to coffees stocked within the last N days. Use stocked_date for absolute dates.'
						],
						[
							'showWholesale',
							'boolean',
							'false',
							'Only effective for privileged member sessions. Ignored for anonymous and API-key requests. Invalid values return 400.'
						],
						[
							'wholesaleOnly',
							'boolean',
							'false',
							'Requires showWholesale=true and a privileged member session. Invalid values return 400.'
						],
						[
							'sortField',
							PUBLIC_CATALOG_SORT_FIELD_LIST,
							'arrival_date',
							'Sort field for non-ID queries. Invalid values return 400.'
						],
						['sortDirection', 'asc | desc', 'desc', 'Sort direction for non-ID queries.']
					]
				},
				codeBlocks: [
					{
						label: 'Paginated dropdown projection',
						language: 'bash',
						code: 'curl "https://purveyors.io/v1/catalog?fields=dropdown&page=2&limit=15"'
					}
				]
			},
			{
				title: 'Proof coverage aggregate',
				body: [
					'GET /v1/catalog/proof-coverage summarizes the same proof-summary vocabulary exposed by include=proof. It reports overall labels, family label distributions, signal counts, top missing families, and explicit limitations for the visible catalog scope.',
					'The endpoint is aggregate-only. It is safe as a public proof-of-value surface because it does not expose raw processing_evidence, raw supplier quotes, row-level evidence, certification claims, supplier rankings, or paid proof-query filters.',
					'API-key requests preserve X-RateLimit-* headers and plan-scoped visibility. Anonymous and session requests follow the same catalog visibility and process-facet capability rules as /v1/catalog.'
				],
				codeBlocks: [
					{
						label: 'GET /v1/catalog/proof-coverage',
						language: 'json',
						code: '{\n  "resource": "catalog-proof-coverage",\n  "namespace": "/v1/catalog/proof-coverage",\n  "version": "v1",\n  "scope": { "total_rows": 814 },\n  "overall": [{ "label": "strong", "count": 488, "share": 0.6 }],\n  "families": {\n    "process": [{ "label": "disclosed", "count": 260, "share": 0.319 }]\n  },\n  "signals": { "process.base_method": 260 },\n  "top_gaps": [{ "family": "process", "label": "not_available", "count": 320, "share": 0.393 }],\n  "limitations": ["not_certification", "raw_evidence_not_included"]\n}'
					},
					{
						label: 'Proof coverage smoke test',
						language: 'bash',
						code: 'curl "https://purveyors.io/v1/catalog/proof-coverage?stocked=true" \\\
  -H "Authorization: Bearer $PURVEYORS_API_KEY"'
					}
				]
			},
			{
				title: 'Structured process filter edge cases',
				bullets: [
					'processing remains the backward-compatible public partial match against the legacy display label. Use the structured filters when an integration has member/admin session access or a paid API tier and needs process transparency semantics instead of text search.',
					'processing_base_method, fermentation_type, process_additive, processing_disclosure_level, and processing_confidence_min only match rows where the structured metadata is present. Null supplier metadata is preserved and should not be treated as explicit none. These params return 401 for anonymous callers and 403 for viewer/API Green callers.',
					'has_additives=true matches rows with disclosed additive values such as fruit, yeast, hops, mossto, or starter-culture. has_additives=false matches only rows whose additive array is exactly none; it intentionally excludes unknown, unspecified, null, or mixed values. This is also gated as a process facet.',
					'process_additive is an array-containment filter. A row with multiple disclosed additives can match any one repeated request pattern only by issuing separate requests today.',
					'Full rows include process.evidence_available but never expose raw processing_evidence quotes. The dropdown projection does not include the nested process object.',
					'include=proof adds proof.families.process, provenance, freshness, and pricing plus limitations such as not_certification and raw_evidence_not_included. Badge copy in public cards uses the same cautious vocabulary: disclosed, identified, dated, listed, or tiered.'
				],
				codeBlocks: [
					{
						label: 'Paid process facet request',
						language: 'bash',
						code: 'curl "https://purveyors.io/v1/catalog?fermentation_type=Co-Fermented&has_additives=true&limit=25" \\\n  -H "Authorization: Bearer pk_live_origin_or_enterprise_key"\n\ncurl "https://purveyors.io/v1/catalog?has_additives=false&processing_disclosure_level=structured&limit=25" \\\n  -H "Authorization: Bearer pk_live_origin_or_enterprise_key"'
					}
				]
			},
			{
				title: 'Proof summaries',
				body: [
					'include=proof adds a compact proof object to full catalog rows. It is designed for public cards, agent summaries, and integration UIs that need to explain why a listing looks trustworthy without exposing raw supplier evidence.',
					'The proof object groups signals into process, provenance, freshness, and pricing families. Each family uses cautious labels and limitations. It is not a certification system, and it does not expose raw processing evidence quotes by default.'
				],
				codeBlocks: [
					{
						label: 'Catalog proof request',
						language: 'bash',
						code: 'curl "https://purveyors.io/v1/catalog?include=proof&country=Ethiopia&limit=5" \\\n  -H "Authorization: Bearer pk_live_your_key_here"'
					},
					{
						label: 'Proof response fragment',
						language: 'json',
						code: '{\n  "proof": {\n    "families": {\n      "process": { "label": "disclosed", "confidence": 0.92 },\n      "provenance": { "label": "identified" },\n      "freshness": { "label": "dated" },\n      "pricing": { "label": "tiered" }\n    },\n    "limitations": ["not_certification", "raw_evidence_not_included"]\n  }\n}'
					}
				]
			},
			{
				title: 'Access mode comparison',
				table: {
					headers: ['Mode', 'Best for', 'Query envelope', 'Headers', 'Notes'],
					rows: [
						[
							'Anonymous /v1/catalog',
							'Discovery, evaluation, and public embeds',
							`Basic public query surface only. Structured process facets return 401. Defaults to ${DEFAULT_CATALOG_LISTING_LIMIT} rows when page and limit are omitted; page without limit falls back to ${DEFAULT_PAGINATED_PAGE_SIZE}.`,
							'Content-Type only',
							'Public-only catalog data. No X-RateLimit-* headers.'
						],
						[
							'API-key /v1/catalog',
							'Production integrations and accounted usage',
							`Basic public query surface for API Green; paid API tiers add structured process facets. Defaults to ${DEFAULT_CATALOG_LISTING_LIMIT} rows when page and limit are omitted.`,
							'Content-Type plus X-RateLimit-*',
							'Canonical integration path for developers, sync jobs, and agents. API Green is for evaluation; API Origin and Enterprise unlock process search leverage.'
						],
						[
							'Session /v1/catalog',
							'First-party product reads',
							'Viewer sessions stay public-only. Member/admin sessions unlock process facets and may also unlock showWholesale and wholesaleOnly.',
							'Session-dependent app headers only',
							'Cookies are only relevant when they resolve to a valid first-party session.'
						],
						[
							'GET /api/catalog-api',
							'Legacy API-key callers during migration',
							'Uses the same API-key query contract as /v1/catalog.',
							'Deprecation, Sunset, Link, plus X-RateLimit-*',
							'API-key-only deprecated alias. Sunset: Dec 31 2026.'
						]
					]
				},
				bullets: [
					'Anonymous, viewer-session, and API Green calls share the basic public query surface. Process facet params return 401 for anonymous callers and 403 for viewer/API Green callers.',
					'If an Authorization header is present but invalid, the route returns 401 instead of silently treating the request as anonymous.'
				]
			},
			{
				title: 'Example requests',
				codeBlocks: [
					{
						label: 'Anonymous discovery request',
						language: 'bash',
						code: 'curl "https://purveyors.io/v1/catalog?country=Ethiopia&processing=Natural&limit=15"'
					},
					{
						label: 'API-key request with production headers',
						language: 'bash',
						code: 'curl "https://purveyors.io/v1/catalog?stocked_days=30&price_per_lb_max=9&limit=50" \
  -H "Authorization: Bearer pk_live_your_key_here"'
					},
					{
						label: 'JavaScript fetch',
						language: 'js',
						code: 'const response = await fetch("https://purveyors.io/v1/catalog?country=Colombia&limit=25", {\n  headers: { Authorization: `Bearer ${process.env.PARCHMENT_API_KEY}` }\n});\n\nconst payload = await response.json();\nconsole.log(payload.meta.access, payload.data.length);'
					},
					{
						label: 'Python requests',
						language: 'python',
						code: 'import os\nimport requests\n\nresponse = requests.get(\n    "https://purveyors.io/v1/catalog",\n    params={"processing": "washed", "limit": 25},\n    headers={"Authorization": f"Bearer {os.environ[\'PARCHMENT_API_KEY\']}"},\n    timeout=30,\n)\nresponse.raise_for_status()\npayload = response.json()\nprint(payload["pagination"]["total"], payload["meta"]["auth"])'
					}
				]
			},
			{
				title: 'Tier limits and headers',
				table: {
					headers: ['Marketed plan', 'Code key', 'Monthly requests', 'Rows per call', 'Notes'],
					rows: [
						[
							'Green',
							'viewer',
							'200',
							'25',
							'Best for evaluation and prototypes. Includes public response fields but not structured process facet filtering.'
						],
						[
							'Origin',
							'member',
							'10,000',
							`Up to ${MAX_CATALOG_PAGE_LIMIT} per request`,
							'No additional plan row cap beyond the shared request-size ceiling. Best for production integrations and sync jobs.'
						],
						[
							'Enterprise',
							'enterprise',
							'Unlimited',
							`Up to ${MAX_CATALOG_PAGE_LIMIT} per request`,
							'No additional plan row cap beyond the shared request-size ceiling. Contact sales for commercial volume and support.'
						]
					]
				},
				bullets: [
					'The public docs use marketed tier names Green, Origin, and Enterprise, while API responses and server code use apiPlan keys viewer, member, and enterprise.',
					'API Green can read factual process fields in full catalog rows, but structured process facet filtering starts at API Origin.',
					`All callers share a hard per-request page-size ceiling of ${MAX_CATALOG_PAGE_LIMIT}, even when a paid plan removes the lower viewer-tier row cap.`,
					'X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset are only emitted for API-key responses.',
					'429 responses also include Retry-After.',
					'Anonymous and session-based catalog requests are not counted against an API-key quota and therefore do not receive those headers.'
				]
			}
		],
		related: [
			{
				href: '/api',
				label: 'API product page',
				description: 'Plans, positioning, and quick start.'
			},
			{
				href: '/catalog',
				label: 'Public catalog',
				description: 'See the product surface that consumes the same data model.'
			},
			{
				href: '/docs/api/catalog-similarity',
				label: 'Catalog similarity beta',
				description: 'Find candidate matches for a catalog coffee with member or paid API access.'
			},
			{
				href: '/docs/api/platform',
				label: 'Platform route matrix',
				description: 'Internal /api/* companions to the public contract.'
			},
			{
				href: '/docs/cli/catalog',
				label: 'CLI catalog docs',
				description: 'Terminal access to the same catalog domain.'
			}
		]
	},

	{
		section: 'api',
		slug: 'catalog-similarity',
		title: 'Catalog similarity API',
		summary:
			'GET /v1/catalog/{id}/similar returns beta similar-coffee candidates for member sessions and paid API-key integrations.',
		eyebrow: 'Beta endpoint',
		intro: [
			'GET /v1/catalog/{id}/similar finds candidate coffees related to one catalog entry. The route is useful for likely-same-bean checks, substitution research, account-linked agents, and pricing context around comparable lots.',
			'Matches are beta confidence candidates based on origin, processing, tasting similarity signals, and deterministic identity gates. The endpoint separates canonical candidates from similar recommendations; neither group is an accepted canonical identity.'
		],
		sections: [
			{
				title: 'Endpoint and access',
				table: {
					headers: ['Route', 'Method', 'Auth', 'Status', 'Contract'],
					rows: [
						[
							'/v1/catalog/{id}/similar',
							'GET',
							'Member/admin session or API key with API Origin or Enterprise and catalog:read',
							'Beta',
							'Returns target plus grouped beta matches, score dimensions, identity classification, blocker reasons, price_delta_1lb, pricing fallbacks, and cautious copy.'
						]
					]
				},
				bullets: [
					'Anonymous callers receive 401 auth_required. The response does not leak match data.',
					'Signed-in viewer sessions and API Green keys receive 403 entitlement_required. Locked teasers return similar_match_count: null so denied requests do not run the expensive similarity count path or leak match rows.',
					'API-key callers must satisfy requiredPlan member and requiredScope catalog:read. Successful API-key responses include X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset.',
					'429 responses use the same quota envelope as /v1/catalog and include Retry-After.',
					'404 means the target catalog coffee was not found after the caller has enough access to request matches.'
				]
			},
			{
				title: 'Path and query parameters',
				table: {
					headers: ['Parameter', 'Type', 'Default', 'Description'],
					rows: [
						[
							'id',
							'positive integer',
							'required',
							'Catalog coffee ID. The route validates against the Postgres int4 ceiling of 2147483647 before any database work.'
						],
						[
							'threshold',
							'number between 0.5 and 0.99',
							String(DEFAULT_CATALOG_SIMILARITY_THRESHOLD),
							'Minimum similarity score sent to the matching RPC.'
						],
						[
							'limit',
							`positive integer up to ${MAX_CATALOG_SIMILARITY_LIMIT}`,
							String(DEFAULT_CATALOG_SIMILARITY_LIMIT),
							'Number of matches returned after any mode filtering.'
						],
						[
							'stocked_only',
							'true | false',
							'true',
							'Whether candidate rows must currently be stocked.'
						],
						[
							'mode',
							'all | likely_same | similar_profile',
							'all',
							'Filters normalized matches after scoring. likely_same asks the server to overfetch before filtering so likely-same rows are not hidden by profile matches.'
						]
					]
				},
				callout: {
					tone: 'warning',
					title: 'Structured validation is part of the contract',
					body: 'Invalid id, threshold, limit, stocked_only, or mode values return HTTP 400 with error: Invalid query parameter and a details block containing parameter, value, and expected.'
				}
			},
			{
				title: 'Response shape',
				body: [
					'data.target summarizes the requested coffee with origin, process, stocked state, legacy cost_lb compatibility, and canonical pricing fields.',
					'data.groups.canonical_candidates and data.groups.similar_recommendations are the preferred grouped contract. data.matches remains as a transitional flat list. Each match includes coffee identity fields, canonical pricing, price_delta_1lb, score.average, score.dimensions.origin, score.dimensions.processing, score.dimensions.tasting, score.chunk_matches, match.category, match.classification.kind, match.classification.identity_eligibility, match.classification.blockers, match.confidence, match.beta, match.language, explanation.summary, explanation.signals, and compatibility.cost_lb.',
					'meta.status is beta. meta.classification_version and meta.query_strategy identify the hard-gated identity contract and bounded vector retrieval path. Preserve the non-canonical identity warning in client copy.'
				],
				codeBlocks: [
					{
						label: 'Member or API-key request',
						language: 'bash',
						code: 'curl "https://purveyors.io/v1/catalog/1182/similar?threshold=0.8&limit=5&mode=likely_same" \\\n  -H "Authorization: Bearer pk_live_origin_or_enterprise_key"'
					},
					{
						label: 'Successful response fragment',
						language: 'json',
						code: '{\n  "data": {\n    "target": {\n      "id": 1182,\n      "name": "Ethiopia Guji Natural",\n      "source": "Supplier A",\n      "origin": "Guji",\n      "country": "Ethiopia",\n      "processing": "Natural",\n      "stocked": true,\n      "pricing": {\n        "price_per_lb": null,\n        "price_tiers": [{ "min_lbs": 1, "price": 8 }],\n        "cost_lb": 7.1,\n        "baseline_quantity_lbs": 1,\n        "baseline_price_per_lb": 8,\n        "baseline_source": "price_tiers"\n      }\n    },\n    "matches": [\n      {\n        "coffee": { "id": 2200, "name": "Ethiopia Guji Natural Lot B", "stocked": true },\n        "pricing": { "baseline_price_per_lb": 8.75, "baseline_source": "price_per_lb" },\n        "price_delta_1lb": { "amount": 0.75, "percent": 9.4, "currency": "USD" },\n        "score": {\n          "average": 0.92,\n          "dimensions": { "origin": 0.94, "processing": 0.91, "tasting": 0.87 },\n          "chunk_matches": 3\n        },\n        "match": {\n          "category": "likely_same",\n          "confidence": "high_beta",\n          "beta": true,\n          "language": "High beta confidence likely same coffee candidate. Review supplier details before acting."\n        },\n        "explanation": {\n          "summary": "Beta similarity score based on available origin, processing, and tasting embeddings.",\n          "signals": ["Origin similarity 0.94", "Processing similarity 0.91"]\n        }\n      }\n    ]\n  },\n  "meta": {\n    "resource": "catalog-similarity",\n    "namespace": "/v1/catalog/{id}/similar",\n    "version": "v1",\n    "status": "beta",\n    "auth": { "kind": "api-key", "role": "viewer", "apiPlan": "member" },\n    "access": { "requiredCapability": "canUseBeanMatching", "canUseBeanMatching": true },\n    "query": { "threshold": 0.8, "limit": 5, "stockedOnly": true, "mode": "likely_same" }\n  }\n}'
					}
				]
			},
			{
				title: 'Error examples',
				codeBlocks: [
					{
						label: '401 anonymous request',
						language: 'json',
						code: '{\n  "error": "Authentication required",\n  "message": "Similar coffee matching requires a member account or paid API tier.",\n  "code": "auth_required",\n  "requiredCapability": "canUseBeanMatching"\n}'
					},
					{
						label: '403 locked viewer teaser',
						language: 'json',
						code: '{\n  "error": "Insufficient permissions",\n  "message": "Similar coffee matching is available to members and paid API tiers.",\n  "code": "entitlement_required",\n  "requiredCapability": "canUseBeanMatching",\n  "teaser": {\n    "locked": true,\n    "similar_match_count": null,\n    "beta": true\n  }\n}'
					},
					{
						label: '400 invalid query parameter',
						language: 'json',
						code: '{\n  "error": "Invalid query parameter",\n  "message": "Query parameter limit must use positive integer less than or equal to 25",\n  "details": {\n    "parameter": "limit",\n    "value": "99",\n    "expected": "positive integer less than or equal to 25"\n  }\n}'
					}
				]
			}
		],
		related: [
			{
				href: '/docs/api/catalog',
				label: 'Catalog API',
				description: 'The stable listing endpoint that provides the target IDs.'
			},
			{
				href: '/docs/cli/catalog',
				label: 'CLI catalog commands',
				description: 'Account-linked terminal access to catalog search and similar matching.'
			},
			{
				href: '/docs/api/errors',
				label: 'Errors and auth',
				description: 'Shared auth, entitlement, validation, and rate-limit conventions.'
			}
		]
	},

	{
		section: 'api',
		slug: 'procurement-briefs',
		title: 'Procurement briefs API',
		summary:
			'Create saved sourcing criteria and run deterministic catalog matches for procurement workflows.',
		eyebrow: 'Procurement seed',
		intro: [
			'Procurement briefs save a narrow, versioned sourcing intent for one account. They are the durable contract for agents, CLI workflows, and later web surfaces that need to ask: what currently matches this buying brief?',
			'The first version deliberately supports only pre-pagination-safe catalog constraints. Unsupported filters are rejected instead of stored as no-ops, and manual matches explain why each returned listing satisfies the saved criteria without ranking the coffee as objectively better.'
		],
		sections: [
			{
				title: 'Endpoint and access',
				table: {
					headers: ['Route', 'Method', 'Auth', 'Contract'],
					rows: [
						[
							'/v1/procurement/briefs',
							'GET',
							'Member/admin session or API key with API Origin or Enterprise plus catalog:read',
							'Lists active saved briefs owned by the caller.'
						],
						[
							'/v1/procurement/briefs',
							'POST',
							'Member/admin session or API key with API Origin or Enterprise plus catalog:read',
							'Creates one active manual brief after validating the versioned criteria contract.'
						],
						[
							'/v1/procurement/briefs/{id}',
							'GET',
							'Member/admin session or API key with API Origin or Enterprise plus catalog:read',
							'Returns one active caller-owned brief.'
						],
						[
							'/v1/procurement/briefs/{id}/matches',
							'GET',
							'Member/admin session or API key with API Origin or Enterprise plus catalog:read',
							'Applies saved criteria to current catalog rows before pagination and returns match reasons plus limitations.'
						]
					]
				},
				bullets: [
					'Anonymous callers receive 401 Authentication required.',
					'Signed-in viewers and API Green keys receive a structured 403 entitlement error before brief data is read or written.',
					'API-key requests use the same X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, and Retry-After conventions as other paid API routes.',
					'Brief records are user-owned; one caller cannot fetch or run another account’s brief.'
				]
			},
			{
				title: 'Criteria contract',
				body: [
					'Every stored criteria object is normalized to version: 1. The supported fields are country, region, processing, processing_base_method, max_price_per_lb, stocked_only, wholesale_only, and stocked_days.',
					'At least one supported sourcing constraint is required. Unknown fields, wrong value types, empty strings, invalid versions, and out-of-range stocked_days values return 400 with an issues array and allowedFields.'
				],
				codeBlocks: [
					{
						label: 'Create a washed Colombia brief',
						language: 'bash',
						code: 'curl -X POST "https://purveyors.io/v1/procurement/briefs" \\\n  -H "Authorization: Bearer pk_live_origin_or_enterprise_key" \\\n  -H "Content-Type: application/json" \\\n  --data \'{\n    "name": "Washed Colombia under 6.50",\n    "criteria": {\n      "country": "Colombia",\n      "processing_base_method": "Washed",\n      "max_price_per_lb": 6.5,\n      "stocked_only": true\n    }\n  }\''
					}
				]
			},
			{
				title: 'Manual matches',
				body: [
					'GET /v1/procurement/briefs/{id}/matches accepts page and limit query parameters. limit defaults to 25 and is capped at 100.',
					'The response includes data rows in the catalog resource shape with matchReasons, truthful pagination, generatedAt, the saved brief, the criteria used, and limitations explaining that deterministic matches are not quality rankings.'
				],
				codeBlocks: [
					{
						label: 'Run one brief manually',
						language: 'bash',
						code: 'curl "https://purveyors.io/v1/procurement/briefs/00000000-0000-4000-8000-000000000000/matches?limit=10" \\\n  -H "Authorization: Bearer pk_live_origin_or_enterprise_key"'
					},
					{
						label: 'Invalid criteria response',
						language: 'json',
						code: '{\n  "error": "Invalid criteria",\n  "message": "Sourcing brief criteria contains unsupported or invalid fields",\n  "details": {\n    "issues": [\n      {\n        "field": "unsupported_filter",\n        "message": "unsupported_filter is not supported by sourcing brief criteria"\n      }\n    ],\n    "allowedFields": ["country", "region", "processing", "processing_base_method", "max_price_per_lb", "stocked_only", "wholesale_only", "stocked_days"]\n  }\n}'
					}
				]
			}
		],
		related: [
			{
				href: '/docs/api/catalog',
				label: 'Catalog API',
				description: 'The current catalog rows matched by saved procurement criteria.'
			},
			{
				href: '/docs/api/catalog-similarity',
				label: 'Catalog similarity',
				description:
					'Beta matching primitives that remain separate from deterministic sourcing-brief matches.'
			},
			{
				href: '/docs/api/errors',
				label: 'Errors and auth',
				description: 'Shared auth, entitlement, validation, and rate-limit conventions.'
			}
		]
	},

	{
		section: 'api',
		slug: 'platform',
		title: 'Internal app route matrix',
		summary:
			'Authenticated and internal /api/* routes that power the Purveyors product surface, grouped by capability and stability.',
		eyebrow: 'Internal app routes',
		intro: [
			'This page distinguishes the stable external v1 contracts, beta catalog endpoints, legacy aliases, internal app APIs, Console control-plane routes, and admin-only surfaces.',
			'Most /api/* routes are not public compatibility promises. Document them accurately, but keep external integrations pointed at /v1/catalog, /v1/catalog/{id}/similar when matching access is available, /v1/price-index for aggregate market data, or @purveyors/cli whenever possible.'
		],
		sections: [
			{
				title: 'Public v1 and legacy route families',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Stability', 'Notes'],
					rows: [
						[
							'/v1',
							'GET',
							'Anonymous, session, or API key',
							'Namespace descriptor',
							'Advertises the v1 namespace and stable catalog and price-index resources.'
						],
						[
							'/v1/catalog',
							'GET',
							'Anonymous, session, or API key',
							'Stable external contract',
							'Canonical catalog resource for normalized listing reads, proof summaries, plan caps, and API-key rate-limit headers.'
						],
						[
							'/v1/catalog/{id}/similar',
							'GET',
							'Member session or API key with API Origin or Enterprise plus catalog:read',
							'Beta external contract',
							'Catalog similarity candidates with target, grouped canonical candidates vs similar recommendations, score dimensions, identity blocker reasons, price deltas, and cautious beta copy.'
						],
						[
							'/v1/procurement/briefs',
							'GET, POST',
							'Member session or API key with API Origin or Enterprise plus catalog:read',
							'Stable external procurement seed',
							'Creates and lists user-owned saved sourcing criteria. /v1/procurement/briefs/{id} gets one brief, and /v1/procurement/briefs/{id}/matches runs deterministic catalog matches.'
						],
						[
							'/v1/price-index',
							'GET',
							'API key with Parchment Intelligence access',
							'Stable external aggregate contract',
							'Reads aggregate price_index_snapshots only. No raw supplier rows, CSV, alerts, watchlists, or webhooks.'
						],
						[
							'/api/catalog-api',
							'GET',
							'API key only',
							'Deprecated legacy alias',
							'API-key-only alias to /v1/catalog. Always public-only. Sunset: Dec 31 2026.'
						]
					]
				}
			},
			{
				title: 'Catalog and discovery app routes',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Stability', 'Notes'],
					rows: [
						[
							'/api/catalog',
							'GET',
							'Anonymous, session, or API key',
							'Internal compatibility adapter',
							'Delegates to the canonical catalog resource but can return legacy shapes and adds X-Purveyors-Canonical-Resource: /v1/catalog.'
						],
						[
							'/api/catalog/filters',
							'GET',
							'Anonymous or session',
							'Internal UI helper',
							'Returns stocked-only filter metadata. Privileged sessions can opt into wholesale-aware values.'
						],
						[
							'/api/catalog-api',
							'GET',
							'API key only',
							'Deprecated',
							'Legacy API-key-only alias to /v1/catalog. Always public-only. Sunset: Dec 31 2026.'
						]
					]
				}
			},
			{
				title: 'Inventory and sales routes',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Stability', 'Notes'],
					rows: [
						[
							'/api/beans',
							'GET POST PUT DELETE',
							'GET: session or share token; writes: session',
							'Internal product route',
							"GET without a valid session returns an empty data array rather than a 401. share=<token> scopes reads to a shared bean or the owner's full inventory."
						],
						[
							'/api/share',
							'POST',
							'Session',
							'Internal product route',
							'Creates /beans?share=... links for one inventory item or all items.'
						],
						[
							'/api/update-stocked-status',
							'POST PUT',
							'Session',
							'Internal helper',
							"POST recalculates one inventory item by coffee_id. PUT bulk-recomputes the caller's entire inventory."
						],
						[
							'/api/profit',
							'GET POST PUT DELETE',
							'Session',
							'Internal product route',
							'GET returns both sales and computed profit data. Writes enforce ownership on the underlying sales or inventory rows.'
						]
					]
				}
			},
			{
				title: 'Roast and analysis routes',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Stability', 'Notes'],
					rows: [
						[
							'/api/roast-profiles',
							'GET POST PUT DELETE',
							'Session',
							'Internal product route',
							'CRUD for roast profiles. POST supports single and batch creation. DELETE accepts id or batch name.'
						],
						[
							'/api/artisan-import',
							'POST',
							'Session',
							'Internal product route',
							'Accepts multipart form-data with file plus roastId. Supported formats: .alog, .alog.json, .json.'
						],
						[
							'/api/roast-chart-data',
							'GET',
							'Session',
							'Internal analysis helper',
							'Requires roastId query param. Returns sampled telemetry and metadata, not raw unbounded sensor streams.'
						],
						[
							'/api/roast-chart-settings',
							'GET',
							'Session',
							'Internal UI helper',
							'Requires roastId query param. Reads saved chart ranges for a roast profile.'
						],
						[
							'/api/clear-roast',
							'DELETE',
							'Session + ownership',
							'Internal maintenance helper',
							'Requires roast_id query param. Clears imported Artisan data and resets related fields.'
						],
						[
							'/api/ai/classify-roast',
							'POST',
							'Session + member role',
							'Internal AI helper',
							'Matches Artisan metadata to inventory candidates. Returns { match } and can emit 429 if the model provider rate-limits.'
						]
					]
				}
			},
			{
				title: 'Chat and workspace routes',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Stability', 'Notes'],
					rows: [
						[
							'/api/chat',
							'POST',
							'Member session',
							'Internal product route',
							'Streams AI chat responses with workspace context and tool execution.'
						],
						[
							'/api/chat/execute-action',
							'POST',
							'Member session',
							'Internal product route',
							'Executes a constrained set of proposal-card actions: add_bean_to_inventory, update_bean, create_roast_session, update_roast_notes, and record_sale.'
						],
						[
							'/api/workspaces',
							'GET POST',
							'Member session',
							'Internal product route',
							'Lists or creates workspaces. New workspaces default to title "New Workspace" and type "general" when omitted.'
						],
						[
							'/api/workspaces/[id]',
							'GET PUT DELETE',
							'Member session + ownership',
							'Internal product route',
							'GET returns workspace details plus up to 50 messages and updates last_accessed_at.'
						],
						[
							'/api/workspaces/[id]/messages',
							'POST DELETE',
							'Member session + ownership',
							'Internal product route',
							'POST accepts one message or an array and persists parts plus canvas mutations.'
						],
						[
							'/api/workspaces/[id]/canvas',
							'POST PUT',
							'Member session + ownership',
							'Internal product route',
							'Persists canvas_state; POST exists for sendBeacon compatibility.'
						],
						[
							'/api/workspaces/[id]/summarize',
							'POST',
							'Member session + ownership',
							'Internal product route',
							'Compacts recent conversation history into context_summary using the model backend. Returns skipped: true when there are fewer than four saved messages.'
						]
					]
				},
				callout: {
					tone: 'warning',
					title: 'Workspace routes are product internals, not agent APIs',
					body: 'These endpoints exist to support the Purveyors chat product. For external automation, prefer the public catalog API or the CLI instead of coupling to chat workspace payloads.'
				}
			},
			{
				title: 'Console and docs-adjacent routes',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Stability', 'Notes'],
					rows: [
						[
							'/api-dashboard/keys/generate',
							'POST',
							'Session',
							'Console control-plane route',
							'Creates one API key for the authenticated user and returns the plaintext apiKey only at creation time.'
						],
						[
							'/api-dashboard/keys/deactivate',
							'POST',
							'Session + key ownership',
							'Console control-plane route',
							'Deactivates an owned API key by keyId without exposing the secret again.'
						]
					]
				},
				body: [
					'Outside the JSON route layer, /api/docs and /api-dashboard/docs are legacy docs entry points that 307 redirect to /docs/api/overview.',
					'Treat /docs as the canonical information architecture, /api as the product page, and /api-dashboard as the authenticated Console surface.'
				]
			},
			{
				title: 'Metadata, auth handoff, and crawler routes',
				body: [
					'These routes are public or browser-reachable support surfaces. They improve agent onboarding, search discovery, feed subscriptions, OAuth reliability, or browser tooling compatibility, but they are not public data APIs.'
				],
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Stability', 'Notes'],
					rows: [
						[
							'/llms.txt',
							'GET',
							'Anonymous',
							'Agent discoverability metadata',
							'Plain-text overview for agents with links to public pages, docs, API contracts, blog posts, and supported workflows.'
						],
						[
							'/sitemap.xml',
							'GET',
							'Anonymous',
							'Crawler metadata',
							'XML sitemap covering public pages, published blog posts, and the docs navigation generated from DOCS_NAV.'
						],
						[
							'/blog/feed.xml',
							'GET',
							'Anonymous',
							'RSS feed',
							'RSS 2.0 feed for published blog posts. It is content syndication, not a catalog or analytics API.'
						],
						[
							'/auth/callback',
							'GET',
							'OAuth code',
							'Auth handoff route',
							'Exchanges a Supabase auth code for a session, sanitizes next to an internal path, and redirects to the target or /auth/auth-code-error.'
						],
						[
							'/auth/cli-callback',
							'GET',
							'OAuth redirect target',
							'CLI login helper page',
							'Browser page that lets remote and headless CLI flows copy the full callback URL back into purvey auth login.'
						],
						[
							'/.well-known/appspecific/com.chrome.devtools.json',
							'GET',
							'Anonymous',
							'Browser tooling compatibility',
							'Returns an empty JSON object for Chrome DevTools app-specific probing. It has no product data contract.'
						]
					]
				}
			},
			{
				title: 'Deprecated tool routes',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Status', 'Replacement direction'],
					rows: [
						[
							'/api/tools/coffee-catalog',
							'POST',
							'Member session',
							'Deprecated',
							'Prefer direct CLI-library integration or /v1/catalog for external reads.'
						],
						[
							'/api/tools/green-coffee-inv',
							'POST',
							'Member session',
							'Deprecated',
							'Prefer shared inventory modules and CLI flows.'
						],
						[
							'/api/tools/roast-profiles',
							'POST',
							'Member session',
							'Deprecated',
							'Prefer shared roast modules and CLI flows.'
						],
						[
							'/api/tools/bean-tasting',
							'POST',
							'Member session',
							'Deprecated',
							'Prefer shared tasting logic and CLI flows.'
						],
						[
							'/api/tools/coffee-chunks',
							'POST',
							'Member session',
							'Deprecated',
							'Prefer current retrieval modules instead of tool-route coupling.'
						]
					]
				}
			}
		],
		related: [
			{
				href: '/docs/api/inventory',
				label: 'Inventory routes',
				description: 'Deeper notes on beans, sharing, and stocked-state behavior.'
			},
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast routes',
				description: 'Roast CRUD, imports, chart endpoints, and AI classification.'
			},
			{
				href: '/docs/api/billing-admin',
				label: 'Billing and admin',
				description: 'Stripe lifecycle routes, Console flows, and admin maintenance endpoints.'
			},
			{
				href: '/docs/cli/agent-integration',
				label: 'CLI and agents',
				description: 'Use the documented CLI instead of binding to internal tool routes.'
			}
		]
	},
	{
		section: 'api',
		slug: 'inventory',
		title: 'Inventory routes',
		summary:
			'Manage green coffee inventory, generate share links, and keep stocked state accurate through session-authenticated product routes.',
		eyebrow: 'Inventory',
		intro: [
			'Inventory is where public catalog data becomes account-owned operational data. The core route is /api/beans, backed by session auth for writes and optional share-token reads for scoped external viewing.',
			'Inventory IDs are not catalog IDs. Roast and downstream workflows use green_coffee_inv.id values.'
		],
		sections: [
			{
				title: 'Endpoints',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Purpose'],
					rows: [
						[
							'/api/beans',
							'GET POST PUT DELETE',
							'GET: session or share token; writes: session',
							'Inventory CRUD plus shared-link reads'
						],
						[
							'/api/share',
							'POST',
							'Session',
							'Create share links for one bean or the whole inventory'
						],
						[
							'/api/update-stocked-status',
							'POST PUT',
							'Session',
							'Recalculate stocked status for one item or the entire account'
						]
					]
				}
			},
			{
				title: 'Read and share behavior',
				bullets: [
					'GET /api/beans?share=<token> returns a scoped view if the token exists, is active, and has not expired.',
					'Without a valid share token, GET /api/beans falls back to the current session. If no session is present, the route returns { data: [] } instead of a 401.',
					'POST /api/share accepts resourceId plus an optional expiresIn value such as 7d. The response is a shareUrl under /beans?share=....',
					'Share links reveal inventory data only; they do not grant broader session or account access.'
				]
			},
			{
				title: 'Mutation behavior',
				bullets: [
					'POST /api/beans can create manual catalog entries when no catalog_id is supplied and manual_name is present.',
					'PUT /api/beans requires an id query parameter and filters updates down to known inventory columns before writing.',
					'DELETE /api/beans requires an id query parameter and enforces ownership before removing inventory and dependent data.',
					"POST /api/update-stocked-status recalculates one item by coffee_id. PUT scans the caller's full inventory and batch-updates any mismatched stocked flags."
				],
				callout: {
					tone: 'note',
					title: 'Inventory IDs drive roast workflows',
					body: 'Roast creation, Artisan imports, and several CLI commands expect green_coffee_inv.id values, not coffee_catalog IDs. Use the inventory surface or CLI inventory list to find the correct IDs.'
				}
			},
			{
				title: 'CLI access',
				codeBlocks: [
					{
						label: 'List stocked inventory',
						language: 'bash',
						code: 'purvey inventory list --stocked --pretty'
					},
					{
						label: 'Inspect add flags',
						language: 'bash',
						code: 'purvey inventory add --help'
					}
				]
			}
		],
		related: [
			{
				href: '/beans',
				label: 'Inventory page',
				description: 'Manage inventory in the web app.'
			},
			{
				href: '/docs/api/platform',
				label: 'Platform route matrix',
				description: 'See inventory in context with sales, chat, and billing routes.'
			},
			{
				href: '/docs/cli/inventory',
				label: 'CLI inventory docs',
				description: 'Terminal workflows for listing and managing inventory.'
			},
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast docs',
				description: 'Roasts consume inventory IDs and update stocked state.'
			}
		]
	},
	{
		section: 'api',
		slug: 'roast-profiles',
		title: 'Roast profile routes',
		summary:
			'Create, import, analyze, and clear roast profiles through session-authenticated internal endpoints.',
		eyebrow: 'Roasting',
		intro: [
			'Roast routes cover CRUD for roast profiles, Artisan import, chart telemetry, chart display settings, data clearing, and AI-assisted classification.',
			'All roast routes require an authenticated session. The AI classifier additionally requires the member role.'
		],
		sections: [
			{
				title: 'Endpoints',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Purpose'],
					rows: [
						[
							'/api/roast-profiles',
							'GET POST PUT DELETE',
							'Session',
							'List, create, update, or delete roast profiles'
						],
						[
							'/api/artisan-import',
							'POST',
							'Session',
							'Import an Artisan roast file into an existing roast profile'
						],
						[
							'/api/roast-chart-data',
							'GET',
							'Session',
							'Return sampled roast telemetry and metadata for a roast'
						],
						['/api/roast-chart-settings', 'GET', 'Session', 'Read saved chart ranges for a roast'],
						[
							'/api/clear-roast',
							'DELETE',
							'Session + ownership',
							'Clear imported roast telemetry and reset Artisan fields'
						],
						[
							'/api/ai/classify-roast',
							'POST',
							'Session + member role',
							'Classify a roast against inventory candidates using the model backend'
						]
					]
				}
			},
			{
				title: 'Key behaviors',
				bullets: [
					'POST /api/roast-profiles supports both single and batch creation and recalculates stocked status for each affected inventory record.',
					'PUT /api/roast-profiles requires an id query parameter. DELETE accepts either id or batch name query parameters.',
					'POST /api/artisan-import expects multipart form-data with file and roastId. Supported file extensions are .alog, .alog.json, and .json.',
					'GET /api/roast-chart-data requires roastId and returns sampled telemetry tuned for charting, including performance metadata and derived ranges.',
					'DELETE /api/clear-roast requires roast_id and verifies ownership before deleting imported telemetry, events, and log rows.',
					'POST /api/ai/classify-roast expects alogMetadata plus an inventory array and returns { match } or { match: null }.'
				]
			},
			{
				title: 'CLI access',
				body: [
					'The CLI is the cleanest supported interface for roast workflows outside the browser, especially for imports and automated watch-folder flows.'
				],
				codeBlocks: [
					{
						label: 'Import an Artisan file',
						language: 'bash',
						code: 'purvey roast import roast.alog --coffee-id 42 --batch-name "Guji test batch" --pretty'
					}
				]
			}
		],
		related: [
			{
				href: '/roast',
				label: 'Roast page',
				description: 'Charts and roast profile management in the web app.'
			},
			{
				href: '/docs/api/platform',
				label: 'Platform route matrix',
				description: 'See roast routes in context with inventory, chat, and billing.'
			},
			{
				href: '/docs/cli/roast',
				label: 'CLI roast docs',
				description: 'Terminal workflows for create, list, import, and watch.'
			},
			{
				href: '/docs/api/inventory',
				label: 'Inventory docs',
				description: 'Roasts depend on inventory IDs and stocked-state updates.'
			}
		]
	},
	{
		section: 'api',
		slug: 'analytics',
		title: 'Market analytics',
		summary:
			'Analytics is a product surface on Purveyors, not a standalone public API family, with session-auth roast analysis helpers behind the scenes.',
		eyebrow: 'Market intelligence',
		intro: [
			'The /analytics page delivers market intelligence derived from the same normalized catalog that powers the public API. Public visitors can browse the core market overview: origin price trends, processing mix, origin price ranges, and the supplier/listing/origin stat bar. Parchment Intelligence users get the deeper supplier comparison, supplier health, arrivals, delistings, and extended trend modules.',
			'Analytics is important to the product story, but only the aggregate /v1/price-index subset is exposed as a stable API-key contract. Keep the distinction between product UI, internal helpers, and public REST contract explicit.'
		],
		sections: [
			{
				title: 'What is public today',
				bullets: [
					'/analytics is a web product surface, while /v1/price-index is the API-key contract for the aggregate price-index subset backed by price_index_snapshots.',
					'/v1/price-index intentionally starts with JSON pagination only. Do not document CSV, alerts, watchlists, webhooks, or supplier-level raw rows as supported.',
					'Logged-out visitors and logged-in viewers share the same core analytics view. The server resolves Parchment Intelligence access separately and uses it to decide whether to load the gated modules.',
					'Public chart data includes 90 days of price-index snapshots, current stocked processing distribution, current origin price ranges, recent-arrival/delisting counts for the upgrade preview, and the latest market summary counts.',
					'Parchment Intelligence expands the same page to 365 days of snapshot history plus supplier comparison, supplier health, recent arrivals, recent delistings, and origin-level aggregate modules.',
					'The public catalog and public analytics should be cross-linked because they describe the same coffee market from different angles: raw records versus curated analysis.',
					'Authenticated and premium analytics views may expose deeper app features, but only aggregate price-index snapshots currently ride through the stable public REST schema.'
				]
			},
			{
				title: 'Roast analysis helpers',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Purpose'],
					rows: [
						[
							'/api/roast-chart-data',
							'GET',
							'Session',
							'Sampled roast telemetry and metadata for chart rendering'
						],
						['/api/roast-chart-settings', 'GET', 'Session', 'Saved chart axis ranges'],
						[
							'/api/ai/classify-roast',
							'POST',
							'Session + member role',
							'AI-assisted roast-to-inventory matching'
						],
						[
							'/api/clear-roast',
							'DELETE',
							'Session + ownership',
							'Clear imported roast data for a flow reset'
						]
					]
				}
			},
			{
				title: 'Cross-links that should stay coherent',
				bullets: [
					'/analytics, /catalog, /api, /docs, and /docs/api/catalog should tell one consistent product story.',
					'When analytics positioning changes, check /api copy and docs copy together so the public contract does not accidentally expand on paper.',
					'If analytics later becomes a first-class API family, introduce a new public namespace instead of silently overloading internal /api/* helpers.'
				]
			}
		],
		related: [
			{
				href: '/analytics',
				label: 'Analytics product',
				description: 'Explore the live analytics surface.'
			},
			{
				href: '/catalog',
				label: 'Public catalog',
				description: 'Browse the underlying market records.'
			},
			{
				href: '/docs/api/catalog',
				label: 'Catalog API docs',
				description: 'The stable public contract behind the market dataset.'
			},
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast analysis routes',
				description: 'Session-auth routes used for roast data exploration.'
			}
		]
	},
	{
		section: 'api',
		slug: 'billing-admin',
		title: 'Billing and admin routes',
		summary:
			'Stripe lifecycle routes, Console-adjacent account flows, webhook processing, and admin-only maintenance endpoints.',
		eyebrow: 'Operations',
		intro: [
			'The billing and admin layer sits behind the Parchment Console and subscription flows. These routes are operational, not public APIs.',
			'Most billing routes require a user session. The Stripe webhook requires a valid Stripe signature. Admin routes should be treated as support and maintenance surfaces.'
		],
		sections: [
			{
				title: 'Stripe and Console-adjacent routes',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Purpose'],
					rows: [
						[
							'/api/stripe/check-session',
							'GET',
							'Session',
							'Inspect a Stripe Checkout session by session_id'
						],
						[
							'/api/stripe/create-checkout-session',
							'POST',
							'Session',
							'Create a checkout flow from one or more purchase keys and return a client secret'
						],
						[
							'/api/stripe/create-customer',
							'POST',
							'Session',
							"Create or reuse the caller's Stripe customer record and customer mapping"
						],
						[
							'/api/stripe/cancel-subscription',
							'POST',
							'Session',
							'Cancel a subscription by subscriptionId'
						],
						[
							'/api/stripe/resume-subscription',
							'POST',
							'Session',
							'Resume a paused or canceled subscription by subscriptionId'
						],
						[
							'/api/stripe/reconcile-session',
							'POST',
							'Session',
							'Verify checkout by sessionId, dedupe repeat processing, reconcile billing snapshots, and return the final entitlement state after purchase'
						],
						[
							'/api/stripe/verify-and-update-role',
							'POST',
							'Session',
							'Compatibility alias to the same reconcile-session handler for older success flows'
						],
						[
							'/api/stripe/webhook',
							'POST',
							'Stripe signature',
							'Process checkout and subscription lifecycle events'
						]
					]
				},
				body: [
					'create-checkout-session accepts purchaseKey or purchaseKeys, rejects unknown or non-self-serve entries, and returns 409 when the request mixes same-family plans or conflicts with an existing active subscription.',
					'cancel-subscription and resume-subscription are intentionally limited to membership subscriptions and return 409 when the same Stripe subscription also bundles API or Parchment Intelligence products.'
				]
			},
			{
				title: 'Console key management routes',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Purpose'],
					rows: [
						[
							'/api-dashboard/keys/generate',
							'POST',
							'Session',
							'Create a named API key for the authenticated user and return the plaintext apiKey once'
						],
						[
							'/api-dashboard/keys/deactivate',
							'POST',
							'Session + key ownership',
							'Deactivate an owned API key by keyId'
						]
					]
				},
				body: [
					'These are Console control-plane routes, not public API contracts. A browser session is required because key creation and deactivation mutate the signed-in account.',
					'generate requires a non-empty JSON name field and returns apiKey only in the creation response. Store it immediately; later Console views should show metadata, not the secret.',
					'deactivate requires keyId and verifies ownership before marking a key inactive. There is no public delete-by-secret flow.'
				],
				codeBlocks: [
					{
						label: 'Generate an API key from the signed-in Console session',
						language: 'bash',
						code: `curl -X POST https://purveyors.io/api-dashboard/keys/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <signed-in session cookie>" \
  -d '{"name":"local sync job"}'`
					},
					{
						label: 'Deactivate an owned key',
						language: 'bash',
						code: `curl -X POST https://purveyors.io/api-dashboard/keys/deactivate \
  -H "Content-Type: application/json" \
  -H "Cookie: <signed-in session cookie>" \
  -d '{"keyId":"api_key_row_id"}'`
					}
				]
			},
			{
				title: 'Admin routes',
				table: {
					headers: ['Route', 'Methods', 'Auth', 'Purpose'],
					rows: [
						[
							'/api/admin/billing-entitlement-discrepancies',
							'GET POST',
							'Admin session',
							'Audit billing entitlement drift versus local billing snapshots and trigger safe recompute-based repairs'
						],
						[
							'/api/admin/stripe-role-discrepancies',
							'GET POST',
							'Admin session',
							'Compatibility alias that currently reuses the billing-entitlement-discrepancies handler'
						],
						[
							'/api/admin/backfill-milestones',
							'POST',
							'Session plus member-role check',
							'Run milestone backfill logic for roast-related calculations'
						]
					]
				},
				callout: {
					tone: 'warning',
					title: 'Admin namespace does not mean uniform admin enforcement',
					body: 'Today, /api/admin/billing-entitlement-discrepancies uses centralized admin validation, but /api/admin/backfill-milestones currently checks for a member role rather than admin. Keep docs truthful about the current behavior and treat that mismatch as implementation debt, not documentation ambiguity.'
				}
			},
			{
				title: 'Operational notes',
				bullets: [
					'Billing docs should always cross-link to /api-dashboard because that is the user-facing surface for keys, usage, and subscription state.',
					'Webhook routes are machine-to-machine infrastructure and should never be presented as browser-consumable product APIs.',
					'GET /api/docs and GET /api-dashboard/docs are legacy docs handoff routes that redirect to /docs/api/overview.',
					'When role-sync behavior changes, review subscription success flows, webhook docs, Console key-management docs, and admin discrepancy tooling together.'
				]
			}
		],
		related: [
			{
				href: '/api-dashboard',
				label: 'Parchment Console',
				description: 'Keys, usage, and account-aware billing.'
			},
			{
				href: '/api',
				label: 'API product page',
				description: 'Plans and commercial positioning.'
			},
			{
				href: '/docs/api/platform',
				label: 'Platform route matrix',
				description: 'See billing and admin in the broader /api/* inventory.'
			},
			{
				href: '/docs/api/errors',
				label: 'Errors and auth',
				description: 'Common status codes and auth failure patterns.'
			}
		]
	},
	{
		section: 'api',
		slug: 'errors',
		title: 'Errors, auth, and limits',
		summary:
			'Status codes, auth edge cases, rate-limit behavior, and practical troubleshooting for both public and internal routes.',
		eyebrow: 'Reference',
		intro: [
			'Parchment uses standard HTTP status codes and structured JSON error bodies, but route families have different auth expectations. The public catalog behaves differently from workspace, billing, and inventory routes.',
			'The most common issues are invalid query parameters (400), missing or bad auth (401), insufficient permissions (403), and rate-limit exhaustion (429).'
		],
		sections: [
			{
				title: 'Status codes',
				table: {
					headers: ['Status', 'Where you see it', 'Meaning'],
					rows: [
						['200', 'Most successful GETs and writes', 'Request succeeded.'],
						['201', 'Workspace create, workspace message save', 'Resource created.'],
						[
							'307',
							'/docs section redirects and legacy docs handoff',
							'Temporary redirect to the canonical docs path.'
						],
						[
							'400',
							'Missing query params, bad form payloads, unsupported import files, and invalid catalog dates or numeric values',
							'The caller provided an invalid request.'
						],
						['401', 'Missing or invalid session or API key', 'Authentication required.'],
						[
							'403',
							'Member role checks, admin checks, ownership failures',
							'Authenticated but not allowed to perform the action.'
						],
						[
							'404',
							'Missing workspace, shared bean, or owned resource',
							'The resource is absent or not visible to the caller.'
						],
						[
							'409',
							'Billing plan conflicts and bundled membership management limits',
							'The request is valid but conflicts with current subscription state.'
						],
						[
							'429',
							'Public catalog API-key requests or AI provider backpressure',
							'Quota or provider rate limit reached.'
						],
						['499', 'Cancelled chat requests', 'The caller aborted the request before completion.'],
						['500', 'Unhandled internal failures', 'Unexpected server-side error.'],
						[
							'502',
							'Workspace summarize provider failures',
							'Upstream model or service dependency failed.'
						]
					]
				}
			},
			{
				title: 'Representative error bodies',
				codeBlocks: [
					{
						label: '400 Invalid query parameter',
						language: 'json',
						code: '{\n  "error": "Invalid query parameter",\n  "message": "Query parameter \\"stocked_date\\" must use YYYY-MM-DD format",\n  "details": {\n    "parameter": "stocked_date",\n    "value": "30",\n    "expected": "YYYY-MM-DD"\n  }\n}'
					},
					{
						label: '401 Authentication required',
						language: 'json',
						code: '{\n  "error": "Authentication required"\n}'
					},
					{
						label: '403 Member role required',
						language: 'json',
						code: '{\n  "error": "Member role required"\n}'
					},
					{
						label: '409 Subscription conflict',
						language: 'json',
						code: '{\n  "error": "You already have an active API subscription. Use subscription management to change intervals."\n}'
					},
					{
						label: '429 Public catalog quota exceeded',
						language: 'json',
						code: '{\n  "error": "Rate limit exceeded",\n  "message": "API rate limit exceeded for your subscription plan",\n  "limit": 200,\n  "remaining": 0,\n  "resetTime": "2026-05-01T00:00:00.000Z"\n}'
					}
				]
			},
			{
				title: 'Edge cases worth knowing',
				bullets: [
					'For external catalog access, prefer /v1/catalog. Use an API key for machine-to-machine access or authenticate the CLI with purvey auth login.',
					'Anonymous /v1/catalog calls use the same public query surface as other public callers. If page is supplied without limit, the route falls back to 15 rows; if both page and limit are omitted, the canonical listing response defaults to 100 rows.',
					'GET /api/beans with no session and no valid share token returns an empty data array, not a 401. Do not mistake that behavior for public inventory access.',
					'Catalog rate-limit headers only exist on API-key requests. Anonymous and session requests to /v1/catalog do not emit X-RateLimit-* headers.',
					'An invalid Authorization header on the public catalog can turn what looks like an anonymous request into a 401 because the route detects an auth attempt that failed.',
					'/api-dashboard/keys/generate returns the plaintext apiKey only at creation time. Plan Console UX and support docs around that one-time reveal.',
					'Cookies only matter when they resolve to a valid first-party session. A stray Cookie header is not part of the public API contract.',
					'/api/catalog-api is a deprecated API-key-only alias. It should not be treated as an anonymous or session-friendly discovery route.',
					'Workspace and chat routes require chat access, which can come from Mallard Studio membership or Parchment Intelligence entitlement; logged-in users with neither should expect a 403.',
					'AI-backed helpers can return upstream rate-limit or provider errors that are operational rather than domain-model failures.'
				]
			},
			{
				title: 'Troubleshooting path',
				bullets: [
					'External integration failing? Confirm it is calling /v1/catalog, not an internal /api/* route.',
					'Getting a 400 on catalog? Double-check date inputs like stocked_date=YYYY-MM-DD and any other validated query params.',
					'Unexpected 403 on product routes? Check role and ownership assumptions before debugging auth cookies.',
					'Hit a 429 on catalog? Inspect X-RateLimit-* and Retry-After or upgrade the plan in the Parchment Console.',
					'Need to validate workflows outside the browser? The CLI is usually the cleanest supported interface.'
				]
			}
		],
		related: [
			{
				href: '/api-dashboard',
				label: 'Parchment Console',
				description: 'Inspect key usage and tier limits.'
			},
			{
				href: '/docs/api/overview',
				label: 'API overview',
				description: 'Public versus internal surface model.'
			},
			{
				href: '/docs/api/platform',
				label: 'Platform route matrix',
				description: 'Route-by-route auth and stability reference.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'Often the fastest path for validating access and workflows.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'overview',
		title: 'CLI overview',
		summary:
			'The Parchment CLI is a terminal interface for catalog queries, inventory management, roasting workflows, scripting, and agent automation.',
		eyebrow: '@purveyors/cli',
		intro: [
			'The Parchment CLI (purvey) provides terminal access to the same coffee domain model as the web app. Catalog commands require an authenticated viewer session even though GET /v1/catalog supports anonymous and API-key access. Inventory, roast, sales, and tasting commands additionally require the member role.',
			'Not every command requires auth. auth, config, context, and manifest are onboarding or local utility surfaces. purvey context is the dense human-readable reference, while purvey manifest is the preferred machine-readable contract.'
		],
		sections: [
			{
				title: 'Install and first-run flow',
				codeBlocks: [
					{
						label: 'Install and authenticate',
						language: 'bash',
						code: 'npm install -g @purveyors/cli\npurvey auth login\npurvey auth status --pretty'
					},
					{
						label: 'Agent-friendly bootstrap',
						language: 'bash',
						code: 'purvey auth login --headless\npurvey context\npurvey manifest --pretty'
					}
				],
				bullets: [
					'Use purvey auth login for browser OAuth or purvey auth login --headless on servers, CI, and agent hosts.',
					'Headed purvey auth login also supports a pasted callback URL when a browser opens on a different machine, localhost is unreachable, or the automatic callback fails. That manual fallback is intentional for SSH, containers, and agent hosts, not a degraded path.',
					'Run purvey auth status to confirm both session health and current role before scripting against viewer-only or member-only commands.',
					'Use purvey manifest when a wrapper needs the preferred machine-readable contract. Use purvey context when a human or model should read the dense reference text first, or use purvey context --json / --pretty when an existing caller needs manifest-parity output.'
				]
			},
			{
				title: 'Command groups and auth model',
				table: {
					headers: ['Group', 'Examples', 'Auth'],
					rows: [
						['auth', 'login, status, logout', 'None'],
						['catalog', 'search, get, stats, similar', 'Authenticated viewer session'],
						[
							'inventory / roast / sales / tasting',
							'Personal data and write workflows',
							'Authenticated member session'
						],
						['config', 'list, get, set, reset', 'None, local-only'],
						['context / manifest', 'Dense reference text and machine-readable contract', 'None']
					]
				},
				callout: {
					tone: 'note',
					title:
						'Catalog commands are authenticated, even though the HTTP API supports anonymous reads',
					body: 'The CLI intentionally requires a signed-in viewer session for catalog commands so terminal workflows stay account-linked and predictable. For anonymous discovery or API-key production integrations, use GET /v1/catalog instead of shelling out to the CLI.'
				}
			},
			{
				title: 'Output contract',
				bullets: [
					'Most commands write compact JSON to stdout by default. --json is an explicit alias for that mode, while --pretty prints indented JSON and --csv exports array-shaped results where supported.',
					'Operational messages and fatal errors stay on stderr so stdout remains safe for pipes, jq, and redirect-based automation.',
					'Interactive terminals without an explicit output flag can still show human-readable success or error text. When piped or redirected, the CLI falls back to structured JSON output and JSON error envelopes.',
					'purvey auth status is the main exception worth remembering: in an interactive TTY it prints human-readable status unless you force --json, --pretty, or --csv.'
				]
			},
			{
				title: 'When to use the CLI vs. the API vs. the web app',
				table: {
					headers: ['Surface', 'Choose it when', 'Auth expectation'],
					rows: [
						[
							'purvey catalog',
							'A terminal, script, or agent is acting on behalf of a signed-in account',
							'Viewer session required'
						],
						[
							'Anonymous GET /v1/catalog',
							'The goal is public discovery, evaluation, or a zero-setup demo',
							'None'
						],
						[
							'API-key GET /v1/catalog',
							'The integration needs production usage visibility, quotas, or server-to-server auth',
							'Bearer API key required'
						],
						[
							'Web app',
							'A human wants visual exploration, dashboards, or account workflows',
							'Browser session as needed'
						]
					]
				},
				bullets: [
					'CLI login is intentional product behavior, not a contradiction of the HTTP API. The CLI is an account-linked tool surface; /v1/catalog is the public network surface.'
				]
			}
		],
		related: [
			{
				href: '/docs/cli/auth-output',
				label: 'Auth, config, and output',
				description: 'Roles, local config, stderr/stdout guarantees, and exit-code expectations.'
			},
			{
				href: '/docs/cli/context-manifest',
				label: 'Context and manifest',
				description: 'Text-first onboarding, manifest output, and wrapper guidance for agents.'
			},
			{
				href: '/docs/api/catalog',
				label: 'Catalog API docs',
				description: 'The HTTP endpoint that complements the CLI.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'auth-output',
		title: 'CLI auth, config, and output',
		summary:
			'Authentication roles, local config, output modes, stderr/stdout rules, and scripting expectations for the Parchment CLI.',
		eyebrow: 'Operational contract',
		intro: [
			'This page is the practical contract for running purvey in scripts, CI, agent harnesses, and local terminals. It covers which commands require auth, what config exists today, and how output behaves across interactive and non-interactive modes.',
			'If you automate against purvey, treat stdout and stderr semantics as part of the interface, not just the command names.'
		],
		sections: [
			{
				title: 'Authentication commands',
				codeBlocks: [
					{
						label: 'Login and status',
						language: 'bash',
						code: 'purvey auth login\npurvey auth login --headless\npurvey auth status --json\npurvey auth logout'
					}
				],
				bullets: [
					'purvey auth login launches the browser OAuth flow. If the browser cannot return to the local callback server, paste the full callback URL into the waiting terminal; the command keeps listening after invalid pasted URLs so you can retry.',
					'purvey auth login --headless prints a URL and expects a pasted callback URL, which is better for agents, CI, containers, and remote hosts.',
					'purvey auth status does not require an existing valid session. It reports authenticated state, role, and token timing when available.',
					'Catalog commands require the viewer role. Inventory, roast, sales, and tasting commands require the member role.'
				]
			},
			{
				title: 'Local config',
				table: {
					headers: ['Command', 'Notes'],
					rows: [
						['purvey config list', 'Show all stored config values.'],
						['purvey config get <key>', 'Print the raw value to stdout for scripting.'],
						['purvey config set <key> <value>', 'Persist a config value locally.'],
						['purvey config reset', 'Clear config back to defaults.']
					]
				},
				bullets: [
					'Today the primary supported key is form-mode, stored in ~/.config/purvey/config.json.',
					'When form-mode is true, several write commands can enter guided form mode automatically when required flags are missing.',
					'Config commands are local-only and do not require authentication.'
				]
			},
			{
				title: 'Stdout and stderr behavior',
				bullets: [
					'Compact JSON on stdout is the default success shape for most commands.',
					'--pretty keeps JSON but formats it for human reading. --csv changes successful stdout only and only on commands that support CSV-shaped output.',
					'Info messages, confirmations, spinner text, and fatal errors go to stderr so stdout can stay script-friendly.',
					'With --json, --pretty, --csv, or non-interactive piping, fatal errors become JSON envelopes on stderr. Interactive no-flag sessions may show human-readable fatal errors instead.'
				],
				codeBlocks: [
					{
						label: 'Script-friendly usage',
						language: 'bash',
						code: "purvey inventory list | jq '.[].id'\npurvey sales list --csv > sales.csv\npurvey auth status 2>/dev/null | jq -r '.email'"
					}
				]
			},
			{
				title: 'Exit-code expectations',
				bullets: [
					'0 means success.',
					'3 is the important automation code for auth failures, including missing login, expired session, or insufficient role.',
					'5 represents dependency conflicts such as inventory deletion without --force when dependent roasts or sales exist.',
					'6 represents local config problems.'
				]
			}
		],
		related: [
			{
				href: '/docs/cli/context-manifest',
				label: 'Context and manifest',
				description:
					'Dense onboarding text, machine-readable contract output, and agent wrapper guidance.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'Return to the high-level command and positioning map.'
			},
			{
				href: '/docs/cli/agent-integration',
				label: 'Agent integration',
				description: 'See how the web app and external agents consume the CLI.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'catalog',
		title: 'CLI catalog commands',
		summary:
			'Search and browse the green coffee catalog from your terminal with an authenticated viewer session.',
		eyebrow: 'Catalog data',
		intro: [
			'Catalog commands are the fastest way to explore the green coffee feed from the terminal when the workflow is tied to a signed-in account. They require an authenticated viewer session; run purvey auth login before using them.',
			'The search command supports filters for origin, processing method, price range, flavor notes, stocked-only, and result limits. purvey catalog similar <id> mirrors the account-linked matching workflow exposed by the beta /v1/catalog/{id}/similar endpoint, but the CLI uses viewer-session auth instead of API keys. If the goal is anonymous discovery or API-key integration, use the HTTP API instead. See the CLI overview for install and login instructions.'
		],
		sections: [
			{
				title: 'Commands',
				bullets: [
					'purvey catalog search: search by origin, processing method, price, flavor, variety, drying method, and more. Requires authentication.',
					'purvey catalog get <id>: fetch a single coffee by catalog ID.',
					'purvey catalog similar <id>: find coffees similar to a given catalog entry.',
					'purvey catalog stats: aggregate catalog statistics.'
				],
				codeBlocks: [
					{
						label: 'Search examples',
						language: 'bash',
						code: 'purvey catalog search --origin "Ethiopia" --process "natural" --pretty\npurvey catalog search --variety "Heirloom" --stocked --pretty\npurvey catalog search --drying-method "raised bed" --stocked --limit 20\npurvey catalog search --stocked-days 30 --sort newest --pretty\npurvey catalog search --ids "1182,1183,1200" --pretty\npurvey catalog similar 1182 --threshold 0.85 --stocked-only --pretty'
					}
				]
			},
			{
				title: 'Similar matching',
				bullets: [
					'purvey catalog similar <id> finds beta similar-coffee candidates for one catalog ID. Treat results as leads for comparison, not canonical identity claims.',
					'--threshold sets the minimum similarity score. The HTTP beta endpoint accepts 0.5 through 0.99 and defaults to 0.7.',
					'--stocked-only limits matches to currently stocked coffees. The HTTP endpoint defaults stocked_only to true.',
					'When an integration needs API-key access, rate-limit headers, or explicit beta response metadata, call GET /v1/catalog/{id}/similar directly.'
				]
			},
			{
				title: 'Search filters',
				bullets: [
					'--origin <text>: partial match across country, continent, and region fields.',
					'--process <text>: partial match on processing method (e.g. washed, natural).',
					'--flavor <text>: partial match on flavor notes (comma-separated for multiple).',
					'--variety <text>: filter by coffee variety or cultivar (partial match).',
					'--drying-method <text>: filter by drying method (partial match, e.g. raised bed, patio).',
					'--name <text>: filter by coffee name (partial match, case-insensitive).',
					'--supplier <name>: filter by supplier or source name (partial match, case-insensitive).',
					'--stocked: only show currently available coffees.',
					'--stocked-days <n>: only show coffees stocked within the last N days.',
					'--price-min <n> / --price-max <n>: filter by price per pound range.',
					'--ids <n,n,...>: fetch specific catalog IDs (comma-separated; ignores --limit).',
					'--sort <price|price-desc|name|origin|newest>: sort results.',
					'--offset <n>: skip N results for pagination.',
					'--limit <n>: maximum results returned (default: 10).'
				]
			},
			{
				title: 'Output formats',
				bullets: [
					'--pretty: formatted output for terminal reading.',
					'--csv: comma-separated output for spreadsheets and data pipelines.',
					'--origin accepts partial matches across country, continent, and region fields.'
				]
			}
		],
		related: [
			{
				href: '/catalog',
				label: 'Web catalog',
				description: 'Browse the same catalog in the web app.'
			},
			{
				href: '/docs/api/catalog',
				label: 'HTTP catalog docs',
				description: 'Compare CLI access with the API-key endpoint.'
			},
			{
				href: '/docs/api/catalog-similarity',
				label: 'Catalog similarity API',
				description: 'The beta HTTP matching endpoint for member sessions and paid API keys.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'Install, authenticate, and see all available commands.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'inventory',
		title: 'CLI inventory commands',
		summary:
			'List, add, update, and delete green coffee inventory from your terminal. Requires authentication.',
		eyebrow: 'Member workflows',
		intro: [
			'Inventory commands manage your green coffee inventory, the same data visible on the /beans page in the web app. Results include catalog details joined to your inventory records.',
			'Inventory IDs are distinct from catalog IDs. Roast commands and other workflows expect inventory IDs.'
		],
		sections: [
			{
				title: 'Commands',
				bullets: [
					'purvey inventory list: list inventory with optional filters including --stocked, --catalog-id, --origin, --purchase-date-start, --purchase-date-end, and --limit.',
					'purvey inventory get <id>: fetch a single inventory item by ID.',
					'purvey inventory add: add a new inventory item (--catalog-id and --qty are required).',
					'purvey inventory update <id>: update fields on an existing inventory item.',
					'purvey inventory delete <id>: delete an item; --force cascades to dependent roast profiles and sales.'
				],
				codeBlocks: [
					{
						label: 'List, add, update, and export',
						language: 'bash',
						code: 'purvey inventory list --stocked --pretty\npurvey inventory list --origin Ethiopia --pretty\npurvey inventory list --catalog-id 128 --pretty\npurvey inventory list --purchase-date-start 2026-01-01 --purchase-date-end 2026-03-31\npurvey inventory add --catalog-id 128 --qty 10 --cost 8.50 --pretty\npurvey inventory update 7 --stocked false\npurvey inventory delete 7 --yes\npurvey inventory delete 7 --force --yes\npurvey inventory list --limit 50 --csv > inventory.csv'
					}
				]
			},
			{
				title: 'add and update flags',
				bullets: [
					'add required flags: --catalog-id (catalog entry ID), --qty (pounds).',
					'add optional flags: --cost, --tax-ship, --notes, --purchase-date, --form.',
					'update fields: --qty, --cost, --tax-ship, --notes, --stocked <true|false>.',
					'delete --force cascades to dependent roast profiles and sales records. Without --force, delete fails if dependents exist.'
				]
			},
			{
				title: 'Important',
				callout: {
					tone: 'warning',
					title: 'Use inventory IDs for roast work',
					body: 'purvey roast --coffee-id expects green_coffee_inv.id values. Do not pass coffee_catalog IDs into roast commands.'
				}
			}
		],
		related: [
			{
				href: '/docs/cli/roast',
				label: 'CLI roast docs',
				description: 'Inventory IDs feed directly into roast create and import flows.'
			},
			{
				href: '/docs/api/inventory',
				label: 'Inventory API docs',
				description: 'Session-authenticated endpoints behind inventory operations.'
			},
			{
				href: '/beans',
				label: 'Inventory page',
				description: 'Manage inventory in the web app.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'roast',
		title: 'CLI roast commands',
		summary:
			'Create roast profiles, import Artisan files, and set up folder watching from the terminal.',
		eyebrow: 'Roasting',
		intro: [
			'Roast commands turn terminal workflows into operational tools. They are especially useful for importing Artisan .alog files and automating roast capture with folder watching.',
			'The CLI encourages purvey roast import when an .alog file is available, extracting curves, events, and milestone timing automatically.'
		],
		sections: [
			{
				title: 'Commands',
				bullets: [
					'purvey roast list: list profiles, optionally filtered by --coffee-id, --roast-id, --batch-name, --coffee-name, --catalog-id, --date-start, or --date-end.',
					'purvey roast get <id>: fetch a single roast profile (--include-temps, --include-events for full telemetry).',
					'purvey roast create: create a roast record manually.',
					'purvey roast import: import an Artisan .alog file.',
					'purvey roast update <id>: update notes, batch name, oz-out, or targets on an existing profile.',
					'purvey roast delete <id>: delete a roast profile.',
					'purvey roast watch: watch a directory for new .alog files with --coffee-id, --batch-prefix, --prompt-each, or --auto-match, and resume long-running sessions with --resume.'
				],
				codeBlocks: [
					{
						label: 'Create, import, list, update, and watch',
						language: 'bash',
						code: 'purvey roast create --coffee-id 7 --batch-name "Ethiopia Guji Light" --oz-in 16 --pretty\npurvey roast import ~/artisan/ethiopia-guji.alog --coffee-id 7 --pretty\npurvey roast list --roast-id 123 --pretty\npurvey roast list --batch-name "Guji" --pretty\npurvey roast list --catalog-id 128 --pretty\npurvey roast update 123 --targets "Aim for FC at 390F, 18% dev"\npurvey roast watch ~/artisan/ --auto-match\npurvey roast watch --resume'
					}
				]
			},
			{
				title: 'Behavior notes',
				bullets: [
					'--coffee-id always refers to green_coffee_inv.id (use purvey inventory list to find IDs), while --catalog-id on roast list cross-references the underlying coffee_catalog row.',
					'--roast-id filters by the exact roast profile ID while keeping the list output shape, which is useful in scripts that already expect arrays.',
					'Import extracts roast curves, events, and milestone timing from .alog files.',
					'Interactive file and directory prompts normalize pasted path input: surrounding quotes are removed, shell-escaped spaces and common special characters are unescaped, and Windows or UNC path separators are preserved.',
					'Interactive --form mode provides a guided workflow for create, import, and watch setup. On roast watch, --auto-match and --coffee-id are mutually exclusive, session state is saved for --resume, and the command runs until interrupted.'
				]
			}
		],
		related: [
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast API docs',
				description: 'Underlying endpoints and chart helpers.'
			},
			{
				href: '/roast',
				label: 'Roast page',
				description: 'Charts and profile editing in the web app.'
			},
			{
				href: '/docs/cli/sales',
				label: 'Sales commands',
				description: 'Record sales after roasting.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'sales',
		title: 'CLI sales commands',
		summary: 'Record roasted-coffee sales from the terminal.',
		eyebrow: 'Sales',
		intro: [
			'Sales commands record roasted-coffee sales against roast profiles. They complement the /profit page in the web app.',
			'The flag-based record flow uses roast IDs, not inventory IDs. Use --form when you want an interactive roast picker instead of passing an ID directly.'
		],
		sections: [
			{
				title: 'Record a sale',
				codeBlocks: [
					{
						label: 'Record and list sales',
						language: 'bash',
						code: 'purvey sales record --roast-id 123 --oz 12 --price 22.00 --buyer "Jane Smith" --pretty\npurvey sales record --form\npurvey sales list --pretty\npurvey sales list --roast-id 123 --pretty\npurvey sales list --buyer "Jane" --date-start 2026-01-01\npurvey sales list --csv > sales.csv'
					}
				],
				bullets: [
					'Required flags for flag-based record: --roast-id, --oz, --price. --buyer and --sell-date are optional.',
					'Use purvey roast list to find roast IDs. The CLI write flow records against roast_data.roast_id, not green_coffee_inv.id or coffee_catalog.id.',
					'--price is the total sale price, not per-ounce. Use --form for an interactive picker when you do not already know the roast ID.'
				]
			},
			{
				title: 'List sales',
				bullets: [
					'--roast-id <id>: filter by roast profile ID.',
					'--date-start / --date-end <YYYY-MM-DD>: filter by date range.',
					'--buyer <name>: filter by buyer name (partial match).',
					'--limit <n>: maximum results returned (default: 20).',
					'--offset <n>: skip rows for pagination when exporting or reconciling larger histories.'
				]
			},
			{
				title: 'Update and delete',
				bullets: [
					'purvey sales update <id>: update oz, price, buyer, or sell-date on an existing sale.',
					'purvey sales delete <id>: delete a sale record.',
					'Both commands expect a sale_id from purvey sales list, not a roast_id.'
				]
			}
		],
		related: [
			{
				href: '/profit',
				label: 'Profit page',
				description: 'Sales data rolls into profit analytics in the web app.'
			},
			{
				href: '/docs/cli/roast',
				label: 'CLI roast docs',
				description: 'Sales depend on roast IDs from roast workflows.'
			},
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast API docs',
				description: 'Related session-authenticated endpoints.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'tasting',
		title: 'CLI tasting commands',
		summary: 'Read supplier tasting notes and record your own cupping scores from the terminal.',
		eyebrow: 'Tasting',
		intro: [
			'Tasting commands combine supplier-provided notes from the catalog with your personal cupping data stored on inventory rows.',
			'Both read and write flows are available, so tasting data works across terminal, browser, and AI chat contexts.'
		],
		sections: [
			{
				title: 'Read and rate',
				codeBlocks: [
					{
						label: 'Retrieve and rate tasting data',
						language: 'bash',
						code: 'purvey tasting get 128 --filter both --pretty\npurvey tasting get 128 --filter supplier --pretty\npurvey tasting rate 7 --aroma 4 --body 3 --acidity 5 --sweetness 4 --aftertaste 4\npurvey tasting rate --form'
					}
				],
				bullets: [
					'The <bean-id> for tasting get is a coffee_catalog ID, not an inventory ID.',
					'purvey tasting rate uses an inventory_id, not a catalog_id. That split mirrors the supplier-notes versus personal-cupping data model.',
					'--filter both returns both supplier and personal notes when available.',
					'Rate supports aroma, body, acidity, sweetness, aftertaste, brew-method, notes, and --form.'
				]
			}
		],
		related: [
			{
				href: '/docs/cli/inventory',
				label: 'CLI inventory docs',
				description: 'Cupping ratings are stored on inventory rows.'
			},
			{
				href: '/docs/cli/catalog',
				label: 'CLI catalog docs',
				description: 'Supplier tasting notes originate in the catalog.'
			},
			{
				href: '/chat',
				label: 'AI chat',
				description: 'The chat workspace includes tasting-note tools.'
			}
		]
	},

	{
		section: 'cli',
		slug: 'context-manifest',
		title: 'CLI context and manifest',
		summary:
			'Understand purvey context, purvey manifest, and how wrappers should onboard to the CLI contract.',
		eyebrow: 'Agent onboarding',
		intro: [
			'purvey context and purvey manifest are related but not interchangeable. context is optimized for dense human or model-readable onboarding text. manifest is the preferred machine-readable contract for shells, wrappers, and agents.',
			'purvey context --json and --pretty emit the same manifest contract for compatibility when an existing caller already uses the context entrypoint. The same contract is also available in-process via @purveyors/cli/manifest.'
		],
		sections: [
			{
				title: 'Which command to use',
				table: {
					headers: ['Need', 'Use', 'Notes'],
					rows: [
						[
							'Dense onboarding text',
							'purvey context',
							'Prints the shipped plain-text agent reference with auth rules, ID maps, workflows, and error patterns.'
						],
						[
							'Preferred machine-readable contract',
							'purvey manifest',
							'Emits the stable manifest JSON on stdout. Use --pretty for indented output.'
						],
						[
							'Compatibility-parity JSON',
							'purvey context --json / --pretty',
							'Use when an existing context caller needs the same manifest contract without changing entrypoints.'
						],
						[
							'Code-side integration',
							'@purveyors/cli/manifest',
							'Prefer the dedicated manifest export when an in-process Node.js or agent runtime needs the same contract.'
						]
					]
				}
			},
			{
				title: 'Examples',
				codeBlocks: [
					{
						label: 'Text-first onboarding',
						language: 'bash',
						code: 'purvey context\npurvey context | head -50\npurvey context > cli-reference.txt'
					},
					{
						label: 'Machine-readable contract',
						language: 'bash',
						code: 'purvey manifest\npurvey manifest --pretty\npurvey context --json > cli-manifest.json'
					}
				],
				bullets: [
					'purvey context prints text by default. Use purvey manifest for the preferred machine-readable contract.',
					'purvey context --json and --pretty intentionally emit the same manifest contract for compatibility with existing context-based callers.',
					'Use --csv only on commands that document CSV support. Neither context nor manifest supports CSV output.'
				]
			},
			{
				title: 'What the manifest contains',
				bullets: [
					'Command groups, subcommands, summaries, examples, and auth requirements.',
					'Output-mode expectations, stderr/stdout notes, structured error-envelope guidance, and compatibility notes.',
					'ID-type reference for catalog_id, inventory_id, roast_id, and sale_id so agents do not confuse resource identifiers.',
					'Workflow examples and common error patterns that help agents recover without reverse-engineering implementation details.'
				],
				callout: {
					tone: 'success',
					title: 'Prefer the documented contract over internal route coupling',
					body: 'If an agent can solve the task with purvey or a direct @purveyors/cli import, prefer that path over binding to internal /api/tools/* or chat workspace payloads.'
				}
			}
		],
		related: [
			{
				href: '/docs/cli/auth-output',
				label: 'Auth, config, and output',
				description: 'See the surrounding scripting contract, not just the onboarding commands.'
			},
			{
				href: '/docs/cli/agent-integration',
				label: 'Agent integration',
				description: 'How the web app and external agents consume CLI modules and contracts.'
			},
			{
				href: '/docs/api/overview',
				label: 'API overview',
				description: 'Compare the CLI contract with the public HTTP contract.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'agent-integration',
		title: 'Agent integration',
		summary:
			'Use the Parchment CLI as a stable interface for AI agents, coding assistants, and external automation.',
		eyebrow: 'Agent workflows',
		intro: [
			'The CLI is the preferred documented automation surface for most non-visual workflows. It gives agents stable command names, explicit auth requirements, predictable output modes, and a machine-readable manifest when needed.',
			'The Purveyors web app also imports CLI modules directly for chat tools, which keeps browser, terminal, and agent behavior aligned on shared domain logic.'
		],
		sections: [
			{
				title: 'Recommended agent patterns',
				bullets: [
					'For shell-based automation, authenticate once, then call purvey commands with JSON or CSV output that suits the surrounding workflow.',
					'For code-side integrations, import stable subpaths such as @purveyors/cli/catalog, @purveyors/cli/inventory, @purveyors/cli/roast, @purveyors/cli/sales, @purveyors/cli/tasting, @purveyors/cli/manifest, @purveyors/cli/artisan, or @purveyors/cli/ai instead of screen-scraping CLI help text.',
					'Use purvey context first when a model needs dense onboarding text. Use purvey manifest for the preferred machine-readable contract, or purvey context --json when an existing caller needs compatibility-parity output.',
					'Prefer the CLI or its shared modules over coupling to deprecated /api/tools/* endpoints or private workspace route payloads.'
				]
			},
			{
				title: 'How the web app uses the CLI',
				bullets: [
					'The app imports CLI modules for catalog, inventory, roast, sales, and tasting operations inside chat tool execution. The CLI package also publishes manifest, Artisan, and AI helper subpaths for agent and integration surfaces.',
					'Read tools execute shared CLI functions directly. Write tools stay user-confirmed through proposal cards and constrained execution routes.',
					'This architecture keeps terminal, browser, and agent workflows aligned on the same domain rules and reduces drift between docs and implementation.'
				],
				codeBlocks: [
					{
						label: 'Agent bootstrap sequence',
						language: 'bash',
						code: 'purvey auth login --headless\npurvey manifest --pretty\npurvey catalog search --origin "Ethiopia" --json'
					}
				]
			}
		],
		related: [
			{
				href: '/docs/cli/context-manifest',
				label: 'Context and manifest',
				description: 'Dense onboarding text, manifest output, and wrapper guidance.'
			},
			{
				href: '/docs/cli/auth-output',
				label: 'Auth, config, and output',
				description: 'See the scripting guarantees that make CLI automation reliable.'
			},
			{
				href: '/chat',
				label: 'AI chat workspace',
				description: 'The web UI that consumes CLI modules.'
			}
		]
	}
];

export function getDocsSection(section: string): DocsNavSection | undefined {
	return DOCS_NAV.find((item) => item.key === section);
}

export function getDocsPage(section: string, slug: string): DocsPage | undefined {
	return docsPages.find((page) => page.section === section && page.slug === slug);
}

export function getDocsPagesForSection(section: DocsSectionKey): DocsPage[] {
	return docsPages.filter((page) => page.section === section);
}

export function getDefaultSlug(section: string): string | undefined {
	return getDocsSection(section)?.items[0]?.slug;
}

export function getPrevNextDocs(
	section: string,
	slug: string
): {
	prev?: DocsNavItem;
	next?: DocsNavItem;
} {
	const navSection = getDocsSection(section);
	if (!navSection) return {};

	const index = navSection.items.findIndex((item) => item.slug === slug);
	if (index === -1) return {};

	return {
		prev: index > 0 ? navSection.items[index - 1] : undefined,
		next: index < navSection.items.length - 1 ? navSection.items[index + 1] : undefined
	};
}
