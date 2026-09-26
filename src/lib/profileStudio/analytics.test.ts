import { beforeEach, describe, expect, it, vi } from 'vitest';

const analyticsMocks = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@vercel/analytics/sveltekit', () => ({ track: analyticsMocks.track }));

import { trackProfileStudioActivation } from './analytics';

describe('Profile Studio activation analytics', () => {
	beforeEach(() => vi.clearAllMocks());

	it('records completion milestones without filenames, ids, notes, or curve data', () => {
		trackProfileStudioActivation('cherry_comparison_completed');

		expect(analyticsMocks.track).toHaveBeenCalledWith('cherry_comparison_completed', {
			surface: 'profile_studio'
		});
	});
});
