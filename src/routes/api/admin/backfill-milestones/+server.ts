import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createMilestoneCalculationService } from '$lib/services/milestoneCalculationService';

export const POST: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Check if user has admin/member role (you may want to add additional role checking here)
		const { data: userRole } = await supabase
			.from('user_roles')
			.select('user_role')
			.eq('id', user.id)
			.single();

		if (!userRole || !userRole.user_role.includes('member')) {
			return json({ error: 'Insufficient permissions' }, { status: 403 });
		}

		console.log('Starting milestone backfill process...');
		const milestoneService = createMilestoneCalculationService(supabase);
		const stats = await milestoneService.backfillNullMilestones();

		return json({
			success: true,
			message: 'Milestone backfill completed',
			stats
		});
	} catch (error) {
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
