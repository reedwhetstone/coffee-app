export type DocsSectionKey = 'api' | 'cli';

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
			'Public catalog contract, platform route matrix, analytics, billing flows, auth, and operational guidance.',
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
				slug: 'platform',
				title: 'Platform routes',
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
		section: 'api',
		slug: 'overview',
		title: 'API overview',
		summary:
			'Parchment Platform ships one stable public catalog API and a larger internal platform route layer for the web app.',
		eyebrow: 'Parchment Platform',
		intro: [
			'Parchment is the API and Console layer inside Purveyors. It exposes normalized green coffee catalog data through a small public HTTP contract and a broader authenticated product backend. Those surfaces share domain logic, but they do not carry the same compatibility promises.',
			'The stable public contract is GET /v1/catalog. Anonymous requests are supported for public discovery, while API-key requests are the intended production integration path because they carry plan enforcement and X-RateLimit-* usage headers. Most /api/* routes exist to power the Purveyors web platform: catalog UI helpers, inventory, roast workflows, sales tracking, AI chat, workspaces, billing, and admin tooling.'
		],
		sections: [
			{
				title: 'Surface map',
				body: [
					'Treat the platform as two layers. /v1/* is the public namespace for external integrations. /api/* is the first-party application layer. Some /api/* routes are still externally reachable, but that does not make them stable public contracts.'
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
					'GET /v1/catalog supports API-key requests via Authorization: Bearer <api_key>. API-key requests stay public-only, use plan-based limits, and are the intended production path for server-to-server integrations.',
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
			'GET /v1/catalog is the canonical external endpoint. It returns normalized coffee listings with origin, processing method, pricing, price tiers, and availability metadata.',
			'The endpoint supports three canonical auth contexts: anonymous, first-party session, and API key. Anonymous and viewer-session requests are public-only. Member and admin sessions may unlock richer in-app visibility. API-key requests stay public-only, use plan-based limits, and are the only ones that receive X-RateLimit-* headers. Use anonymous access for discovery and proof-of-value. Use API keys for production integrations that need quota visibility and a durable machine contract. When page and limit are both omitted, the canonical listing response defaults to page 1 and up to 100 rows before any plan-based cap is applied.'
		],
		sections: [
			{
				title: 'Namespace and compatibility',
				bullets: [
					'GET /v1 returns the public namespace descriptor and links callers to /v1/catalog.',
					'GET /v1/catalog is the source-of-truth public contract for integrations.',
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
					'Viewer-tier API keys are capped to 25 rows per call. Member and enterprise API plans are uncapped at the row level. Anonymous and viewer-session requests are public-only unless a privileged member session explicitly enables wholesale visibility.',
					'Cookies are not part of the public API contract. They only matter when they resolve to a valid first-party session, and the legacy /api/catalog-api alias does not accept session auth as a substitute for an API key.'
				],
				codeBlocks: [
					{
						label: 'GET /v1/catalog',
						language: 'json',
						code: '{\n  "data": [\n    {\n      "id": 128,\n      "name": "Ethiopia Guji",\n      "region": "Guji",\n      "processing": "Natural",\n      "price_per_lb": 7.5,\n      "cost_lb": 7.5,\n      "price_tiers": [{ "min_lbs": 1, "price": 7.5 }],\n      "stocked": true,\n      "source": "sweet_marias",\n      "country": "Ethiopia",\n      "continent": "Africa"\n    }\n  ],\n  "pagination": {\n    "page": 1,\n    "limit": 25,\n    "total": 814,\n    "totalPages": 33,\n    "hasNext": true,\n    "hasPrev": false\n  },\n  "meta": {\n    "resource": "catalog",\n    "namespace": "/v1/catalog",\n    "version": "v1",\n    "auth": { "kind": "api-key", "role": "viewer", "apiPlan": "viewer" },\n    "access": {\n      "publicOnly": true,\n      "showWholesale": false,\n      "wholesaleOnly": false,\n      "rowLimit": 25,\n      "limited": true,\n      "totalAvailable": 814\n    },\n    "cache": { "hit": false, "timestamp": null }\n  }\n}'
					}
				]
			},
			{
				title: 'Query parameters',
				body: [
					'If page is supplied without limit, the route uses a 15-row pagination fallback. If both page and limit are omitted, the canonical listing path uses the 100-row default listing contract.',
					'Malformed numeric params now fail closed with 400 responses instead of silently falling back. That applies to page, limit, stocked_days, score_value_min, score_value_max, price_per_lb_min, price_per_lb_max, and their deprecated cost_lb aliases.',
					'Anonymous discovery is narrower than the full contract. Public teaser requests are limited to the default stocked-only first page and only allow country, processing, and name filters.'
				],
				table: {
					headers: ['Parameter', 'Type', 'Default', 'Description'],
					rows: [
						['page', 'integer', '1', 'Page number for paginated results.'],
						[
							'limit',
							'integer',
							'100 when page and limit are both omitted; otherwise 15 fallback',
							'Rows per page before any plan cap is applied. Invalid values return 400.'
						],
						[
							'ids',
							'integer (repeatable)',
							'—',
							'Fetch specific catalog IDs. When present, pagination is ignored and results are sorted by name ascending.'
						],
						[
							'fields',
							'full | dropdown',
							'full',
							'dropdown returns the reduced projection used by filter UIs and select menus.'
						],
						[
							'stocked',
							'true | false | all',
							'true',
							'Filter to stocked-only, unstocked-only, or the full catalog.'
						],
						['origin', 'string', '—', 'Partial match across continent, country, and region.'],
						['country', 'string', '—', 'Exact match on country.'],
						['continent', 'string', '—', 'Exact match on continent.'],
						[
							'source',
							'string (repeatable)',
							'—',
							'Repeat to filter across multiple supplier slugs.'
						],
						['processing', 'string', '—', 'Partial match on processing method.'],
						['name', 'string', '—', 'Partial match on coffee name.'],
						['region', 'string', '—', 'Partial match on region.'],
						['cultivar_detail', 'string', '—', 'Partial match on cultivar or variety detail.'],
						['type', 'string', '—', 'Partial match on type.'],
						['grade', 'string', '—', 'Partial match on grade.'],
						['appearance', 'string', '—', 'Partial match on appearance.'],
						['price_per_lb_min / price_per_lb_max', 'number', '—', 'Canonical price filters.'],
						[
							'cost_lb_min / cost_lb_max',
							'number',
							'—',
							'Deprecated compatibility aliases for the canonical price filters. Prefer price_per_lb_min / price_per_lb_max in new integrations.'
						],
						['score_value_min', 'number', '—', 'Minimum cupping or quality score (inclusive).'],
						['score_value_max', 'number', '—', 'Maximum cupping or quality score (inclusive).'],
						[
							'arrival_date',
							'string (YYYY-MM-DD)',
							'—',
							'Filter to coffees with a specific arrival date.'
						],
						[
							'stocked_date',
							'string (YYYY-MM-DD)',
							'—',
							'Filter to coffees stocked on or after a given absolute date. Invalid formats return 400.'
						],
						[
							'stocked_days',
							'integer',
							'—',
							'Filter to coffees stocked within the last N days. Use stocked_date for absolute dates.'
						],
						[
							'showWholesale',
							'boolean',
							'false',
							'Only effective for privileged member sessions. Ignored for anonymous and API-key requests.'
						],
						[
							'wholesaleOnly',
							'boolean',
							'false',
							'Requires showWholesale=true and a privileged member session.'
						],
						['sortField', 'string', 'arrival_date', 'Sort field for non-ID queries.'],
						['sortDirection', 'asc | desc', 'desc', 'Sort direction for non-ID queries.']
					]
				}
			},
			{
				title: 'Access mode comparison',
				table: {
					headers: ['Mode', 'Best for', 'Headers', 'Data scope'],
					rows: [
						[
							'Anonymous /v1/catalog',
							'Discovery, evaluation, and public embeds',
							'Cache-Control only',
							'Public-only teaser contract: first page only, max 15 rows, default stocked_date desc sort, and only country / processing / name filters.'
						],
						[
							'API-key /v1/catalog',
							'Production integrations and accounted usage',
							'Cache-Control plus X-RateLimit-*',
							'Public-only catalog data with plan limits, row caps where applicable, and stable compatibility guarantees.'
						],
						[
							'Session /v1/catalog',
							'First-party product reads',
							'Session-dependent app headers only',
							'Viewer stays public-only; member/admin may see richer in-app visibility. First-party product path only.'
						],
						[
							'GET /api/catalog-api',
							'Legacy API-key callers during migration',
							'Deprecation, Sunset, Link, plus X-RateLimit-*',
							'Public-only catalog data via deprecated alias'
						]
					]
				},
				bullets: [
					'Anonymous calls are intentionally narrower than API-key calls. They do not support ids, fields=dropdown, page > 1, or arbitrary filter combinations.',
					'If an Authorization header is present but invalid, the route returns 401 instead of silently treating the request as anonymous.'
				]
			},
			{
				title: 'Example requests',
				codeBlocks: [
					{
						label: 'Anonymous teaser request',
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
						code: 'import os\nimport requests\n\nresponse = requests.get(\n    "https://purveyors.io/v1/catalog",\n    params={"processing": "washed", "limit": 25},\n    headers={"Authorization": f"Bearer {os.environ["PARCHMENT_API_KEY"]}"},\n    timeout=30,\n)\nresponse.raise_for_status()\npayload = response.json()\nprint(payload["pagination"]["total"], payload["meta"]["auth"])'
					}
				]
			},
			{
				title: 'Tier limits and headers',
				table: {
					headers: ['Marketed plan', 'Code key', 'Monthly requests', 'Rows per call', 'Notes'],
					rows: [
						['Green', 'viewer', '200', '25', 'Best for evaluation and prototypes.'],
						[
							'Origin',
							'member',
							'10,000',
							'Unlimited',
							'Self-serve paid tier for production integrations and sync jobs.'
						],
						[
							'Enterprise',
							'enterprise',
							'Unlimited',
							'Unlimited',
							'Contact-sales plan for custom commercial volume and support.'
						]
					]
				},
				bullets: [
					'The public docs use marketed tier names Green, Origin, and Enterprise, while API responses and server code use apiPlan keys viewer, member, and enterprise.',
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
		slug: 'platform',
		title: 'Platform route matrix',
		summary:
			'Authenticated and internal /api/* routes that power the Purveyors product surface, grouped by capability and stability.',
		eyebrow: 'Internal platform routes',
		intro: [
			'This page is the route map for the first-party platform. These endpoints matter for contributors, support, internal tooling, and advanced product debugging.',
			'Most of these routes are not public compatibility promises. Document them accurately, but keep external integrations pointed at /v1/catalog or @purveyors/cli whenever possible.'
		],
		sections: [
			{
				title: 'Catalog and discovery routes',
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
			'Create, import, analyze, and clear roast profiles through session-authenticated platform endpoints.',
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
			'The /analytics page delivers market intelligence derived from the same normalized catalog that powers the public API. Public visitors can browse major market summaries, while deeper product experiences layer on top of authenticated access and platform state.',
			'Analytics is important to the platform story, but it is not currently sold as a separate API-key namespace. When documenting analytics, keep the distinction between product UI and public REST contract explicit.'
		],
		sections: [
			{
				title: 'What is public today',
				bullets: [
					'/analytics is a web product surface, not an API-key endpoint family.',
					'The public catalog and public analytics should be cross-linked because they describe the same coffee market from different angles: raw records versus curated analysis.',
					'Authenticated and premium analytics views may expose deeper app features, but they still ride through the first-party product rather than a stable public REST schema.'
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
			'The billing and admin layer sits behind the Parchment Console and subscription flows. These routes are operational, not public platform APIs.',
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
				}
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
							'Missing query params, bad form payloads, unsupported import files, invalid catalog dates, anonymous contract violations',
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
						label: '400 Anonymous contract violation',
						language: 'json',
						code: '{\n  "error": "Anonymous catalog contract violation",\n  "message": "Anonymous catalog requests only allow filters: country, processing, name",\n  "details": {\n    "parameter": "origin"\n  }\n}'
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
					'Anonymous /v1/catalog calls are intentionally constrained: first page only, max 15 rows, default stocked_date desc sort, and only country / processing / name filters.',
					'GET /api/beans with no session and no valid share token returns an empty data array, not a 401. Do not mistake that behavior for public inventory access.',
					'Catalog rate-limit headers only exist on API-key requests. Anonymous and session requests to /v1/catalog do not emit X-RateLimit-* headers.',
					'An invalid Authorization header on the public catalog can turn what looks like an anonymous request into a 401 because the route detects an auth attempt that failed.',
					'/api-dashboard/keys/generate returns the plaintext apiKey only at creation time. Plan Console UX and support docs around that one-time reveal.',
					'Cookies only matter when they resolve to a valid first-party session. A stray Cookie header is not part of the public API contract.',
					'/api/catalog-api is a deprecated API-key-only alias. It should not be treated as an anonymous or session-friendly discovery route.',
					'Workspace and chat routes mostly use member-role enforcement, so 403 is often the expected failure for logged-in non-members.',
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
					'purvey auth login launches the browser OAuth flow. purvey auth login --headless prints a URL and expects a pasted callback URL, which is better for agents and remote hosts.',
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
			'The search command supports filters for origin, processing method, price range, flavor notes, stocked-only, and result limits. If the goal is anonymous discovery or API-key integration, use GET /v1/catalog instead. See the CLI overview for install and login instructions.'
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
					'purvey inventory list: list inventory with optional filters — --stocked, --catalog-id, --origin, --purchase-date-start, --purchase-date-end, --limit.',
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
					'purvey roast watch: watch a directory for new .alog files with --coffee-id, --prompt-each, or --auto-match, and resume long-running sessions with --resume.'
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
					'Interactive --form mode provides a guided workflow for create, import, and watch setup. --auto-match and --coffee-id are mutually exclusive on roast watch.'
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
			'The record flow uses roast IDs, not inventory IDs.'
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
					'Required flags for record: --roast-id, --oz, --price.',
					'Use purvey roast list to find roast IDs. The CLI write flow uses roast_id, not inventory_id.',
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
					'For code-side integrations, import stable subpaths such as @purveyors/cli/catalog, @purveyors/cli/inventory, @purveyors/cli/roast, @purveyors/cli/sales, @purveyors/cli/tasting, or @purveyors/cli/manifest instead of screen-scraping CLI help text.',
					'Use purvey context first when a model needs dense onboarding text. Use purvey manifest for the preferred machine-readable contract, or purvey context --json when an existing caller needs compatibility-parity output.',
					'Prefer the CLI or its shared modules over coupling to deprecated /api/tools/* endpoints or private workspace route payloads.'
				]
			},
			{
				title: 'How the web app uses the CLI',
				bullets: [
					'The app imports CLI modules for catalog, inventory, roast, sales, and tasting operations inside chat tool execution.',
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
