import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

describe('/bot metadata', () => {
	it('publishes canonical public crawler metadata', async () => {
		const result = (await load({
			url: new URL('https://www.purveyors.io/bot')
		} as Parameters<typeof load>[0])) as {
			meta: {
				canonical: string;
				title: string;
				robots: string;
			};
		};

		expect(result.meta).toMatchObject({
			canonical: 'https://www.purveyors.io/bot',
			title: 'PurveyorsBot - Crawler Identity and Operator Policy',
			robots: 'index, follow'
		});
	});
});
