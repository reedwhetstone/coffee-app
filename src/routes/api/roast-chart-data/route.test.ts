import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { anonymousPrincipal, cookieSessionPrincipal } from '$lib/server/principal.test-utils';

const parchmentMocks = vi.hoisted(() => ({
	createParchmentServerClient: vi.fn()
}));

vi.mock('$lib/server/parchmentClient', () => ({
	createParchmentServerClient: parchmentMocks.createParchmentServerClient
}));

import { GET } from './+server';

function makeEvent(
	options: {
		authenticated?: boolean;
		authoritativeAuthenticated?: boolean;
		roastId?: string;
		authorization?: string;
	} = {}
) {
	const authenticated = options.authenticated ?? true;
	const authoritativeAuthenticated = options.authoritativeAuthenticated ?? authenticated;
	const roastId = options.roastId ?? '42';
	const requestInit = options.authorization
		? { headers: { Authorization: options.authorization } }
		: undefined;

	return {
		url: new URL(`https://app.test/api/roast-chart-data?roastId=${roastId}`),
		request: new Request(`https://app.test/api/roast-chart-data?roastId=${roastId}`, requestInit),
		fetch: vi.fn(),
		locals: {
			principal: authoritativeAuthenticated
				? cookieSessionPrincipal('viewer', {
						user: { id: 'authoritative-user-1' } as never,
						session: { access_token: 'authoritative-session-token' } as never
					})
				: anonymousPrincipal()
		}
	};
}

describe('/api/roast-chart-data GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('forwards the generated owner-scoped Parchment chart contract', async () => {
		const canonicalData = {
			points: [
				{
					data_type: 'temperature',
					time_milliseconds: 1000,
					field_name: 'bean_temp',
					value_numeric: 212,
					event_string: '',
					category: 'temperature',
					subcategory: 'bean'
				}
			],
			series: [
				{
					id: 'bean-temperature',
					name: 'BT',
					kind: 'bean_temperature',
					unit: 'F',
					device_index: null,
					channel: null,
					total_points: 800,
					sampled_points: 400,
					points: [{ time_milliseconds: 1000, value_numeric: 212 }]
				}
			],
			events: [
				{
					time_milliseconds: 1000,
					name: 'charge',
					value: null,
					category: 'milestone',
					subcategory: 'roast_phase'
				}
			],
			metadata: {
				total_data_points: 800,
				sampled_data_points: 400,
				roast_duration_minutes: 12.5,
				time_min_ms: 0,
				time_max_ms: 750000,
				temp_min: 72,
				temp_max: 412,
				ror_min: -3,
				ror_max: 35,
				charge_time_ms: 15000,
				temperature_unit: 'F',
				profile_schema_version: 1,
				target_points: 400,
				sample_gap_max_ms: 2000
			}
		};
		const chartData = vi.fn().mockResolvedValue({
			data: {
				data: canonicalData
			}
		});
		const event = makeEvent();
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ roasts: { chartData } });

		const response = await GET(event as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual(canonicalData);
		expect(parchmentMocks.createParchmentServerClient).toHaveBeenCalledWith(event, {
			mode: 'session'
		});
		expect(chartData).toHaveBeenCalledWith('42', { target_points: 400 });
	});

	it('preserves nullable metadata without inventing client-side defaults', async () => {
		const chartData = vi.fn().mockResolvedValue({
			data: {
				data: {
					points: [],
					series: [],
					events: [],
					metadata: {
						total_data_points: 0,
						sampled_data_points: 0,
						roast_duration_minutes: null,
						time_min_ms: null,
						time_max_ms: null,
						temp_min: null,
						temp_max: null,
						ror_min: null,
						ror_max: null,
						charge_time_ms: null,
						temperature_unit: null,
						profile_schema_version: null,
						target_points: 400,
						sample_gap_max_ms: null
					}
				}
			}
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ roasts: { chartData } });

		const response = await GET(makeEvent() as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.metadata).toMatchObject({
			roast_duration_minutes: null,
			time_min_ms: null,
			temperature_unit: null,
			profile_schema_version: null
		});
	});

	it('preserves the legacy 500 envelope when Parchment fails', async () => {
		const chartData = vi.fn().mockResolvedValue({
			error: { error: { code: 'not_found', message: 'Roast not found' } }
		});
		parchmentMocks.createParchmentServerClient.mockResolvedValue({ roasts: { chartData } });

		const response = await GET(makeEvent() as never);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({ error: 'Failed to process chart data' });
	});

	it('rejects unauthenticated callers before constructing a Parchment client', async () => {
		const response = await GET(makeEvent({ authenticated: false }) as never);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Authentication required' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('does not let a cookie session bypass an Authorization header rejected by the auth hook', async () => {
		const response = await GET(
			makeEvent({
				authenticated: true,
				authoritativeAuthenticated: false,
				authorization: 'Bearer invalid-header-credential'
			}) as never
		);

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: 'Authentication required' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});

	it('preserves legacy roast id parsing and rejects values without a numeric prefix', async () => {
		const response = await GET(makeEvent({ roastId: 'not-a-number' }) as never);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: 'Valid roastId parameter required' });
		expect(parchmentMocks.createParchmentServerClient).not.toHaveBeenCalled();
	});
});

describe('/api/roast-chart-data Parchment read boundary', () => {
	it('keeps direct roast chart RPC access out of the web BFF', () => {
		const routeSource = readFileSync(resolve('src/routes/api/roast-chart-data/+server.ts'), 'utf8');

		expect(routeSource).toContain('client.roasts.chartData');
		expect(routeSource).not.toContain('supabase');
		expect(routeSource).not.toContain('get_chart_data_sampled');
		expect(routeSource).not.toContain('get_chart_metadata');
	});
});
