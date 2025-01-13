import { json } from '@sveltejs/kit';
import { updateDatabase } from '../../SWEET/playwrightscript';

export async function POST() {
	try {
		console.log('Starting playwright script execution...');
		await updateDatabase();
		console.log('Playwright script completed successfully');
		return json({ success: true });
	} catch (error) {
		console.error('Error in playwright endpoint:', error);
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error',
				details: error
			},
			{ status: 500 }
		);
	}
}
