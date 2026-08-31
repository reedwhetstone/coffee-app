import type { RequestEvent } from '@sveltejs/kit';

import type { MarketReadPreferenceState } from '$lib/marketWire';
import { createParchmentServerClient } from '$lib/server/parchmentClient';

export async function loadMarketReadPreference(
	event: RequestEvent
): Promise<MarketReadPreferenceState> {
	try {
		const client = await createParchmentServerClient(event, {
			mode: 'session',
			preferHandling: 'inherit'
		});
		const result = await client.emailSubscriptions.get();
		const preference = result.data?.data;

		if (preference) {
			return { preference, error: null };
		}

		return {
			preference: null,
			error:
				result.error?.error?.message ?? 'Your Market Brief preference is temporarily unavailable.'
		};
	} catch {
		return {
			preference: null,
			error: 'Your Market Brief preference is temporarily unavailable.'
		};
	}
}
