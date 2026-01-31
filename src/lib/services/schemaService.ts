/**
 * Schema Service for generating JSON-LD structured data
 * Supports Google Rich Results and enhanced search visibility
 */

export interface SchemaConfig {
	baseUrl: string;
	organizationName?: string;
	organizationDescription?: string;
	organizationLogo?: string;
	contactEmail?: string;
	contactPhone?: string;
}

export class SchemaService {
	private config: SchemaConfig;

	constructor(config: SchemaConfig) {
		this.config = {
			organizationName: 'Purveyors',
			organizationDescription: 'Professional coffee roasting platform and green coffee API',
			organizationLogo: '/purveyors_orange.svg',
			contactEmail: 'support@purveyors.io',
			...config
		};
	}

	/**
	 * Generate Organization schema for the business
	 */
	generateOrganizationSchema(): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: this.config.organizationName,
			description: this.config.organizationDescription,
			url: this.config.baseUrl,
			logo: {
				'@type': 'ImageObject',
				url: `${this.config.baseUrl}${this.config.organizationLogo}`
			},
			contactPoint: {
				'@type': 'ContactPoint',
				email: this.config.contactEmail,
				contactType: 'customer service'
			},
			sameAs: [
				// Add social media links when available
			]
		};
	}

	/**
	 * Generate Website schema with search action
	 */
	generateWebsiteSchema(): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'WebSite',
			name: this.config.organizationName,
			url: this.config.baseUrl,
			potentialAction: {
				'@type': 'SearchAction',
				target: {
					'@type': 'EntryPoint',
					urlTemplate: `${this.config.baseUrl}/?search={search_term_string}`
				},
				'query-input': 'required name=search_term_string'
			}
		};
	}

	/**
	 * Generate Product schema for API offering
	 */
	generateAPIProductSchema(): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'Product',
			name: 'Purveyors Green Coffee API',
			description:
				'The first normalized, daily-updated API for specialty green coffee. Real-time inventory data from top U.S. suppliers.',
			brand: {
				'@type': 'Organization',
				name: this.config.organizationName
			},
			category: 'Software API',
			url: `${this.config.baseUrl}/api`,
			offers: {
				'@type': 'Offer',
				availability: 'https://schema.org/InStock',
				priceCurrency: 'USD',
				price: '0.00',
				description: 'Free tier available with paid plans for higher usage'
			},
			aggregateRating: {
				'@type': 'AggregateRating',
				ratingValue: '5.0',
				reviewCount: '1',
				bestRating: '5',
				worstRating: '1'
			}
		};
	}

	/**
	 * Generate SoftwareApplication schema for the platform
	 */
	generateSoftwareApplicationSchema(): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: 'Purveyors Coffee Platform',
			description:
				'Professional coffee roasting platform with inventory management, roast tracking, and profit analytics',
			url: this.config.baseUrl,
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web Browser',
			offers: {
				'@type': 'Offer',
				price: '0.00',
				priceCurrency: 'USD',
				description: 'Free tier available with premium features'
			},
			creator: {
				'@type': 'Organization',
				name: this.config.organizationName
			}
		};
	}

	/**
	 * Generate ContactPage schema
	 */
	generateContactPageSchema(pageUrl: string): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'ContactPage',
			name: 'Contact Purveyors',
			description:
				'Get in touch with the Purveyors team for support, sales, or partnership inquiries',
			url: pageUrl,
			mainEntity: {
				'@type': 'Organization',
				name: this.config.organizationName,
				contactPoint: {
					'@type': 'ContactPoint',
					email: this.config.contactEmail,
					contactType: 'customer service'
				}
			}
		};
	}

	/**
	 * Generate FAQ schema for common questions
	 */
	generateFAQSchema(faqs: Array<{ question: string; answer: string }>): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: faqs.map((faq) => ({
				'@type': 'Question',
				name: faq.question,
				acceptedAnswer: {
					'@type': 'Answer',
					text: faq.answer
				}
			}))
		};
	}

	/**
	 * Generate Service schema for API offerings
	 */
	generateServiceSchema(service: {
		name: string;
		description: string;
		provider: string;
		serviceType: string;
		url: string;
		features: string[];
		audience?: string[];
	}): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'Service',
			name: service.name,
			description: service.description,
			provider: {
				'@type': 'Organization',
				name: service.provider
			},
			serviceType: service.serviceType,
			url: service.url,
			hasOfferCatalog: {
				'@type': 'OfferCatalog',
				name: `${service.name} Plans`,
				itemListElement: service.features.map((feature, index) => ({
					'@type': 'Offer',
					position: index + 1,
					itemOffered: {
						'@type': 'Service',
						name: feature
					}
				}))
			},
			audience: service.audience?.map((audienceType) => ({
				'@type': 'Audience',
				audienceType: audienceType
			}))
		};
	}

	/**
	 * Generate PriceSpecification schema for service pricing
	 */
	generatePricingSchema(
		pricingTiers: Array<{
			name: string;
			price: number;
			currency: string;
			billingDuration: string;
			description: string;
			features: string[];
			popular?: boolean;
		}>
	): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'OfferCatalog',
			name: 'API Pricing Plans',
			itemListElement: pricingTiers.map((tier, index) => ({
				'@type': 'Offer',
				position: index + 1,
				name: tier.name,
				description: tier.description,
				price: tier.price,
				priceCurrency: tier.currency,
				billingDuration: tier.billingDuration,
				itemOffered: {
					'@type': 'Service',
					name: `${tier.name} Plan`,
					description: tier.description
				},
				eligibleQuantity: {
					'@type': 'QuantitativeValue',
					value: tier.features.length,
					unitText: 'features'
				},
				...(tier.popular && {
					additionalProperty: {
						'@type': 'PropertyValue',
						name: 'popular',
						value: true
					}
				})
			}))
		};
	}

	/**
	 * Generate Person schema for team members/founders
	 */
	generatePersonSchema(person: {
		name: string;
		jobTitle: string;
		description: string;
		organization: string;
		email?: string;
		image?: string;
		url?: string;
		expertise?: string[];
	}): object {
		const schema: Record<string, unknown> = {
			'@context': 'https://schema.org',
			'@type': 'Person',
			name: person.name,
			jobTitle: person.jobTitle,
			description: person.description,
			worksFor: {
				'@type': 'Organization',
				name: person.organization
			}
		};

		if (person.email) {
			schema.email = person.email;
		}

		if (person.image) {
			schema.image = {
				'@type': 'ImageObject',
				url: person.image
			};
		}

		if (person.url) {
			schema.url = person.url;
		}

		if (person.expertise && person.expertise.length > 0) {
			schema.knowsAbout = person.expertise;
		}

		return schema;
	}

	/**
	 * Generate AboutPage schema
	 */
	generateAboutPageSchema(
		pageUrl: string,
		organization: {
			name: string;
			description: string;
			founder?: string;
			foundingDate?: string;
			mission?: string;
		}
	): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'AboutPage',
			name: `About ${organization.name}`,
			description: organization.description,
			url: pageUrl,
			mainEntity: {
				'@type': 'Organization',
				name: organization.name,
				description: organization.description,
				...(organization.founder && { founder: organization.founder }),
				...(organization.foundingDate && { foundingDate: organization.foundingDate }),
				...(organization.mission && { mission: organization.mission })
			}
		};
	}

	/**
	 * Generate Product schema for individual coffee items
	 */
	generateCoffeeProductSchema(coffee: {
		id: string;
		name: string;
		description?: string;
		origin?: string;
		price?: number;
		availability?: boolean;
		roaster?: string;
		imageUrl?: string;
	}): object {
		const productUrl = `${this.config.baseUrl}/coffee/${coffee.id}`;

		const schema: Record<string, unknown> = {
			'@context': 'https://schema.org',
			'@type': 'Product',
			name: coffee.name,
			description:
				coffee.description || `Premium coffee from ${coffee.origin || 'various origins'}`,
			category: 'Green Coffee',
			url: productUrl,
			brand: {
				'@type': 'Organization',
				name: coffee.roaster || 'Specialty Coffee Supplier'
			}
		};

		if (coffee.imageUrl) {
			schema.image = {
				'@type': 'ImageObject',
				url: coffee.imageUrl
			};
		}

		if (coffee.price !== undefined) {
			schema.offers = {
				'@type': 'Offer',
				price: coffee.price.toString(),
				priceCurrency: 'USD',
				availability: coffee.availability
					? 'https://schema.org/InStock'
					: 'https://schema.org/OutOfStock'
			};
		}

		return schema;
	}

	/**
	 * Generate BreadcrumbList schema for navigation
	 */
	generateBreadcrumbSchema(breadcrumbs: Array<{ name: string; url: string }>): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'BreadcrumbList',
			itemListElement: breadcrumbs.map((breadcrumb, index) => ({
				'@type': 'ListItem',
				position: index + 1,
				name: breadcrumb.name,
				item: breadcrumb.url
			}))
		};
	}

	/**
	 * Combine multiple schema objects into a graph
	 */
	generateSchemaGraph(schemas: object[]): object {
		return {
			'@context': 'https://schema.org',
			'@graph': schemas
		};
	}

	/**
	 * Generate ItemList schema for coffee collections
	 */
	generateCoffeeCollectionSchema(coffees: Record<string, unknown>[], pageUrl: string): object {
		return {
			'@context': 'https://schema.org',
			'@type': 'ItemList',
			name: 'Green Coffee Catalog',
			description: 'Curated collection of specialty green coffee from top U.S. suppliers',
			url: pageUrl,
			numberOfItems: coffees.length,
			itemListElement: coffees.slice(0, 20).map((coffee, index) => ({
				'@type': 'ListItem',
				position: index + 1,
				item: {
					'@type': 'Product',
					name: (coffee.name as string) || 'Specialty Coffee',
					description:
						(coffee.description as string) ||
						`Premium coffee from ${(coffee.origin as string) || 'specialty origins'}`,
					category: 'Green Coffee',
					brand: {
						'@type': 'Organization',
						name: (coffee.supplier as string) || 'Specialty Coffee Supplier'
					},
					offers: coffee.price
						? {
								'@type': 'Offer',
								price: (coffee.price as number).toString(),
								priceCurrency: 'USD',
								availability: coffee.stocked
									? 'https://schema.org/InStock'
									: 'https://schema.org/OutOfStock'
							}
						: undefined
				}
			}))
		};
	}

	/**
	 * Generate AggregateOffer schema for coffee catalog
	 */
	generateCoffeeAggregateOfferSchema(coffees: Record<string, unknown>[]): object {
		const prices = coffees
			.filter((coffee) => coffee.price && coffee.stocked)
			.map((coffee) => parseFloat(coffee.price as string));

		if (prices.length === 0) return {};

		const lowPrice = Math.min(...prices);
		const highPrice = Math.max(...prices);
		const offerCount = prices.length;

		return {
			'@context': 'https://schema.org',
			'@type': 'AggregateOffer',
			offerCount: offerCount,
			lowPrice: lowPrice.toFixed(2),
			highPrice: highPrice.toFixed(2),
			priceCurrency: 'USD',
			availability: 'https://schema.org/InStock'
		};
	}

	/**
	 * Helper method to generate page-specific schema combinations
	 */
	generatePageSchema(
		pageType: string,
		pageUrl: string,
		additionalData?: Record<string, any>
	): object {
		const schemas: object[] = [];

		// Always include organization schema
		schemas.push(this.generateOrganizationSchema());

		switch (pageType) {
			case 'homepage':
				schemas.push(this.generateWebsiteSchema());
				schemas.push(this.generateSoftwareApplicationSchema());

				// Add coffee collection schema if coffee data is provided (authenticated users)
				if (additionalData?.coffees && additionalData.coffees.length > 0) {
					schemas.push(this.generateCoffeeCollectionSchema(additionalData.coffees, pageUrl));
					const aggregateOffer = this.generateCoffeeAggregateOfferSchema(additionalData.coffees);
					if (Object.keys(aggregateOffer).length > 0) {
						schemas.push(aggregateOffer);
					}
				}
				break;

			case 'homepage-marketing':
				// Marketing landing page for non-authenticated users
				schemas.push(this.generateWebsiteSchema());
				schemas.push(this.generateSoftwareApplicationSchema());
				// No coffee collection data for non-authenticated users
				break;

			case 'api-service':
				// Enhanced API page schema
				if (additionalData?.service) {
					schemas.push(this.generateServiceSchema(additionalData.service));
				}
				if (additionalData?.pricing) {
					schemas.push(this.generatePricingSchema(additionalData.pricing));
				}
				if (additionalData?.faqs) {
					schemas.push(this.generateFAQSchema(additionalData.faqs));
				}
				// Keep legacy API product schema for compatibility
				schemas.push(this.generateAPIProductSchema());
				break;

			case 'about':
				// About page with founder information
				if (additionalData?.organization) {
					schemas.push(this.generateAboutPageSchema(pageUrl, additionalData.organization));
				}
				if (additionalData?.founder) {
					schemas.push(this.generatePersonSchema(additionalData.founder));
				}
				break;

			case 'contact':
				schemas.push(this.generateContactPageSchema(pageUrl));
				break;

			case 'coffee':
				if (additionalData?.coffee) {
					schemas.push(this.generateCoffeeProductSchema(additionalData.coffee));
				}
				break;

			case 'coffee-collection':
				if (additionalData?.coffees) {
					schemas.push(this.generateCoffeeCollectionSchema(additionalData.coffees, pageUrl));
					const aggregateOffer = this.generateCoffeeAggregateOfferSchema(additionalData.coffees);
					if (Object.keys(aggregateOffer).length > 0) {
						schemas.push(aggregateOffer);
					}
				}
				break;

			// Legacy support for original API case
			case 'api':
				schemas.push(this.generateAPIProductSchema());
				if (additionalData?.faqs) {
					schemas.push(this.generateFAQSchema(additionalData.faqs));
				}
				break;
		}

		// Add breadcrumbs if provided
		if (additionalData?.breadcrumbs) {
			schemas.push(this.generateBreadcrumbSchema(additionalData.breadcrumbs));
		}

		return schemas.length === 1 ? schemas[0] : this.generateSchemaGraph(schemas);
	}
}

// Helper function to create schema service instance
export function createSchemaService(baseUrl: string): SchemaService {
	return new SchemaService({ baseUrl });
}
