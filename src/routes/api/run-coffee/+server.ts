import { json } from '@sveltejs/kit';
import { updateDatabase } from '../../SWEET/newcoffeescript';

export async function POST() {
	try {
		console.log('Starting coffee script execution...');
		await updateDatabase();
		console.log('Coffee script completed successfully');
		return json({ success: true });
	} catch (error) {
		console.error('Error in coffee script endpoint:', error);
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
