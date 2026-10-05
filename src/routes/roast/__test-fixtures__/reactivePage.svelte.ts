/**
 * A stand-in for `$app/state`'s `page` whose address changes are seen by the page under
 * test, so a test can change a filter, follow a link, and read what the page asked for.
 */
export const page = $state({
	url: new URL('http://localhost/roast'),
	data: {} as Record<string, unknown>,
	state: {} as Record<string, unknown>
});
