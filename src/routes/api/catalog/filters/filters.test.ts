import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCatalogFilterMetadata = vi.fn();

vi.mock('$lib/data/catalog', () => ({
	getCatalogFilterMetadata: mockGetCatalogFilterMetadata
}));

let GET: typeof import('./+server').GET;

const visibleRows = [
	{
		source: 'A',
		continent: 'Africa',
		country: 'Ethiopia',
		processing: 'Washed',
		cultivar_detail: 'Heirloom',
		type: 'Arabica',
		grade: 'Grade 1',
		appearance: '15/17',
		arrival_date: '2024-01-01'
	},
	{
		source: 'B',
		continent: 'South America',
		country: 'Brazil',
		processing: 'Natural',
		cultivar_detail: 'Bourbon',
		type: 'Arabica',
		grade: 'Grade 2',
		appearance: '16 Screen',
		arrival_date: '2024-02-01'
	}
];

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	mockGetCatalogFilterMetadata.mockResolvedValue(visibleRows);
	({ GET } = await import('./+server'));
});

function makeRequest(url: string, role: App.Locals['role'], session: App.Locals['session']) {
	return {
		url: new URL(url),
		locals: {
			supabase: { kind: 'session-client' },
			role,
			session
		}
	} as unknown as Parameters<NonNullable<typeof GET>>[0];
}

describe('/api/catalog/filters', () => {
	it('keeps anonymous requests constrained to canonical public visibility', async () => {
		const response = await GET(
			makeRequest('https://app.test/api/catalog/filters?showWholesale=true', 'viewer', null)
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockGetCatalogFilterMetadata).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false
			})
		);
		expect(body.sources).toEqual(['A', 'B']);
	});

	it('keeps viewer sessions on the same public-only filter metadata policy', async () => {
		const viewerSession = { access_token: 'cookie-token' } as App.Locals['session'];

		await GET(
			makeRequest(
				'https://app.test/api/catalog/filters?wholesaleOnly=true',
				'viewer',
				viewerSession
			)
		);

		expect(mockGetCatalogFilterMetadata).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: true,
				showWholesale: false,
				wholesaleOnly: false
			})
		);
	});

	it('lets member sessions request internal filter metadata when wholesale flags are explicitly requested', async () => {
		const memberSession = { access_token: 'cookie-token' } as App.Locals['session'];

		await GET(
			makeRequest(
				'https://app.test/api/catalog/filters?showWholesale=true&wholesaleOnly=true',
				'member',
				memberSession
			)
		);

		expect(mockGetCatalogFilterMetadata).toHaveBeenCalledWith(
			{ kind: 'session-client' },
			expect.objectContaining({
				stockedOnly: true,
				publicOnly: false,
				showWholesale: true,
				wholesaleOnly: true
			})
		);
	});
});
