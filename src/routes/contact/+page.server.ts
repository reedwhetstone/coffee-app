import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ locals }) => {
	return {
		session: await locals.safeGetSession()
	};
};

export const actions: Actions = {
	default: async ({ request }) => {
		try {
			const formData = await request.formData();
			const name = formData.get('name')?.toString() || '';
			const email = formData.get('email')?.toString() || '';
			const subject = formData.get('subject')?.toString() || '';
			const message = formData.get('message')?.toString() || '';

			// Basic validation
			if (!name.trim()) {
				return fail(400, { error: 'Name is required' });
			}
			if (!email.trim() || !email.includes('@')) {
				return fail(400, { error: 'Valid email is required' });
			}
			if (!subject.trim()) {
				return fail(400, { error: 'Subject is required' });
			}
			if (!message.trim() || message.length < 10) {
				return fail(400, { error: 'Message must be at least 10 characters long' });
			}

			// TODO: Implement actual email sending logic
			// For now, just log the contact form submission
			console.log('Contact form submission:', {
				name,
				email,
				subject,
				message,
				timestamp: new Date().toISOString()
			});

			// In a real implementation, you would:
			// 1. Send an email using a service like SendGrid, Mailgun, or Nodemailer
			// 2. Store the message in a database
			// 3. Send a confirmation email to the user

			return {
				success: true,
				message: 'Your message has been sent successfully!'
			};
		} catch (error) {
			console.error('Contact form error:', error);
			return fail(500, { error: 'Failed to send message. Please try again later.' });
		}
	}
};
