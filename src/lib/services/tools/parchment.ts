import type { ParchmentClient } from '@purveyors/sdk';

export type AgentParchmentClient = ParchmentClient;

export function unwrapParchment<T>(result: { data?: T; error?: unknown }): T {
	if (result.error) {
		const error = result.error as { error?: string; message?: string };
		throw new Error(error.message ?? error.error ?? 'Parchment API request failed');
	}
	if (result.data === undefined) throw new Error('Parchment API returned no data');
	return result.data;
}
