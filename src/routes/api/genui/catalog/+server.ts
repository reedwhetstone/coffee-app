import { json } from '@sveltejs/kit';
import { AuthError, requireChatAccess } from '$lib/server/auth';
import { catalogIndex, describeComponents } from '$lib/genui/catalog';
import type { RequestHandler } from './$types';

/**
 * Progressive-disclosure source for the genUI catalog. The one-line index is
 * generated from the registry; full prop schemas are returned only for the
 * components asked for (`?names=checklist,card`), or all when omitted.
 */
export const GET: RequestHandler = async (event) => {
	try {
		await requireChatAccess(event);
	} catch (error) {
		if (error instanceof AuthError) return json({ error: error.message }, { status: error.status });
		throw error;
	}
	const names = (event.url.searchParams.get('names') ?? '')
		.split(',')
		.map((n) => n.trim())
		.filter(Boolean)
		.slice(0, 40);
	return json({ index: catalogIndex(), ...describeComponents(names) });
};
