import { json } from '@sveltejs/kit';
import { updateDatabase } from '../../SWEET/newcoffeescript';

export async function POST() {
	const sendLog = (message: string) => {
		global.processHandler.sendLog(message);
	};

	try {
		sendLog('Starting coffee script execution...');
		await updateDatabase();
		sendLog('Coffee script completed successfully');
		return json({ success: true });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
