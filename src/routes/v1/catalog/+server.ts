import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(
		{
			resource: 'catalog',
			namespace: '/v1/catalog',
			status: 'not-yet-implemented',
			message:
				'The canonical /v1/catalog handler scaffolding is in place; the resource cutover lands in a follow-up PR.'
		},
		{ status: 501 }
	);
};
