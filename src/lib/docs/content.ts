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
			'Public catalog API, internal session-auth endpoints, analytics surfaces, and integration behavior.',
		basePath: '/docs/api',
		items: [
			{
				slug: 'overview',
				title: 'Overview',
				summary: 'How the public API, internal app API, Parchment Console, and docs fit together.'
			},
			{
				slug: 'catalog',
				title: 'Catalog',
				summary:
					'External catalog feed, internal catalog endpoint, fields, auth, and response shape.'
			},
			{
				slug: 'analytics',
				title: 'Analytics',
				summary: 'Public market intelligence, PPI member unlocks, and supporting analytics routes.'
			},
			{
				slug: 'roast-profiles',
				title: 'Roast profiles',
				summary: 'Roast CRUD, Artisan imports, chart data, and AI roast helpers.'
			},
			{
				slug: 'inventory',
				title: 'Inventory',
				summary: 'Green coffee inventory CRUD, sharing flows, and stocked-state updates.'
			},
			{
				slug: 'errors',
				title: 'Errors and auth',
				summary: 'Common status codes, tier limits, and how failures differ by surface.'
			}
		]
	},
	{
		key: 'cli',
		title: 'CLI docs',
		description:
			'Terminal workflows powered by @purveyors/cli and the same primitives the web app imports.',
		basePath: '/docs/cli',
		items: [
			{
				slug: 'overview',
				title: 'Overview',
				summary: 'Install, authenticate, and understand how the CLI relates to the web app.'
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
				summary: 'Use the CLI as a stable contract for chat tools and external agents.'
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
			'Parchment Platform ships two API surfaces: a public API-key catalog feed and an internal session-auth app API.',
		eyebrow: 'Parchment Platform',
		intro: [
			'Parchment Platform has an external API for catalog consumers and a larger internal API that powers the web app. They share product concepts, but they do not share the same auth model or stability guarantees.',
			'The external contract today is the catalog feed at /api/catalog-api. The internal routes under /api/* support inventory, roasting, profit, chat, workspaces, Stripe, and console flows for the first-party app.'
		],
		sections: [
			{
				title: 'Surface map',
				table: {
					headers: ['Surface', 'Auth', 'Primary use', 'Stable public contract'],
					rows: [
						['/api/catalog-api', 'Bearer API key', 'External catalog access', 'Yes'],
						['/api-dashboard', 'Web session', 'Parchment Console keys and usage', 'Console UI'],
						[
							'/api/catalog',
							'Web session or public page usage',
							'First-party catalog queries and pagination',
							'Internal'
						],
						[
							'/api/beans, /api/roast-profiles, /api/profit',
							'Web session',
							'Inventory, roasting, and sales workflows',
							'Internal'
						],
						[
							'/api/chat, /api/workspaces, /api/tools/*',
							'Member session',
							'AI chat, tool calls, workspace memory',
							'Internal'
						]
					]
				}
			},
			{
				title: 'Auth model',
				bullets: [
					'External consumers send Authorization: Bearer <api_key> to /api/catalog-api.',
					'Viewer users get the free Explorer tier automatically. Higher tiers come from user roles such as api-member and api-enterprise.',
					'Internal app routes use Supabase session cookies and ownership checks. Member-only routes call requireMemberRole().',
					'Parchment Console pages are authenticated web pages, not separate API-key endpoints.'
				],
				codeBlocks: [
					{
						label: 'External request',
						language: 'bash',
						code: 'curl https://purveyors.io/api/catalog-api \\\n  -H "Authorization: Bearer pk_live_your_key_here"'
					}
				]
			},
			{
				title: 'Docs entry points',
				bullets: [
					'/api is the marketing and getting-started page for Parchment API.',
					'/docs is the unified public docs home for Parchment API and Parchment CLI documentation.',
					'/api-dashboard is Parchment Console for keys, usage analytics, and account context.'
				]
			},
			{
				title: 'Current reality',
				callout: {
					tone: 'note',
					title: 'Catalog API is the public contract today',
					body: 'Market analytics, roast CRUD, inventory CRUD, chat tools, and workspace routes are important platform capabilities. The long-term contract is moving toward /v1, but the stable external feed today is still /api/catalog-api. Document that split clearly instead of over-promising public API surface area.'
				}
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
				description:
					'Generate keys, inspect usage, and manage subscription-linked access in Parchment Console.'
			},
			{
				href: '/docs/cli/agent-integration',
				label: 'CLI and agent integration',
				description: 'See how the web app and chat tools reuse @purveyors/cli modules.'
			}
		]
	},
	{
		section: 'api',
		slug: 'catalog',
		title: 'Catalog API',
		summary:
			'The public catalog feed is the stable external endpoint. Internal catalog routes power richer first-party experiences.',
		eyebrow: 'External contract',
		intro: [
			'The public endpoint is GET /api/catalog-api. It returns publicly visible catalog rows, applies tier-based row limits, and includes rate-limit headers.',
			'The app also uses GET /api/catalog for paginated internal queries, dropdown payloads, and legacy id-based fetches. That route is session-oriented and can change with app needs.'
		],
		sections: [
			{
				title: 'External endpoint',
				body: [
					'Today the external API is a full-feed catalog read, not a server-side search API. Consumers should fetch rows, cache locally, and filter client-side if they need origin or price subsets.',
					'Responses include data, total, total_available, limited, limit, tier, cached, and api_version. Cached responses are served from a 1 hour in-memory cache.'
				],
				codeBlocks: [
					{
						label: 'GET /api/catalog-api',
						language: 'json',
						code: '{\n  "data": [\n    {\n      "id": 128,\n      "name": "Ethiopia Guji",\n      "region": "Guji",\n      "processing": "Natural",\n      "cost_lb": 7.5,\n      "stocked": true,\n      "source": "sweet_marias",\n      "country": "Ethiopia",\n      "continent": "Africa"\n    }\n  ],\n  "total": 25,\n  "total_available": 814,\n  "limited": true,\n  "limit": 25,\n  "tier": "viewer",\n  "cached": true,\n  "api_version": "1.0"\n}'
					}
				]
			},
			{
				title: 'Tier behavior',
				table: {
					headers: ['Tier', 'Monthly requests', 'Rows per call', 'Notes'],
					rows: [
						[
							'viewer',
							'200',
							'25',
							'Explorer tier, good for evaluation and lightweight integrations'
						],
						[
							'api-member',
							'10,000',
							'Unlimited',
							'Roaster+ tier, intended for production integrations'
						],
						[
							'api-enterprise',
							'Unlimited',
							'Unlimited',
							'Enterprise tier, no row cap or monthly cap'
						]
					]
				}
			},
			{
				title: 'Headers and caching',
				bullets: [
					'X-RateLimit-Limit, X-RateLimit-Remaining, and X-RateLimit-Reset are set on successful responses.',
					'429 responses also include Retry-After.',
					'The catalog feed uses a 1 hour in-memory cache before returning to the database.'
				]
			},
			{
				title: 'Internal catalog route',
				bullets: [
					'GET /api/catalog supports pagination, filters, dropdown payloads, and legacy ids query support.',
					'When page or limit is supplied, it returns { data, pagination } with totalPages and next/prev state.',
					'When fields=dropdown is supplied, it returns a lightweight picker payload.',
					'The first-party catalog UI uses this route to power filters, public previews, and authenticated browsing.'
				],
				callout: {
					tone: 'warning',
					title: 'Do not confuse the two catalog routes',
					body: '/api/catalog-api is the external API-key surface. /api/catalog is an internal route tuned for the web app and may expose different filtering behavior and pagination semantics.'
				}
			}
		],
		related: [
			{
				href: '/api',
				label: 'API product page',
				description: 'See the public positioning and getting-started path.'
			},
			{
				href: '/catalog',
				label: 'Public catalog',
				description: 'See how the first-party web app presents the same catalog data.'
			},
			{
				href: '/docs/cli/catalog',
				label: 'CLI catalog docs',
				description: 'Search the same catalog from the terminal with purvey catalog search.'
			}
		]
	},
	{
		section: 'api',
		slug: 'analytics',
		title: 'Analytics surfaces',
		summary:
			'Analytics are a major product value prop. Today they ship primarily as web experiences backed by internal queries and helper endpoints.',
		eyebrow: 'Market intelligence',
		intro: [
			'The public /analytics page exposes daily market intelligence without login and expands for authenticated users plus premium analytics access. It is a product surface first, not yet a public API-key analytics product.',
			'The analytics stack pulls from pre-computed tables such as market_daily_summary, price_index_snapshots, and supplier_daily_stats, plus live catalog data for distribution and range views.'
		],
		sections: [
			{
				title: 'What the analytics page exposes',
				bullets: [
					'Public visitors see supplier count, stocked bean counts, origin coverage, price trends by origin, processing-method distribution, and origin price ranges.',
					'Authenticated users also see supplier price comparison, supplier catalog health, and arrivals and delistings windows.',
					'Premium analytics access unlocks spread mode, origin-level price index tables, and roadmap panels for longer-term trend detail.'
				]
			},
			{
				title: 'Important implementation details',
				bullets: [
					'Analytics freshness is based on the latest market_daily_summary snapshot_date.',
					'Origin line charts are powered by price_index_snapshots filtered to aggregation_tier = 1.',
					'Origin range charts are computed live from stocked catalog rows with price_per_lb data.',
					'Arrivals and delistings are derived from stocked_date and unstocked_date windows.'
				]
			},
			{
				title: 'Roast analytics helper endpoints',
				bullets: [
					'GET /api/roast-chart-data returns sampled roast telemetry and metadata for a roastId.',
					'GET and POST /api/roast-chart-settings store per-user chart preferences.',
					'POST /api/ai/classify-roast classifies roast curves with AI assistance.',
					'DELETE /api/clear-roast clears roast-related data for a roast flow.'
				],
				codeBlocks: [
					{
						label: 'Roast chart request',
						language: 'bash',
						code: 'curl "https://purveyors.io/api/roast-chart-data?roastId=123" \\\n  -H "Cookie: <session-cookie>"'
					}
				]
			},
			{
				title: 'Positioning guidance',
				callout: {
					tone: 'note',
					title: 'Document analytics honestly',
					body: 'The analytics experience is already a strong differentiator. Treat it as a major value prop in README and marketing copy, but do not claim there is a separate public analytics REST API until one actually exists.'
				}
			}
		],
		related: [
			{
				href: '/analytics',
				label: 'Market analytics page',
				description: 'See the public and gated analytics product live.'
			},
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast APIs',
				description: 'Read about roast CRUD, imports, and chart-related endpoints.'
			},
			{
				href: '/docs/api/errors',
				label: 'Errors and auth',
				description: 'Understand how analytics helper routes fail for unauthenticated users.'
			}
		]
	},
	{
		section: 'api',
		slug: 'roast-profiles',
		title: 'Roast profile routes',
		summary: 'Roast APIs are session-auth routes for the first-party app and CLI-backed workflows.',
		eyebrow: 'Roasting',
		intro: [
			'Roasting spans CRUD for roast profiles, Artisan imports, chart data, classification helpers, and batch delete flows. These endpoints are internal app APIs, but they are central to the product.',
			'The web app and CLI both revolve around green_coffee_inv IDs for the coffee input and roast_id values for stored roast profiles.'
		],
		sections: [
			{
				title: 'Primary roast endpoints',
				table: {
					headers: ['Route', 'Methods', 'Purpose'],
					rows: [
						[
							'/api/roast-profiles',
							'GET POST PUT DELETE',
							'List, create, update, or delete roast profiles'
						],
						['/api/artisan-import', 'POST', 'Import an Artisan .alog file into a roast profile'],
						['/api/roast-chart-data', 'GET', 'Return sampled roast telemetry and metadata'],
						['/api/roast-chart-settings', 'GET POST', 'Persist roast chart display preferences'],
						['/api/clear-roast', 'DELETE', 'Clear roast data in specific flows'],
						['/api/ai/classify-roast', 'POST', 'Run roast classification assistance']
					]
				}
			},
			{
				title: 'Behavior to know',
				bullets: [
					'All roast endpoints require an authenticated user. Most routes return 401 when no session is present.',
					'POST /api/roast-profiles can create single roasts or batch flows, then updates stocked status for affected coffees.',
					'DELETE /api/roast-profiles supports deleting a single roast by id or a batch by name.',
					'Chart data is intentionally sampled to stay performant and below row-count ceilings.'
				]
			},
			{
				title: 'CLI parity',
				body: [
					'The CLI exposes purvey roast list, purvey roast create, purvey roast import, and purvey roast watch. Those flows are the clearest public description of how roast data should be handled outside the browser.',
					'The chat tool layer also imports @purveyors/cli/roast directly, so roast improvements in the CLI compound into the AI workspace.'
				],
				codeBlocks: [
					{
						label: 'Artisan import',
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
				description: 'See how roast data is surfaced in the first-party app.'
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
			'Inventory routes manage green_coffee_inv rows, shared views, and stocked-state lifecycle changes.',
		eyebrow: 'Inventory',
		intro: [
			'Inventory is where catalog data becomes user-owned operational data. The core route is /api/beans, which supports list, create, update, and delete operations for green_coffee_inv rows.',
			'The route also supports share-token reads, allowing a limited shared view without exposing the entire app session.'
		],
		sections: [
			{
				title: 'Primary routes',
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
						[
							'/api/workspaces and /api/workspaces/[id]',
							'GET POST PUT DELETE',
							'Chat workspace metadata and memory, relevant for agent-assisted inventory work'
						]
					]
				}
			},
			{
				title: 'Create and update behavior',
				bullets: [
					'POST /api/beans can create manual private catalog entries when no catalog_id is provided and manual_name is present.',
					'PUT /api/beans filters incoming fields to known green_coffee_inv columns before updating.',
					'DELETE /api/beans enforces ownership before removing inventory and related data.',
					'Share-token GET requests return shared data without granting broad account access.'
				]
			},
			{
				title: 'CLI parity',
				codeBlocks: [
					{
						label: 'List stocked inventory',
						language: 'bash',
						code: 'purvey inventory list --stocked --pretty'
					},
					{
						label: 'Add inventory from the CLI',
						language: 'bash',
						code: 'purvey inventory add --help'
					}
				],
				callout: {
					tone: 'note',
					title: 'Inventory IDs matter',
					body: 'Inventory IDs are not catalog IDs. Roast commands and several internal routes expect green_coffee_inv.id values.'
				}
			}
		],
		related: [
			{
				href: '/beans',
				label: 'Inventory page',
				description: 'See the inventory product surface in the app.'
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
			'Status codes vary by surface. External API, Parchment Console pages, and internal routes fail differently by design.',
		eyebrow: 'Operational reference',
		intro: [
			'Purveyors uses a mix of API-key auth, session auth, role checks, and ownership checks. Good docs need to say which one applies to each route family.',
			'In practice, most confusion comes from mixing /api/catalog-api with session-auth app endpoints, or from confusing viewer access with member access.'
		],
		sections: [
			{
				title: 'Common statuses',
				table: {
					headers: ['Status', 'Where it appears', 'Meaning'],
					rows: [
						['200', 'All surfaces', 'Request succeeded'],
						['201', '/api/workspaces POST', 'A new workspace was created'],
						['303', '/api/docs redirects', 'Route is redirecting to the correct docs entry point'],
						['401', 'Session or API key routes', 'Missing session or invalid/missing API key'],
						[
							'403',
							'Owned data or tier-gated routes',
							'You are authenticated, but lack the right role or ownership'
						],
						[
							'404',
							'Workspace or resource lookup',
							'Requested resource does not exist or is not visible to you'
						],
						['429', '/api/catalog-api', 'Monthly rate limit exhausted for the current tier'],
						['500', 'Any route', 'Unexpected server-side failure']
					]
				}
			},
			{
				title: 'External API error shape',
				codeBlocks: [
					{
						label: '401',
						language: 'json',
						code: '{\n  "error": "Authentication required",\n  "message": "Valid API key required for access"\n}'
					},
					{
						label: '429',
						language: 'json',
						code: '{\n  "error": "Rate limit exceeded",\n  "message": "API rate limit exceeded for your subscription plan",\n  "limit": 200,\n  "remaining": 0,\n  "resetTime": "2026-04-01T00:00:00.000Z"\n}'
					}
				]
			},
			{
				title: 'Practical guidance',
				bullets: [
					'If you need public data without a login, start with /api/catalog-api or the CLI catalog commands.',
					'If you see 403 on inventory, roast, or sales flows, check account role and resource ownership, not just authentication.',
					'If you see 429 on the external API, inspect X-RateLimit-* headers and wait for the monthly reset or upgrade the plan.',
					'Parchment Console is the best place to debug keys, usage, and plan limits because it exposes account-aware context.'
				]
			}
		],
		related: [
			{
				href: '/api-dashboard/usage',
				label: 'Usage analytics',
				description: 'See actual key activity, plan usage, and upgrade prompts.'
			},
			{
				href: '/docs/api/overview',
				label: 'API overview',
				description: 'Revisit the auth split between public and internal surfaces.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'CLI commands often provide the simplest way to validate auth and access.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'overview',
		title: 'CLI overview',
		summary:
			'Parchment CLI is the terminal entry point for catalog queries, personal workflows, and agent-safe automation.',
		eyebrow: '@purveyors/cli',
		intro: [
			'The CLI is not an afterthought. The web app imports @purveyors/cli modules directly inside chat tools, which means CLI improvements also improve the AI workspace.',
			'The installed binary is purvey. It supports public catalog reads without login and member-only commands for inventory, roast, sales, and tasting flows.'
		],
		sections: [
			{
				title: 'Top-level commands',
				bullets: [
					'purvey auth manages login state.',
					'purvey catalog browses the public coffee catalog.',
					'purvey inventory, roast, sales, and tasting operate on member data.',
					'purvey context prints an AI-onboarding reference for agents.'
				],
				codeBlocks: [
					{
						label: 'Authenticate headlessly',
						language: 'bash',
						code: 'purvey auth login --headless'
					},
					{
						label: 'Get the full agent reference',
						language: 'bash',
						code: 'purvey context'
					}
				]
			},
			{
				title: 'How it maps to the web app',
				bullets: [
					'The app imports @purveyors/cli/catalog, inventory, roast, tasting, and sales inside src/lib/services/tools.ts.',
					'The deprecated /api/tools/* endpoints remain for backwards compatibility, but the preferred path is direct CLI library usage.',
					'This shared contract is why docs should cross-link web, API, and CLI surfaces instead of describing them as separate products.'
				]
			},
			{
				title: 'When to prefer the CLI',
				bullets: [
					'Use the CLI for scripting, terminal workflows, and agent automation.',
					'Use the web app when you need charts, dashboards, canvas interactions, or richer visual exploration.',
					'Use /api/catalog-api when you need an external integration that should not depend on a human session.'
				]
			}
		],
		related: [
			{
				href: '/docs/cli/agent-integration',
				label: 'Agent integration',
				description: 'Learn how purvey context and CLI modules support agents.'
			},
			{
				href: '/docs/api/catalog',
				label: 'Catalog API docs',
				description: 'Understand the external HTTP surface that complements the CLI.'
			},
			{
				href: '/docs/cli/catalog',
				label: 'Catalog commands',
				description: 'Start with the public catalog commands and examples.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'catalog',
		title: 'CLI catalog commands',
		summary: 'Catalog commands are public and require no login.',
		eyebrow: 'Public data',
		intro: [
			'The catalog command family is the fastest way to explore the public coffee feed from the terminal. It mirrors the platform emphasis on catalog discovery and market visibility.',
			'The search command supports origin, process, price, flavor, stocked-only, and limit flags.'
		],
		sections: [
			{
				title: 'Available commands',
				bullets: [
					'purvey catalog search searches coffees by origin, process, price, or flavor.',
					'purvey catalog get <id> fetches a single coffee.',
					'purvey catalog stats aggregates the catalog.'
				],
				codeBlocks: [
					{
						label: 'Search examples',
						language: 'bash',
						code: 'purvey catalog search --origin "Ethiopia" --process "natural" --pretty\npurvey catalog search --process "natural" --flavor "blueberry,citrus" --stocked\npurvey catalog search --price-min 5 --price-max 12 --stocked --limit 20 --csv'
					}
				]
			},
			{
				title: 'Notable behavior',
				bullets: [
					'No authentication is required for catalog search.',
					'--origin accepts partial matches across country, continent, and region.',
					'Use --pretty for terminal reading and --csv for spreadsheet-friendly output.'
				]
			}
		],
		related: [
			{
				href: '/catalog',
				label: 'Web catalog',
				description: 'Browse the same market in the web app.'
			},
			{
				href: '/docs/api/catalog',
				label: 'HTTP catalog docs',
				description: 'Compare CLI access with the external API-key feed.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'See how the CLI fits into the wider platform.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'inventory',
		title: 'CLI inventory commands',
		summary: 'Inventory commands operate on green_coffee_inv data and require member auth.',
		eyebrow: 'Member workflows',
		intro: [
			'Inventory commands are the CLI companion to the /beans page and /api/beans route. They return inventory rows joined with catalog details so you can reason about sourcing and roasting from the terminal.',
			'The most important thing to remember is that inventory IDs are distinct from catalog IDs.'
		],
		sections: [
			{
				title: 'Available commands',
				bullets: [
					'purvey inventory list lists inventory with optional --stocked filtering.',
					'purvey inventory get <id> fetches a single inventory item you own.',
					'purvey inventory add, update, and delete mutate inventory rows you own.'
				],
				codeBlocks: [
					{
						label: 'List inventory',
						language: 'bash',
						code: 'purvey inventory list --stocked --pretty\npurvey inventory list --limit 50 --csv > inventory.csv'
					}
				]
			},
			{
				title: 'Practical note',
				callout: {
					tone: 'warning',
					title: 'Use inventory IDs for roast work',
					body: 'roast --coffee-id expects green_coffee_inv.id values. Do not pass coffee_catalog IDs into roast commands.'
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
				description: 'Understand the session-auth route family behind inventory behavior.'
			},
			{
				href: '/beans',
				label: 'Inventory page',
				description: 'See the same data in the browser.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'roast',
		title: 'CLI roast commands',
		summary: 'Roast commands support list, create, import, delete, and watch workflows.',
		eyebrow: 'Roasting from the terminal',
		intro: [
			'Roast commands are where terminal workflows become operational. They are especially useful when importing Artisan data or automating roast capture from a watched folder.',
			'The CLI strongly encourages purvey roast import when an .alog file exists.'
		],
		sections: [
			{
				title: 'Core commands',
				bullets: [
					'purvey roast list lists profiles, optionally filtered by --coffee-id.',
					'purvey roast create creates a roast record manually.',
					'purvey roast import imports an Artisan .alog file.',
					'purvey roast watch watches a directory for new .alog files and can auto-import them.'
				],
				codeBlocks: [
					{
						label: 'Create and import',
						language: 'bash',
						code: 'purvey roast create --coffee-id 7 --batch-name "Ethiopia Guji Light" --oz-in 16 --pretty\npurvey roast import ~/artisan/ethiopia-guji.alog --coffee-id 7 --pretty'
					}
				]
			},
			{
				title: 'Behavior to know',
				bullets: [
					'--coffee-id always refers to green_coffee_inv.id.',
					'Import extracts roast curves, roast events, and milestone timing from .alog files.',
					'Interactive --form mode is available for create and import flows when you want a guided workflow.'
				]
			}
		],
		related: [
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast API docs',
				description: 'See the underlying route family and chart helpers.'
			},
			{
				href: '/roast',
				label: 'Roast page',
				description: 'View roast charts and profile editing in the web app.'
			},
			{
				href: '/docs/cli/sales',
				label: 'Sales commands',
				description: 'Sales records often follow roast creation and import workflows.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'sales',
		title: 'CLI sales commands',
		summary: 'Sales commands record roasted-coffee sales against roast profiles.',
		eyebrow: 'Sales',
		intro: [
			'Sales commands complement the /profit page and /api/profit route. They let you record roasted coffee sales from the terminal without opening the browser.',
			'The record flow uses roast IDs, not inventory IDs.'
		],
		sections: [
			{
				title: 'Record a sale',
				codeBlocks: [
					{
						label: 'Record a sale',
						language: 'bash',
						code: 'purvey sales record --roast-id 123 --oz 12 --price 22.00 --buyer "Jane Smith" --pretty'
					}
				],
				bullets: [
					'Required flags are --roast-id, --oz, and --price.',
					'Use purvey roast list to find roast IDs.',
					'--price is the total sale price, not a per-ounce value.'
				]
			}
		],
		related: [
			{
				href: '/profit',
				label: 'Profit page',
				description: 'See how sales data rolls into profit analytics in the app.'
			},
			{
				href: '/docs/cli/roast',
				label: 'CLI roast docs',
				description: 'Sales depend on roast IDs generated by roast workflows.'
			},
			{
				href: '/docs/api/roast-profiles',
				label: 'Roast and profit API docs',
				description: 'Read about the related session-auth route families.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'tasting',
		title: 'CLI tasting commands',
		summary: 'Tasting commands combine supplier notes with your own cupping data.',
		eyebrow: 'Tasting',
		intro: [
			'Tasting is where the catalog and your inventory overlap most directly. Supplier notes come from the catalog, while personal ratings live on inventory rows.',
			'The CLI exposes both read and write flows so tasting data can live in terminal, browser, and chat contexts.'
		],
		sections: [
			{
				title: 'Read supplier and user notes',
				codeBlocks: [
					{
						label: 'Retrieve tasting notes',
						language: 'bash',
						code: 'purvey tasting get 128 --filter both --pretty\npurvey tasting get 128 --filter supplier --pretty'
					}
				],
				bullets: [
					'<bean-id> for tasting get is a coffee_catalog ID, not an inventory ID.',
					'--filter both returns supplier and user sections when available.',
					'purvey tasting rate updates your cupping scores on green_coffee_inv.'
				]
			}
		],
		related: [
			{
				href: '/docs/cli/inventory',
				label: 'CLI inventory docs',
				description: 'Your tasting ratings are stored on inventory rows you own.'
			},
			{
				href: '/docs/cli/catalog',
				label: 'CLI catalog docs',
				description: 'Supplier tasting context originates in the public catalog.'
			},
			{
				href: '/chat',
				label: 'AI chat',
				description: 'The chat workspace imports @purveyors/cli/tasting for tasting-note tools.'
			}
		]
	},
	{
		section: 'cli',
		slug: 'agent-integration',
		title: 'CLI and agent integration',
		summary:
			'The CLI is the shared contract for terminal users, chat tools, and external coding agents.',
		eyebrow: 'Agent workflows',
		intro: [
			'Purveyors is intentionally agent-friendly. The purvey context command outputs a full CLI reference designed for onboarding AI tools, and the app imports CLI modules directly for several chat actions.',
			'That architecture matters because it reduces duplicated business logic and keeps terminal, browser, and agent workflows aligned.'
		],
		sections: [
			{
				title: 'How the app uses the CLI',
				bullets: [
					'src/lib/services/tools.ts imports @purveyors/cli/catalog, inventory, roast, sales, and tasting.',
					'Read tools execute CLI library functions directly. Deprecated /api/tools/* routes remain only for backwards compatibility.',
					'Write tools in chat use proposal cards first, then confirm through /api/chat/execute-action.'
				]
			},
			{
				title: 'Good agent defaults',
				bullets: [
					'Use purvey context when you need a compact authoritative contract for an agent or coding assistant.',
					'Prefer CLI commands for stable scripted interactions instead of reverse-engineering internal browser routes.',
					'Cross-link back to the web app when charts, canvas state, or guided workflows matter more than raw command output.'
				],
				codeBlocks: [
					{
						label: 'Agent handoff',
						language: 'bash',
						code: 'purvey context > purvey-cli-reference.txt'
					}
				]
			},
			{
				title: 'Notable suggestion from this docs audit',
				callout: {
					tone: 'success',
					title: 'Keep leaning into the shared contract',
					body: 'The strongest long-term docs strategy is to treat the CLI and the web app as two interfaces to the same domain model. When a workflow lands in one place first, document the relationship clearly and move shared behavior into reusable modules whenever possible.'
				}
			}
		],
		related: [
			{
				href: '/docs/api/overview',
				label: 'API overview',
				description: 'See where the CLI complements, and differs from, the external HTTP surface.'
			},
			{
				href: '/docs/cli/overview',
				label: 'CLI overview',
				description: 'Review the top-level command structure and auth model.'
			},
			{
				href: '/chat',
				label: 'AI chat workspace',
				description: 'See the UI that consumes CLI modules inside the app.'
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
