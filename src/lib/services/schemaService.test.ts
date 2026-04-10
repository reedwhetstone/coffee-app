import { describe, expect, it } from 'vitest';

import { SchemaService } from './schemaService';

type SchemaNode = {
	'@type'?: string;
	description?: string;
	potentialAction?: {
		target?: {
			urlTemplate?: string;
		};
	};
};

describe('SchemaService homepage marketing schema', () => {
	it('points SearchAction at the public catalog search surface', () => {
		const service = new SchemaService({ baseUrl: 'https://purveyors.test' });
		const schema = service.generatePageSchema('homepage-marketing', 'https://purveyors.test') as {
			'@graph': SchemaNode[];
		};

		const websiteSchema = schema['@graph'].find((node) => node['@type'] === 'WebSite');

		expect(websiteSchema?.potentialAction?.target?.urlTemplate).toBe(
			'https://purveyors.test/catalog?name={search_term_string}'
		);
	});

	it('keeps the marketplace-first homepage descriptions in the JSON-LD payload', () => {
		const service = new SchemaService({ baseUrl: 'https://purveyors.test' });
		const schema = service.generatePageSchema('homepage-marketing', 'https://purveyors.test') as {
			'@graph': SchemaNode[];
		};

		const organizationSchema = schema['@graph'].find((node) => node['@type'] === 'Organization');
		const appSchema = schema['@graph'].find((node) => node['@type'] === 'SoftwareApplication');

		expect(organizationSchema?.description).toContain('live green coffee catalog');
		expect(organizationSchema?.description).toContain('API-first workflow layer');
		expect(appSchema?.description).toContain('live green coffee catalog');
		expect(appSchema?.description).toContain('roast tracking');
	});
});
