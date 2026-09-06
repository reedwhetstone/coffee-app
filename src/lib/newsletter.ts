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
