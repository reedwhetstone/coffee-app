import { createServerSupabaseClient } from '$lib/supabase';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateDatabase } from '../../SWEET/newcoffeescript';

// Initialize processHandler if it doesn't exist
if (!global.processHandler) {
	global.processHandler = {
		sendLog: (message: string) => console.log(message),
		addProcess: () => {}
	};
}

export const POST: RequestHandler = async ({ cookies }) => {
	const supabase = createServerSupabaseClient({ cookies });

	const sendLog = (message: string) => {
		console.log(message);
		global.processHandler.sendLog(message);
	};

	try {
		sendLog('Starting coffee script execution...');
		await updateDatabase();
		sendLog('Coffee script completed successfully');

		return json({
			success: true,
			message: 'Coffee script completed successfully'
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		console.error('Error in coffee script:', error);
		sendLog(`Error in coffee script endpoint: ${errorMessage}`);

		return json({ error: errorMessage }, { status: 500 });
	}
};
