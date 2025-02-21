import { error } from '@sveltejs/kit';

export function load() {
	console.log('Catch-all route handler triggered');

	const err = new Error('Page not found');
	(err as any).code = 'NOT_FOUND';
	throw error(404, err);
}
