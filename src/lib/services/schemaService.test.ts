import { describe, expect, it } from 'vitest';

import { SchemaService } from './schemaService';

type SchemaNode = {
	'@type'?: string;
	name?: string;
	description?: string;
	price?: number;
	billingDuration?: string;
	additionalProperty?: Array<{
		'@type'?: string;
		name?: string;
		value?: string | boolean;
	}>;
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

	it('keeps enterprise API pricing as contact-sales metadata instead of a $0 monthly tier', () => {
		const service = new SchemaService({ baseUrl: 'https://purveyors.test' });
		const schema = service.generatePageSchema('api-service', 'https://purveyors.test/api', {
			pricing: [
				{
					name: 'Explorer',
					price: 0,
					priceLabel: 'Free',
					currency: 'USD',
					billingDuration: 'P1M',
					description: 'Free baseline',
					features: ['25 rows per call']
				},
				{
					name: 'Enterprise',
					priceLabel: 'Contact sales',
					description: 'Custom integrations and commercial support.',
					features: ['Custom volume']
				}
			]
		}) as {
			'@graph': SchemaNode[];
		};

		const pricingSchema = schema['@graph'].find((node) => node['@type'] === 'OfferCatalog') as {
			itemListElement?: SchemaNode[];
		};
		const enterpriseOffer = pricingSchema.itemListElement?.find(
			(node) => node.name === 'Enterprise'
		);

		expect(enterpriseOffer?.price).toBeUndefined();
		expect(enterpriseOffer?.billingDuration).toBeUndefined();
		expect(enterpriseOffer?.additionalProperty).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'pricingModel', value: 'Custom contact-sales pricing' }),
				expect.objectContaining({ name: 'priceLabel', value: 'Contact sales' })
			])
		);
	});
});
