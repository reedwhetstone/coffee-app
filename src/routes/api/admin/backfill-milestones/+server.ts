import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createMilestoneCalculationService } from '$lib/services/milestoneCalculationService';
import { AuthError, requireMemberRole } from '$lib/server/auth';

export const POST: RequestHandler = async (event) => {
	try {
		await requireMemberRole(event);

		console.log('Starting milestone backfill process...');
		const milestoneService = createMilestoneCalculationService(event.locals.supabase);
		const stats = await milestoneService.backfillNullMilestones();

		return json({
			success: true,
			message: 'Milestone backfill completed',
			stats
		});
	} catch (error) {
		if (error instanceof AuthError) {
			return json(
				{ error: error.status === 401 ? 'Unauthorized' : 'Insufficient permissions' },
				{ status: error.status }
			);
		}

		console.error('Error in milestone backfill:', error);
		return json(
			{
				error: 'Failed to backfill milestones',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
