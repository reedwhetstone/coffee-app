/**
 * @deprecated
 * All functions in this file have been moved to `$lib/data/roast.ts`.
 * This file re-exports them for backwards compatibility.
 * Update callers to import directly from `$lib/data/roast.ts`.
 */
export {
	insertTemperatures,
	insertEvents,
	clearRoastData,
	extractMilestoneProfileData,
	saveRoastData
} from '$lib/data/roast.js';

export type { TemperatureRow, EventRow } from '$lib/data/roast.js';
