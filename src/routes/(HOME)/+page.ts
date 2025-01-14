// src/routes/+page.ts
import type { Load } from '@sveltejs/kit';

export const load: Load = async ({ fetch }) => {
	const response = await fetch('/api/data');

	// Debugging logs
	console.log('Fetching data from /api/data...');
	console.log('Response status:', response.status);

	if (!response.ok) {
		throw new Error(`Failed to fetch data: ${response.status}`);
	}

	const json = await response.json();

	// console.log('Fetched data:', json);
	console.log('Fetched data, completed');

	return { data: json.data }; // Return only the `data` array
};
