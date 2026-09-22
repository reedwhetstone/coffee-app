import { track } from '@vercel/analytics/sveltekit';

export type ProfileStudioActivationEvent =
	| 'artisan_file_accepted'
	| 'reference_profile_saved'
	| 'profile_comparison_completed'
	| 'cherry_comparison_completed';

/** Privacy-safe activation events. Never attach filenames, IDs, notes, or curve data. */
export function trackProfileStudioActivation(event: ProfileStudioActivationEvent): void {
	track(event, { surface: 'profile_studio' });
}
