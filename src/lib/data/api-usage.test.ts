import { describe, expect, it } from 'vitest';
import type { OwnerApiUsage } from '@purveyors/sdk';
import { mapOwnerApiUsage } from './api-usage';

function usageFixture(overrides: Record<string, unknown> = {}): OwnerApiUsage {
	return {
		kind: 'owner_api_key_traffic',
		generatedAt: '2026-07-26T12:00:00Z',
		window: {
			from: '2026-06-27T00:00:00Z',
			to: '2026-07-26T12:00:00Z',
			days: 30,
			recordsReturned: 3,
			recordLimit: 20000,
			truncated: false,
			seriesCoverage: 'complete'
		},
		plan: {
			id: 'member',
			monthlyRequestLimit: 10000,
			monthlyRequestLimitPerKey: 10000,
			limitScope: 'account',
			collectionItemLimit: 100,
			unlimited: false
		},
		summary: {
			monthlyRequests: 15000,
			monthlyRequestsRemaining: 0,
			monthlyResetAt: '2026-08-01T00:00:00.000Z',
			hourlyRequests: 12,
			totalKeys: 2,
			activeKeys: 1
		},
		daily: [
			{
				date: '2026-07-26',
				totalRequests: 3,
				successRequests: 2,
				errorRequests: 1,
				pendingRequests: 0,
				averageResponseTimeMs: 41
			}
		],
		keys: [
			{
				id: 'key-1',
				name: 'Production',
				createdAt: '2026-01-01T00:00:00Z',
				lastUsedAt: '2026-07-26T11:00:00Z',
				isActive: true,
				scopes: ['catalog:read'],
				monthlyRequests: 9000,
				windowRequests: 2,
				successRequests: 1,
				errorRequests: 1,
				pendingRequests: 0,
				averageResponseTimeMs: 42,
				windowTruncated: false,
				recent: [
					{
						endpoint: '/v1/catalog',
						timestamp: '2026-07-26T11:00:00Z',
						statusCode: 200,
						responseTimeMs: 42
					},
					{
						endpoint: '/v1/catalog',
						timestamp: '2026-07-26T11:01:00Z',
						statusCode: null,
						responseTimeMs: null
					}
				]
			},
			{
				id: 'key-2',
				name: 'Automation',
				createdAt: '2026-02-01T00:00:00Z',
				lastUsedAt: null,
				isActive: false,
				scopes: ['catalog:read'],
				monthlyRequests: 6000,
				windowRequests: 1,
				successRequests: 1,
				errorRequests: 0,
				pendingRequests: 0,
				averageResponseTimeMs: 39,
				windowTruncated: false,
				recent: []
			}
		],
		bounds: { keyLimit: 100, keysTruncated: false, recentPerKey: 25 },
		...overrides
	} as unknown as OwnerApiUsage;
}

