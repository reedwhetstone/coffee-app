import { error } from '@sveltejs/kit';

export function load() {
	console.log('Catch-all route handler triggered');

	const err = error(404, {
		message: 'Page not found',
		code: 'NOT_FOUND'
	});

	console.error('404 Error details:', {
		status: err.status,
		message: err.message,
		code: err.data?.code
	});

	return {
		status: 404,
		error: err
	};
}
