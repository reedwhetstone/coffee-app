import { redirect } from '@sveltejs/kit';

export function load({ url }) {
	const error = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	if (error) {
		throw redirect(303, `/?error=${error}&error_description=${errorDescription}`);
	}

	throw redirect(303, '/');
}
