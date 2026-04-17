export const DEFAULT_API_PAGE_LIMIT = 100;
export const ANONYMOUS_API_PAGE_LIMIT = 15;
export const ANONYMOUS_ALLOWED_FILTER_PARAMS = ['country', 'processing', 'name'] as const;
export const ANONYMOUS_ALLOWED_FILTER_PARAM_LIST = ANONYMOUS_ALLOWED_FILTER_PARAMS.join(', ');
export const ANONYMOUS_DEFAULT_SORT_FIELD = 'stocked_date';
export const ANONYMOUS_DEFAULT_SORT_DIRECTION = 'desc';
export const ANONYMOUS_ALLOWED_QUERY_PARAMS = [
	'page',
	'limit',
	'sortField',
	'sortDirection',
	...ANONYMOUS_ALLOWED_FILTER_PARAMS
] as const;
