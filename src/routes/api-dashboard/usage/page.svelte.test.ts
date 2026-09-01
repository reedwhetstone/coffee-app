import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import UsagePage from './+page.svelte';
import type { PageData } from './$types';

function pageData(): PageData {
	return {
		apiKeys: [
			{
				id: 'key-1',
				name: 'Production',
				created_at: '2026-08-01T00:00:00.000Z',
				last_used_at: '2026-08-31T12:00:00.000Z',
				is_active: true
			}
		],
		usageData: [
			{
				keyId: 'key-1',
				keyName: 'Production',
				monthlyRequests: 75,
				windowRequests: 75,
				windowTruncated: false,
				recentSuccessRequests: 1,
				recentErrorRequests: 0,
				recentPendingRequests: 0,
				usage: [
					{
						endpoint: '/v1/catalog',
						timestamp: '2026-08-31T12:00:00.000Z',
						status_code: 200,
						response_time_ms: 42
					}
				]
			}
		],
		dailySummary: [],
		currentStats: {
			monthlyUsage: 75,
			hourlyUsage: 1,
			userTier: 'viewer',
			unlimited: false,
			totalKeys: 1,
			activeKeys: 1,
			accountQuota: {
				monthlyRequests: 75,
				monthlyLimit: 200,
				monthlyRequestsRemaining: 125,
				monthlyPercent: 37.5,
				monthlyResetAt: '2026-09-01T00:00:00.000Z',
				collectionItemLimit: 25,
				limitScope: 'account',
				nearLimit: false,
				atLimit: false
			}
		},
		bounds: {
			windowDays: 30,
			recordLimit: 20000,
			seriesTruncated: false,
			keyLimit: 100,
			keysTruncated: false,
			recentPerKey: 25
		}
	} as unknown as PageData;
}

describe('Parchment usage analytics', () => {
	it('leads with absolute account limits and labels key rows as attribution', () => {
		render(UsagePage, { data: pageData() });

		expect(screen.getByText(/75 \/\s*200/)).toBeInTheDocument();
		expect(screen.getByText('125')).toBeInTheDocument();
		expect(screen.getByText(/Sep 1, 2026, 12:00 AM UTC/)).toBeInTheDocument();
		expect(screen.getByText('Up to 25 items')).toBeInTheDocument();
		expect(
			screen.getByText(
				/They are not separate allowances, and creating another key does not increase/
			)
		).toBeInTheDocument();
		expect(screen.queryByText(/limits apply separately to each key/i)).not.toBeInTheDocument();
	});
});
