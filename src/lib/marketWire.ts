import type { components } from '@purveyors/sdk';

export type MarketReadPreference = components['schemas']['EmailSubscriptionPreference'];

export interface MarketWireArchiveItem {
	slug: string;
	title: string;
	description: string;
	date: string;
	edition: number;
}

export interface MarketReadPreferenceState {
	preference: MarketReadPreference | null;
	error: string | null;
}
