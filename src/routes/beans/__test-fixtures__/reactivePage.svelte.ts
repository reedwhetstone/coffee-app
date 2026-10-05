/**
 * A stand-in for `$app/state`'s `page` whose address changes are seen by the page under
 * test, so a test can follow a link, go Back, and read what the page wrote.
 */
export const page = $state({
	url: new URL('https://purveyors.io/beans'),
	data: {} as Record<string, unknown>,
	state: {} as Record<string, unknown>
});
