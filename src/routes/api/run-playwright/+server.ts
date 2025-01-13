import { json } from '@sveltejs/kit';
import { updateDatabase } from '../../SWEET/playwrightscript';

export async function POST() {
	const sendLog = (message: string) => {
		global.processHandler.sendLog(message);
	};

	try {
		sendLog('Starting playwright script execution...');
		await updateDatabase();
		sendLog('Playwright script completed successfully');
		return json({ success: true });
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		sendLog(`Error in playwright endpoint: ${errorMessage}`);
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
