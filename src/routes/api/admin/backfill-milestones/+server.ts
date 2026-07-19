import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createMilestoneCalculationService } from '$lib/services/milestoneCalculationService';
import { checkRole, type UserRole } from '$lib/types/auth.types';

export const POST: RequestHandler = async ({ locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Read the canonical scalar app role. Admin inherits member access through checkRole.
		const { data: userRole } = (await supabase
			.from('user_roles')
			.select('role')
			.eq('id', user.id)
			.single()) as { data: { role: UserRole } | null };

		if (!userRole || !checkRole(userRole.role, 'member')) {
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