describe('mapOwnerApiUsage', () => {
	it('maps the canonical account quota independently from per-key attribution', () => {
		const mapped = mapOwnerApiUsage(usageFixture());

		expect(mapped.usageStats.monthlyUsage).toBe(15000);
		expect(mapped.usageStats.accountQuota).toEqual({
			monthlyRequests: 15000,
			monthlyLimit: 10000,
			monthlyRequestsRemaining: 0,
			monthlyPercent: 100,
			monthlyResetAt: '2026-08-01T00:00:00.000Z',
			collectionItemLimit: 100,
			limitScope: 'account',
			nearLimit: true,
			atLimit: true
		});
		expect(mapped.usageData.map((key) => key.monthlyRequests)).toEqual([9000, 6000]);
	});

	it('maps API records and daily series without exposing key secrets', () => {
		const mapped = mapOwnerApiUsage(usageFixture());

		expect(mapped.apiKeys[0]).toEqual({
			id: 'key-1',
			name: 'Production',
			created_at: '2026-01-01T00:00:00Z',
			last_used_at: '2026-07-26T11:00:00Z',
			is_active: true
		});
		expect(mapped.usageData[0].usage[0]).toEqual({
			endpoint: '/v1/catalog',
			timestamp: '2026-07-26T11:00:00Z',
			status_code: 200,
			response_time_ms: 42
		});
		expect(mapped.usageData[0]).toEqual(
			expect.objectContaining({
				recentSuccessRequests: 1,
				recentErrorRequests: 0,
				recentPendingRequests: 1
			})
		);
		expect(mapped.dailySummary[0]).toEqual(
			expect.objectContaining({ total_requests: 3, avg_response_time: 41 })
		);
		expect(mapped.bounds).toEqual({
			windowDays: 30,
			recordLimit: 20000,
			seriesTruncated: false,
			keyLimit: 100,
			keysTruncated: false,
			recentPerKey: 25
		});
		expect(JSON.stringify(mapped)).not.toContain('pk_live_');
	});

	it('represents unlimited plans without inventing a remaining allowance', () => {
		const fixture = usageFixture({
			plan: {
				id: 'enterprise',
				monthlyRequestLimit: -1,
				monthlyRequestLimitPerKey: -1,
				limitScope: 'account',
				collectionItemLimit: 100,
				unlimited: true
			}
		});

		expect(mapOwnerApiUsage(fixture).usageStats.accountQuota).toEqual(
			expect.objectContaining({
				monthlyLimit: -1,
				monthlyRequestsRemaining: null,
				monthlyPercent: null,
				nearLimit: false,
				atLimit: false
			})
		);
	});

	it('keeps exact account quota visible when the attribution key list is incomplete', () => {
		const fixture = usageFixture({
			summary: {
				monthlyRequests: 50000,
				monthlyRequestsRemaining: 0,
				monthlyResetAt: '2026-08-01T00:00:00.000Z',
				hourlyRequests: 50,
				totalKeys: 125,
				activeKeys: 110
			},
			bounds: { keyLimit: 100, keysTruncated: true, recentPerKey: 25 }
		});

		const mapped = mapOwnerApiUsage(fixture);

		expect(mapped.usageStats).toEqual(
			expect.objectContaining({
				totalKeys: 125,
				activeKeys: 110,
				accountQuota: expect.objectContaining({
					monthlyRequests: 50000,
					monthlyLimit: 10000,
					atLimit: true
				})
			})
		);
		expect(mapped.bounds).toEqual(
			expect.objectContaining({
				keysTruncated: true,
				seriesTruncated: false
			})
		);
	});

	it('fails closed instead of relabeling a legacy per-key quota as account-scoped', () => {
		const fixture = usageFixture({
			generatedAt: '2026-07-26T12:00:00Z',
			plan: {
				id: 'viewer',
				monthlyRequestLimitPerKey: 200,
				limitScope: 'api_key',
				unlimited: false
			},
			summary: {
				monthlyRequests: 75,
				hourlyRequests: 3,
				totalKeys: 2,
				activeKeys: 2
			}
		});

		expect(() => mapOwnerApiUsage(fixture)).toThrow(
			'Parchment usage response does not include the account quota contract'
		);
	});

	it('accepts the quota branch monthlyRequestsRemaining field during SDK rollout', () => {
		const fixture = usageFixture({
			plan: {
				id: 'viewer',
				monthlyRequestLimit: 200,
				monthlyRequestLimitPerKey: 200,
				limitScope: 'account',
				collectionItemLimit: 25,
				unlimited: false
			},
			summary: {
				monthlyRequests: 75,
				monthlyRequestsRemaining: 125,
				monthlyResetAt: '2026-08-01T00:00:00.000Z',
				hourlyRequests: 3,
				totalKeys: 2,
				activeKeys: 2
			}
		});

		expect(mapOwnerApiUsage(fixture).usageStats.accountQuota.monthlyRequestsRemaining).toBe(125);
	});
});
