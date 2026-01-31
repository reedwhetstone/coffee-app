import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import crypto from 'crypto';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { resourceId, expiresIn = '7d' } = await request.json();

		// Validate resourceId if it's not 'all'
		if (resourceId !== 'all') {
			const { data: beanExists } = await supabase
				.from('green_coffee_inv')
				.select('id')
				.eq('id', resourceId)
				.eq('user', user.id)
				.single();

			if (!beanExists) {
				return json({ error: 'Bean not found or unauthorized' }, { status: 404 });
			}
		}

		// Generate a secure random token
		const shareToken = crypto.randomBytes(32).toString('hex');

		// Calculate expiration date
		const expires = new Date();
		expires.setDate(expires.getDate() + parseInt(expiresIn));

		const { error } = await supabase
			.from('shared_links')
			.insert({
				user_id: user.id,
				share_token: shareToken,
				resource_type: 'bean',
				resource_id: resourceId,
				expires_at: expires.toISOString(),
				is_active: true
			} as any) // eslint-disable-line @typescript-eslint/no-explicit-any
			.select()
			.single();

		if (error) throw error;

		return json({
			shareUrl: `${request.headers.get('origin')}/beans?share=${shareToken}`
		});
	} catch (error) {
		console.error('Error creating share link:', error);
		return json({ error: 'Failed to create share link' }, { status: 500 });
	}
};
