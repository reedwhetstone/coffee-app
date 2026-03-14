import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importArtisanData } from '$lib/data/artisan.js';

export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	try {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;
		const roastId = formData.get('roastId') as string;

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}
		if (!roastId) {
			return json({ error: 'No roast ID provided' }, { status: 400 });
		}

		// Validate file format - accept .alog, .alog.json, or .json files
		const fileName = file.name.toLowerCase();
		if (
			!fileName.endsWith('.alog') &&
			!fileName.endsWith('.alog.json') &&
			!fileName.endsWith('.json')
		) {
			return json(
				{
					error:
						'Unsupported file format. Please use .alog files from Artisan or .alog.json/.json files.'
				},
				{ status: 400 }
			);
		}

		const fileContent = await file.text();
		const result = await importArtisanData(
			supabase,
			parseInt(roastId),
			user.id,
			fileContent,
			file.name
		);

		return json(result);
	} catch (error) {
		console.error('Error importing Artisan file:', error);

		let errorMessage = 'Failed to import Artisan file';
		let statusCode = 500;

		if (error instanceof Error) {
			errorMessage = error.message;

			if (error.message === 'Unauthorized') {
				statusCode = 403;
			} else if (
				error.message.includes('Invalid Artisan file') ||
				error.message.includes('Missing required field') ||
				error.message.includes('Failed to parse JSON')
			) {
				statusCode = 400;
			}
		}

		return json({ error: errorMessage }, { status: statusCode });
	}
};
