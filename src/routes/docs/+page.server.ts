import type { PageServerLoad } from './$types';
import { DOCS_NAV } from '$lib/docs/content';

export const load: PageServerLoad = async () => ({
	sections: DOCS_NAV
});
