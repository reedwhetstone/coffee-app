import { describe, expect, it } from 'vitest';
import type { OwnerApiUsage } from '@purveyors/sdk';
import { mapOwnerApiUsage } from './api-usage';

function usageFixture(overrides: Partial<OwnerApiUsage> = {}): OwnerApiUsage {
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
			monthlyRequestLimitPerKey: 10000,
			limitScope: 'api_key',
			unlimited: false
		},
		summary: {
			monthlyRequests: 15000,
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
	};
}

describe('mapOwnerApiUsage', () => {
	it('keeps aggregate traffic separate from the highest per-key quota', () => {
		const mapped = mapOwnerApiUsage(usageFixture());

		expect(mapped.usageStats.monthlyUsage).toBe(15000);
		expect(mapped.usageStats.highestKeyQuota).toEqual({
			keyId: 'key-1',
			keyName: 'Production',
			monthlyRequests: 9000,
			monthlyLimitPerKey: 10000,
			monthlyPercent: 90,
			nearLimit: true,
			atLimit: false
		});
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
		expect(mapped.dailySummary[0]).toEqual(
			expect.objectContaining({ total_requests: 3, avg_response_time: 41 })
		);
		expect(JSON.stringify(mapped)).not.toContain('pk_live_');
	});

	it('does not create quota warnings for an unlimited plan', () => {
		const fixture = usageFixture({
			plan: {
				id: 'enterprise',
				monthlyRequestLimitPerKey: -1,
				limitScope: 'api_key',
				unlimited: true
			}
		});

		expect(mapOwnerApiUsage(fixture).usageStats.highestKeyQuota).toBeNull();
	});

	it('does not warn on an inactive key that can no longer consume quota', () => {
		const fixture = usageFixture({
			keys: [
				{
					...usageFixture().keys[0],
					isActive: false,
					monthlyRequests: 10000
				},
				{
					...usageFixture().keys[1],
					isActive: true,
					monthlyRequests: 100
				}
			]
		});

		expect(mapOwnerApiUsage(fixture).usageStats.highestKeyQuota).toEqual(
			expect.objectContaining({
				keyId: 'key-2',
				monthlyRequests: 100,
				nearLimit: false,
				atLimit: false
			})
		);
	});
});
