import { json } from '@sveltejs/kit';
import { updateDatabase } from '../../SWEET/newcoffeescript';
import { supabase } from '$lib/server/db';

// Initialize processHandler if it doesn't exist
if (!global.processHandler) {
	global.processHandler = {
		sendLog: (message: string) => console.log(message),
		addProcess: () => {}
	};
}

export async function POST() {
	if (!supabase) {
		console.error('Supabase client check failed:', supabase);
		throw new Error('Supabase client is not initialized.');
	}

	const sendLog = (message: string) => {
		console.log(message); // Log to console for debugging
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

		return json(
			{
				success: false,
				error: errorMessage,
				details: error
			},
			{ status: 500 }
		);
	}
}
