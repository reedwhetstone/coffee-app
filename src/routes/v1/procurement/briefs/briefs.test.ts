import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockBuildSourcingBriefCreateResponse = vi.fn();
const mockBuildSourcingBriefsListResponse = vi.fn();
const mockBuildSourcingBriefGetResponse = vi.fn();
const mockBuildSourcingBriefMatchesResponse = vi.fn();

vi.mock('$lib/server/procurement/sourcingBriefs', () => ({
	buildSourcingBriefCreateResponse: mockBuildSourcingBriefCreateResponse,
	buildSourcingBriefsListResponse: mockBuildSourcingBriefsListResponse,
	buildSourcingBriefGetResponse: mockBuildSourcingBriefGetResponse,
	buildSourcingBriefMatchesResponse: mockBuildSourcingBriefMatchesResponse
}));

let collection: typeof import('./+server');
let detail: typeof import('./[id]/+server');
let matches: typeof import('./[id]/matches/+server');

function makeEvent(url: string, id = 'brief-id') {
	return {
		url: new URL(url),
		request: new Request(url),
		params: { id },
		locals: {}
	} as never;
}

beforeEach(async () => {
	vi.resetModules();
	vi.clearAllMocks();
	collection = await import('./+server');
	detail = await import('./[id]/+server');
	matches = await import('./[id]/matches/+server');
});

describe('/v1/procurement/briefs routes', () => {
	it('delegates collection GET and POST to the shared builder', async () => {
		const listResponse = new Response(JSON.stringify({ list: true }));
		const createResponse = new Response(JSON.stringify({ create: true }), { status: 201 });
		mockBuildSourcingBriefsListResponse.mockResolvedValue(listResponse);
		mockBuildSourcingBriefCreateResponse.mockResolvedValue(createResponse);

		await expect(collection.GET(makeEvent('https://app.test/v1/procurement/briefs'))).resolves.toBe(
			listResponse
		);
		await expect(
			collection.POST(makeEvent('https://app.test/v1/procurement/briefs'))
		).resolves.toBe(createResponse);

		expect(mockBuildSourcingBriefsListResponse).toHaveBeenCalledWith(expect.anything(), {
			requestPath: '/v1/procurement/briefs'
		});
		expect(mockBuildSourcingBriefCreateResponse).toHaveBeenCalledWith(expect.anything(), {
			requestPath: '/v1/procurement/briefs'
		});
	});

	it('delegates detail and matches GET routes with stable request paths', async () => {
		const detailResponse = new Response(JSON.stringify({ detail: true }));
		const matchesResponse = new Response(JSON.stringify({ matches: true }));
		mockBuildSourcingBriefGetResponse.mockResolvedValue(detailResponse);
		mockBuildSourcingBriefMatchesResponse.mockResolvedValue(matchesResponse);

		await expect(
			detail.GET(makeEvent('https://app.test/v1/procurement/briefs/brief-id'))
		).resolves.toBe(detailResponse);
		await expect(
			matches.GET(makeEvent('https://app.test/v1/procurement/briefs/brief-id/matches'))
		).resolves.toBe(matchesResponse);

		expect(mockBuildSourcingBriefGetResponse).toHaveBeenCalledWith(expect.anything(), 'brief-id', {
			requestPath: '/v1/procurement/briefs/:id'
		});
		expect(mockBuildSourcingBriefMatchesResponse).toHaveBeenCalledWith(
			expect.anything(),
			'brief-id',
			{
				requestPath: '/v1/procurement/briefs/:id/matches'
			}
		);
	});
});
