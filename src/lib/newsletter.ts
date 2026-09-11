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
	if (/^sweet[_ -]marias?$/iu.test(value)) return 'Sweet Maria’s';
	if (!/[_-]/u.test(value)) return value;
	return value
		.split(/[_-]+/u)
		.map((part) => `${part.charAt(0).toLocaleUpperCase('en-US')}${part.slice(1)}`)
		.join(' ');
}
