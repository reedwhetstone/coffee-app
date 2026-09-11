import { formatSourceName } from '$lib/utils/formatters';

/** Public editorial identity; storage format and subscription APIs remain compatible. */
export const NEWSLETTER = {
	name: 'Purveyors Fieldnotes',
	shortName: 'Fieldnotes',
	descriptor: 'Coffee, technology, and ideas worth trying.',
	description:
		'Short takes on coffee, AI, and emerging technology. Interesting connections, coffees to explore, and starting points for your next experiment.',
	path: '/fieldnotes'
} as const;

export function newsletterName(post: { newsletter?: 'fieldnotes' }, full = false): string {
	return post.newsletter === 'fieldnotes'
		? full
			? NEWSLETTER.name
			: NEWSLETTER.shortName
		: full
			? 'Purveyors Market Brief'
			: 'Market Brief';
}

/** Display catalog supplier identifiers consistently across newsletter formats. */
export function newsletterSupplierName(value: string): string {
	const formatted = formatSourceName(value);
	const trimmed = value.trim();
	const preserveReadableLabel =
		/\s/u.test(trimmed) &&
		!/[_-]/u.test(trimmed) &&
		formatted.toLocaleLowerCase('en-US') === trimmed.toLocaleLowerCase('en-US');
	return (preserveReadableLabel ? value : formatted).replaceAll("'", '’');
}
