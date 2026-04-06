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
			'Catalog API reference, authentication, tier limits, response format, and supporting endpoints.',
		basePath: '/docs/api',
		items: [
			{
				slug: 'overview',
				title: 'Overview',
				summary: 'Architecture, authentication, and how the API, Console, and CLI fit together.'
			},
			{
				slug: 'catalog',
				title: 'Catalog',
				summary:
					'The public catalog endpoint: fields, response format, tier-based limits, and caching.'
			},
			{
				slug: 'analytics',
				title: 'Analytics',
				summary: 'Market intelligence surfaces, access tiers, and analytics capabilities.'
			},
			{
				slug: 'roast-profiles',
				title: 'Roast profiles',
				summary: 'Roast CRUD, Artisan imports, chart data, and AI classification.'
			},
			{
				slug: 'inventory',
				title: 'Inventory',
				summary: 'Green coffee inventory CRUD, share links, and stocked-state management.'
			},
			{
				slug: 'errors',
				title: 'Errors and auth',
				summary: 'Status codes, error shapes, rate limits, and authentication reference.'
			}
		]
	},
	{
		key: 'cli',
		title: 'CLI docs',
		description:
			'Install, authenticate, and use the Parchment CLI for catalog queries, inventory, roasting, and automation.',
		basePath: '/docs/cli',
		items: [
			{
				slug: 'overview',
				title: 'Overview',
				summary: 'Install, authenticate, and explore the CLI command structure.'
			},
			{
				slug: 'catalog',
				title: 'Catalog',
				summary: 'Search the public catalog from your terminal.'
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
			'Parchment Platform exposes a public catalog API for external consumers and a session-authenticated API for the web app.',
		eyebrow: 'Parchment Platform',
		intro: [
			'The Parchment API provides programmatic access to normalized green coffee data from 39+ suppliers. Authenticate with an API key and start pulling catalog data in minutes.',
			'The platform also includes a session-authenticated API that powers the web app (inventory, roasting, sales, and chat). These docs cover both surfaces so you always know which endpoints are available to you.'
		],
		sections: [
			{
				title: 'API surfaces',
				table: {
					headers: ['Surface', 'Auth', 'Description', 'Access'],
					rows: [
						[
							'/v1/catalog',
							'Bearer API key or web session',
							'Canonical catalog endpoint',
							'All tiers'
						],
						['/api-dashboard', 'Web session', 'Console for keys and usage', 'Authenticated users'],
						[
							'/api/catalog',
							'Web session',
							'Paginated catalog for the web app',
							'Authenticated users'
						],
						[
							'/api/beans, /api/roast-profiles, /api/profit',
							'Web session',
							'Inventory, roasting, and sales',
							'Members'
						],
						[
							'/api/chat, /api/workspaces, /api/tools/*',
							'Member session',
							'AI chat, tool execution, workspace memory',
							'Members'
						]
					]
				}
			},
			{
				title: 'Authentication',
				bullets: [
					'External API consumers send Authorization: Bearer <api_key> to /v1/catalog.',
					'API keys are created and managed in the Parchment Console at /api-dashboard/keys.',
					'Access tiers (Explorer, Roaster+, Enterprise) determine rate limits and row caps.',
					'Web app endpoints use Supabase session cookies. Member-only routes require an active membership.'
				],
				codeBlocks: [
					{
						label: 'Catalog API request',
						language: 'bash',
						code: 'curl https://purveyors.io/v1/catalog \\\n  -H "Authorization: Bearer pk_live_your_key_here"'
					}
				]
			},
			{
				title: 'Getting started',
				bullets: [
					'Sign up at purveyors.io and generate an API key in the Parchment Console.',
					'Read the Catalog docs for endpoint details, response format, and code examples.',
					'Use the CLI (purvey catalog search) for quick terminal-based exploration.'
				]
			}
		],
		related: [
			{
				href: '/docs/api/catalog',
				label: 'Catalog reference',
				description: 'Fields, limits, headers, and response examples for the public feed.'
			},
			{
				href: '/api-dashboard',
				label: 'Parchment Console',
				description: 'Generate keys, inspect usage, and manage your API access.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'Terminal access to the same catalog and member workflows.'
			}
		]
	},
	{
		section: 'api',
		slug: 'catalog',
		title: 'Catalog API',
		summary:
			'The public catalog endpoint returns normalized green coffee data from 39+ suppliers with tier-based rate limits.',
		eyebrow: 'Public endpoint',
		intro: [
			'GET /v1/catalog is the canonical catalog endpoint. It returns normalized coffee listings with origin, processing method, pricing (including price tiers), and availability data. Authenticate with an API key or web session to start pulling data.',
			'Responses include structured pagination, access metadata, and rate-limit headers so you can build reliable integrations.'
		],
		sections: [
			{
				title: 'Request and response',
				body: [
					'The catalog endpoint returns the full feed of publicly visible listings. Use query parameters for filtering, pagination, and sorting.',
					'Each response includes data (the listings array), pagination metadata, and a meta block with auth, access, and cache details.'
				],
				codeBlocks: [
					{
						label: 'GET /v1/catalog',
						language: 'json',
						code: '{\n  "data": [\n    {\n      "id": 128,\n      "name": "Ethiopia Guji",\n      "region": "Guji",\n      "processing": "Natural",\n      "price_per_lb": 7.5,\n      "cost_lb": 7.5,\n      "price_tiers": [{ "min_lbs": 1, "price": 7.5 }],\n      "stocked": true,\n      "source": "sweet_marias",\n      "country": "Ethiopia",\n      "continent": "Africa"\n    }\n  ],\n  "pagination": { "page": 1, "limit": 25, "total": 814, "totalPages": 33, "hasNext": true, "hasPrev": false },\n  "meta": {\n    "resource": "catalog",\n    "namespace": "/v1/catalog",\n    "version": "v1",\n    "auth": { "kind": "api-key", "role": "viewer", "apiPlan": "viewer" },\n    "access": { "publicOnly": true, "rowLimit": 25, "limited": true, "totalAvailable": 814 },\n    "cache": { "hit": false, "timestamp": null }\n  }\n}'
					}
				]
			},
			{
				title: 'Query parameters',
				table: {
					headers: ['Parameter', 'Type', 'Default', 'Description'],
					rows: [
						['page', 'integer', '1', 'Page number for paginated results.'],
						['limit', 'integer', '15', 'Rows per page (capped by tier row limit).'],
						[
							'stocked',
							'true | false | all',
							'true',
							'Filter by stocked state. true returns only currently available beans. false returns only unstocked/historical items. all returns the full catalog regardless of stocked state.'
						],
						[
							'origin',
							'string',
							'—',
							'Partial match across continent, country, and region fields. origin=Ethiopia matches Ethiopian coffees; origin=Africa matches all African origins.'
						],
						['country', 'string', '—', 'Exact match on the country field.'],
						['continent', 'string', '—', 'Exact match on the continent field.'],
						[
							'source',
							'string (repeatable)',
							'—',
							'Filter by supplier slug. Repeat to match multiple sources.'
						],
						[
							'processing',
							'string',
							'—',
							'Partial match on processing method (e.g. washed, natural).'
						],
						['name', 'string', '—', 'Partial match on coffee name.'],
						['region', 'string', '—', 'Partial match on region field.'],
						['price_per_lb_min', 'number', '—', 'Minimum price per pound (inclusive).'],
						['price_per_lb_max', 'number', '—', 'Maximum price per pound (inclusive).'],
						['sortField', 'string', 'arrival_date', 'Field to sort by.'],
						['sortDirection', 'asc | desc', 'desc', 'Sort direction.']
					]
				}
			},
			{
				title: 'Tier limits',
				table: {
					headers: ['Tier', 'Monthly requests', 'Rows per call', 'Best for'],
					rows: [
						['Explorer', '200', '25', 'Evaluation and prototyping'],
						['Roaster+', '10,000', 'Unlimited', 'Production integrations and regular syncs'],
						['Enterprise', 'Unlimited', 'Unlimited', 'High-volume platforms and premium support']
					]
				}
			},
			{
				title: 'Rate-limit headers',
				bullets: [
					'X-RateLimit-Limit: your monthly request cap.',
					'X-RateLimit-Remaining: requests left in the current billing period.',
					'X-RateLimit-Reset: timestamp when the limit resets.',
					'429 responses include a Retry-After header.'
				]
			},
			{
				title: 'Web app catalog route',
				bullets: [
					'The web app uses a separate route (GET /api/catalog) for paginated browsing, dropdown payloads, and filter UI.',
					'This route uses session authentication and may change with app updates.'
				],
				callout: {
					tone: 'warning',
					title: 'Do not confuse the two catalog routes',
					body: '/v1/catalog is the canonical endpoint for both external integrations (API key) and the web app (session auth). /api/catalog is a legacy internal route that delegates to the same resource.'
				}
			}
		],
		related: [
			{
				href: '/api',
				label: 'API product page',
				description: 'Plans, pricing, and getting started.'
			},
			{
				href: '/catalog',
				label: 'Public catalog',
				description: 'Browse the catalog in the web app.'
			},
			{
				href: '/docs/cli/catalog',
				label: 'CLI catalog docs',
				description: 'Search the catalog from your terminal with purvey catalog search.'
			}
		]
	},
	{
		section: 'api',
		slug: 'analytics',
		title: 'Market analytics',
		summary:
			'Parchment analytics provides daily market intelligence with public, authenticated, and premium access tiers.',
		eyebrow: 'Market intelligence',
		intro: [
			'The /analytics page delivers daily green coffee market intelligence. Public visitors see supplier counts, origin coverage, price trends, and processing distribution. Authenticated users unlock deeper views, and premium access adds advanced analytics.',
			'Analytics is a web product today, not a standalone API. The data is the same normalized catalog that powers the API, presented through interactive charts and tables.'
		],
		sections: [
			{
				title: 'Access tiers',
				bullets: [
					'Public: supplier count, stocked bean counts, origin coverage, price trends by origin, processing-method distribution, and origin price ranges.',
					'Authenticated: everything above, plus supplier price comparison, catalog health metrics, and arrival/delisting tracking.',
					'Premium: spread analysis, origin-level price index tables, and extended trend windows.'
				]
			},
			{
				title: 'Roast analytics endpoints',
				bullets: [
					'GET /api/roast-chart-data returns sampled roast telemetry and metadata for a given roast ID.',
					'GET and POST /api/roast-chart-settings manage per-user chart display preferences.',
					'POST /api/ai/classify-roast provides AI-assisted roast curve classification.',
					'DELETE /api/clear-roast clears roast data for a specific flow.'
				],
				codeBlocks: [
					{
						label: 'Roast chart data',
						language: 'bash',
						code: 'curl "https://purveyors.io/api/roast-chart-data?roastId=123" \\\n  -H "Cookie: <session-cookie>"'
					}
				]
			}
		],
		related: [
			{
				href: '/analytics',
				label: 'Market analytics',
				description: 'Explore the live analytics product.'
			},
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast APIs',
				description: 'Roast CRUD, imports, and chart endpoints.'
			},
			{
				href: '/docs/api/errors',
				label: 'Errors and auth',
				description: 'How analytics endpoints handle unauthenticated requests.'
			}
		]
	},
	{
		section: 'api',
		slug: 'roast-profiles',
		title: 'Roast profile routes',
		summary: 'Create, import, and manage roast profiles through session-authenticated endpoints.',
		eyebrow: 'Roasting',
		intro: [
			'Roast endpoints support full CRUD for roast profiles, Artisan .alog file imports, chart data retrieval, and AI-assisted classification. All roast routes require an authenticated session.',
			'The web app and CLI both reference green_coffee_inv IDs for the coffee input and roast_id values for stored profiles.'
		],
		sections: [
			{
				title: 'Endpoints',
				table: {
					headers: ['Route', 'Methods', 'Purpose'],
					rows: [
						[
							'/api/roast-profiles',
							'GET POST PUT DELETE',
							'List, create, update, or delete roast profiles'
						],
						['/api/artisan-import', 'POST', 'Import an Artisan .alog file into a roast profile'],
						['/api/roast-chart-data', 'GET', 'Sampled roast telemetry and metadata'],
						['/api/roast-chart-settings', 'GET POST', 'Per-user chart display preferences'],
						['/api/clear-roast', 'DELETE', 'Clear roast data for a specific flow'],
						['/api/ai/classify-roast', 'POST', 'AI-assisted roast curve classification']
					]
				}
			},
			{
				title: 'Key behaviors',
				bullets: [
					'All roast endpoints return 401 when no session is present.',
					'POST /api/roast-profiles supports single and batch creation, and updates stocked status for affected inventory items.',
					'DELETE supports single deletion by ID or batch deletion by name.',
					'Chart data is sampled for performance. Expect summarized telemetry, not raw sensor readings.'
				]
			},
			{
				title: 'CLI access',
				body: [
					'The CLI provides purvey roast list, purvey roast create, purvey roast import, and purvey roast watch commands. These are the simplest way to work with roast data outside the browser.'
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
				description: 'Charts and profile management in the web app.'
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
		slug: 'inventory',
		title: 'Inventory routes',
		summary:
			'Manage green coffee inventory, create share links, and track stocked state through session-authenticated endpoints.',
		eyebrow: 'Inventory',
		intro: [
			'Inventory is where catalog data becomes your operational data. The core route is /api/beans, supporting list, create, update, and delete operations on your green coffee inventory.',
			'Share-token reads allow limited public views of inventory items without exposing your full session.'
		],
		sections: [
			{
				title: 'Endpoints',
				table: {
					headers: ['Route', 'Methods', 'Purpose'],
					rows: [
						['/api/beans', 'GET POST PUT DELETE', 'Inventory CRUD and shared-link reads'],
						['/api/share', 'POST', 'Create share links for beans or collections'],
						[
							'/api/update-stocked-status',
							'POST',
							'Recalculate stocked state after roast or sales changes'
						],
						['/api/workspaces', 'GET POST PUT DELETE', 'Chat workspace metadata and memory']
					]
				}
			},
			{
				title: 'Create and update behavior',
				bullets: [
					'POST /api/beans creates manual inventory entries when no catalog_id is provided and manual_name is present.',
					'PUT /api/beans updates only known inventory fields.',
					'DELETE /api/beans enforces ownership before removing inventory and related data.',
					'Share-token GET requests return shared data without granting broader account access.'
				]
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
						label: 'Add inventory',
						language: 'bash',
						code: 'purvey inventory add --help'
					}
				],
				callout: {
					tone: 'note',
					title: 'Inventory IDs are not catalog IDs',
					body: 'Roast commands and other endpoints expect green_coffee_inv.id values, not coffee_catalog IDs. Use purvey inventory list to find the correct IDs.'
				}
			}
		],
		related: [
			{
				href: '/beans',
				label: 'Inventory page',
				description: 'Manage your inventory in the web app.'
			},
			{
				href: '/docs/cli/inventory',
				label: 'CLI inventory docs',
				description: 'Terminal workflows for listing and managing inventory.'
			},
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast docs',
				description: 'Roasts consume inventory IDs and update stocked status.'
			}
		]
	},
	{
		section: 'api',
		slug: 'errors',
		title: 'Errors, auth, and limits',
		summary:
			'Status codes, error response shapes, and practical guidance for handling authentication and rate limits.',
		eyebrow: 'Reference',
		intro: [
			'The Parchment API uses standard HTTP status codes. Error responses include structured JSON with an error field and a human-readable message.',
			'The most common issues are missing API keys (401), insufficient permissions (403), and rate-limit exhaustion (429).'
		],
		sections: [
			{
				title: 'Status codes',
				table: {
					headers: ['Status', 'Meaning'],
					rows: [
						['200', 'Request succeeded'],
						['201', 'Resource created (e.g., new workspace)'],
						['303', 'Redirect to the correct docs entry point'],
						['401', 'Missing or invalid authentication (API key or session)'],
						['403', 'Authenticated but lacking the required role or resource ownership'],
						['404', 'Resource not found or not visible to your account'],
						['429', 'Monthly rate limit exhausted for your current tier'],
						['500', 'Unexpected server error']
					]
				}
			},
			{
				title: 'Error response examples',
				codeBlocks: [
					{
						label: '401 Unauthorized',
						language: 'json',
						code: '{\n  "error": "Authentication required",\n  "message": "Valid API key required for access"\n}'
					},
					{
						label: '429 Rate limit exceeded',
						language: 'json',
						code: '{\n  "error": "Rate limit exceeded",\n  "message": "API rate limit exceeded for your subscription plan",\n  "limit": 200,\n  "remaining": 0,\n  "resetTime": "2026-04-01T00:00:00.000Z"\n}'
					}
				]
			},
			{
				title: 'Troubleshooting',
				bullets: [
					'For public catalog access, use an API key with /v1/catalog or the CLI catalog commands.',
					'A 403 on inventory, roast, or sales routes usually means a role or ownership mismatch, not an authentication failure.',
					'On 429, check the X-RateLimit-* headers for reset timing, or upgrade your plan in the Parchment Console.',
					'The Parchment Console at /api-dashboard shows your current usage, active keys, and tier limits.'
				]
			}
		],
		related: [
			{
				href: '/api-dashboard/usage',
				label: 'Usage analytics',
				description: 'Monitor key activity, usage, and rate-limit status.'
			},
			{
				href: '/docs/api/overview',
				label: 'API overview',
				description: 'Authentication model and API surface reference.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'The CLI is often the fastest way to validate auth and access.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'overview',
		title: 'CLI overview',
		summary:
			'The Parchment CLI is a terminal interface for catalog queries, inventory management, roasting workflows, and agent automation.',
		eyebrow: '@purveyors/cli',
		intro: [
			'The Parchment CLI (purvey) provides terminal access to the same data and workflows available in the web app. Public catalog queries work without authentication; member commands require a login.',
			'The CLI is also the integration layer for AI agents and automation tools. The purvey context command outputs a machine-readable reference for onboarding external tools.'
		],
		sections: [
			{
				title: 'Install and authenticate',
				codeBlocks: [
					{
						label: 'Install',
						language: 'bash',
						code: 'npm install -g @purveyors/cli'
					},
					{
						label: 'Authenticate',
						language: 'bash',
						code: 'purvey auth login --headless'
					}
				],
				bullets: [
					'purvey catalog commands work without authentication.',
					'purvey inventory, roast, sales, and tasting commands require a login.',
					'purvey context outputs a compact reference for AI agents and coding assistants.'
				]
			},
			{
				title: 'Command groups',
				bullets: [
					'purvey auth: manage login state.',
					'purvey catalog: browse the public coffee catalog.',
					'purvey inventory: list, add, update, and delete green coffee inventory.',
					'purvey roast: create roast profiles, import Artisan files, watch folders.',
					'purvey sales: record roasted-coffee sales.',
					'purvey tasting: read supplier notes and record cupping scores.',
					'purvey context: output the CLI reference for agent onboarding.'
				]
			},
			{
				title: 'When to use the CLI vs. the API vs. the web app',
				bullets: [
					'Use the CLI for scripting, terminal workflows, and agent automation.',
					'Use the API (GET /v1/catalog) for external integrations that run without a human session.',
					'Use the web app for charts, dashboards, and interactive exploration.'
				]
			}
		],
		related: [
			{
				href: '/docs/cli/agent-integration',
				label: 'Agent integration',
				description: 'How purvey context and CLI modules support AI tools.'
			},
			{
				href: '/docs/api/catalog',
				label: 'Catalog API docs',
				description: 'The HTTP endpoint that complements the CLI.'
			},
			{
				href: '/docs/cli/catalog',
				label: 'Catalog commands',
				description: 'Start searching the catalog from your terminal.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'catalog',
		title: 'CLI catalog commands',
		summary:
			'Search and browse the public green coffee catalog from your terminal. No login required.',
		eyebrow: 'Public data',
		intro: [
			'Catalog commands are the fastest way to explore the green coffee feed from the terminal. No authentication is needed.',
			'The search command supports filters for origin, processing method, price range, flavor notes, stocked-only, and result limits.'
		],
		sections: [
			{
				title: 'Commands',
				bullets: [
					'purvey catalog search: search by origin, processing method, price, flavor, variety, drying method, and more.',
					'purvey catalog get <id>: fetch a single coffee by ID.',
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
					'purvey roast list: list profiles, optionally filtered by --coffee-id, --coffee-name, --catalog-id, --date-start, or --date-end.',
					'purvey roast get <id>: fetch a single roast profile (--include-temps, --include-events for full telemetry).',
					'purvey roast create: create a roast record manually.',
					'purvey roast import: import an Artisan .alog file.',
					'purvey roast update <id>: update notes, batch name, oz-out, or targets on an existing profile.',
					'purvey roast delete <id>: delete a roast profile.',
					'purvey roast watch: watch a directory for new .alog files and auto-import them.'
				],
				codeBlocks: [
					{
						label: 'Create, import, list, and update',
						language: 'bash',
						code: 'purvey roast create --coffee-id 7 --batch-name "Ethiopia Guji Light" --oz-in 16 --pretty\npurvey roast import ~/artisan/ethiopia-guji.alog --coffee-id 7 --pretty\npurvey roast list --coffee-name "Guji" --pretty\npurvey roast list --catalog-id 128 --pretty\npurvey roast list --date-start 2026-01-01 --date-end 2026-03-31\npurvey roast update 123 --targets "Aim for FC at 390F, 18% dev"\npurvey roast update 123 --oz-out 13.2'
					}
				]
			},
			{
				title: 'Behavior notes',
				bullets: [
					'--coffee-id always refers to green_coffee_inv.id (use purvey inventory list to find IDs).',
					'--coffee-name filters by coffee name with a partial match (case-insensitive).',
					'Import extracts roast curves, events, and milestone timing from .alog files.',
					'Interactive --form mode provides a guided workflow for create and import.'
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
						code: 'purvey sales record --roast-id 123 --oz 12 --price 22.00 --buyer "Jane Smith" --pretty\npurvey sales list --pretty\npurvey sales list --roast-id 123 --pretty\npurvey sales list --buyer "Jane" --date-start 2026-01-01\npurvey sales list --csv > sales.csv'
					}
				],
				bullets: [
					'Required flags for record: --roast-id, --oz, --price.',
					'Use purvey roast list to find roast IDs.',
					'--price is the total sale price, not per-ounce.'
				]
			},
			{
				title: 'List sales',
				bullets: [
					'--roast-id <id>: filter by roast profile ID.',
					'--date-start / --date-end <YYYY-MM-DD>: filter by date range.',
					'--buyer <name>: filter by buyer name (partial match).',
					'--limit <n>: maximum results returned (default: 20).'
				]
			},
			{
				title: 'Update and delete',
				bullets: [
					'purvey sales update <id>: update oz, price, buyer, or sell-date on an existing sale.',
					'purvey sales delete <id>: delete a sale record.',
					'Both commands expect a sale ID from purvey sales list.'
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
						label: 'Retrieve tasting notes',
						language: 'bash',
						code: 'purvey tasting get 128 --filter both --pretty\npurvey tasting get 128 --filter supplier --pretty'
					}
				],
				bullets: [
					'The <bean-id> for tasting get is a coffee_catalog ID, not an inventory ID.',
					'--filter both returns both supplier and personal notes when available.',
					'purvey tasting rate updates your cupping scores on the corresponding inventory row.'
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
		slug: 'agent-integration',
		title: 'Agent integration',
		summary:
			'Use the Parchment CLI as a stable interface for AI agents, coding assistants, and external automation.',
		eyebrow: 'Agent workflows',
		intro: [
			'The Parchment CLI is designed to work with AI tools. The purvey context command outputs a machine-readable reference that agents can use to understand available commands, expected inputs, and response formats.',
			'The web app imports CLI modules directly for chat tool execution, so improvements to the CLI automatically improve the AI chat experience.'
		],
		sections: [
			{
				title: 'Agent onboarding',
				bullets: [
					'Run purvey context to generate a compact CLI reference for any AI agent or coding assistant.',
					'CLI commands provide stable, documented interfaces. Prefer them over reverse-engineering browser routes.',
					'Cross-reference with the web app when charts, visual exploration, or guided workflows are needed.'
				],
				codeBlocks: [
					{
						label: 'Generate agent reference',
						language: 'bash',
						code: 'purvey context > purvey-cli-reference.txt'
					}
				]
			},
			{
				title: 'How the web app uses the CLI',
				bullets: [
					'The app imports CLI modules for catalog, inventory, roast, sales, and tasting operations in chat tool execution.',
					'Read tools execute CLI functions directly. Write tools use proposal cards with user confirmation.',
					'This shared architecture keeps terminal, browser, and agent workflows aligned on the same domain logic.'
				]
			}
		],
		related: [
			{
				href: '/docs/api/overview',
				label: 'API overview',
				description: 'How the CLI complements the HTTP API.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'Command structure and authentication.'
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
