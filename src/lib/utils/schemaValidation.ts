/**
 * Schema validation and testing utilities for development
 */

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
	schema: object;
}

export interface SchemaTestResult {
	url: string;
	schemas: ValidationResult[];
	richResultsPreview: string;
}

/**
 * Validate a JSON-LD schema object
 */
export function validateSchema(schema: any): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];

	try {
		// Basic structure validation
		if (!schema['@context']) {
			errors.push('Missing @context property');
		}

		if (!schema['@type']) {
			errors.push('Missing @type property');
		}

		// Type-specific validation
		if (schema['@type']) {
			validateByType(schema, errors, warnings);
		}

		// Check for common issues
		validateCommonIssues(schema, errors, warnings);

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
			schema
		};
	} catch (error) {
		return {
			isValid: false,
			errors: [`Schema validation failed: ${error}`],
			warnings: [],
			schema
		};
	}
}

/**
 * Type-specific validation rules
 */
function validateByType(schema: any, errors: string[], warnings: string[]): void {
	switch (schema['@type']) {
		case 'Organization':
			validateOrganization(schema, errors, warnings);
			break;
		case 'Product':
			validateProduct(schema, errors, warnings);
			break;
		case 'WebSite':
			validateWebSite(schema, errors, warnings);
			break;
		case 'BreadcrumbList':
			validateBreadcrumbList(schema, errors, warnings);
			break;
		case 'FAQPage':
			validateFAQPage(schema, errors, warnings);
			break;
		case 'ItemList':
			validateItemList(schema, errors, warnings);
			break;
		default:
			warnings.push(`Validation rules not implemented for type: ${schema['@type']}`);
	}
}

/**
 * Validate Organization schema
 */
function validateOrganization(schema: any, errors: string[], warnings: string[]): void {
	if (!schema.name) {
		errors.push('Organization missing required "name" property');
	}

	if (!schema.url) {
		warnings.push('Organization missing recommended "url" property');
	}

	if (schema.logo && !schema.logo.url) {
		errors.push('Organization logo missing "url" property');
	}
}

/**
 * Validate Product schema
 */
function validateProduct(schema: any, errors: string[], warnings: string[]): void {
	if (!schema.name) {
		errors.push('Product missing required "name" property');
	}

	if (!schema.description) {
		warnings.push('Product missing recommended "description" property');
	}

	if (schema.offers) {
		validateOffer(schema.offers, errors, warnings);
	}
}

/**
 * Validate Offer schema
 */
function validateOffer(offer: any, errors: string[], warnings: string[]): void {
	if (!offer.availability) {
		warnings.push('Offer missing recommended "availability" property');
	}

	if (offer.price && !offer.priceCurrency) {
		errors.push('Offer with price missing required "priceCurrency" property');
	}
}

/**
 * Validate WebSite schema
 */
function validateWebSite(schema: any, errors: string[], _warnings: string[]): void {
	if (!schema.name) {
		errors.push('WebSite missing required "name" property');
	}

	if (!schema.url) {
		errors.push('WebSite missing required "url" property');
	}

	if (schema.potentialAction) {
		if (!schema.potentialAction.target) {
			errors.push('SearchAction missing required "target" property');
		}
	}
}

/**
 * Validate BreadcrumbList schema
 */
function validateBreadcrumbList(schema: any, errors: string[], _warnings: string[]): void {
	if (!schema.itemListElement || !Array.isArray(schema.itemListElement)) {
		errors.push('BreadcrumbList missing required "itemListElement" array');
		return;
	}

	schema.itemListElement.forEach((item: any, index: number) => {
		if (!item.position) {
			errors.push(`BreadcrumbList item ${index} missing "position" property`);
		}
		if (!item.name) {
			errors.push(`BreadcrumbList item ${index} missing "name" property`);
		}
		if (!item.item) {
			errors.push(`BreadcrumbList item ${index} missing "item" property`);
		}
	});
}

/**
 * Validate FAQPage schema
 */
function validateFAQPage(schema: any, errors: string[], _warnings: string[]): void {
	if (!schema.mainEntity || !Array.isArray(schema.mainEntity)) {
		errors.push('FAQPage missing required "mainEntity" array');
		return;
	}

	schema.mainEntity.forEach((question: any, index: number) => {
		if (!question.name) {
			errors.push(`FAQ question ${index} missing "name" property`);
		}
		if (!question.acceptedAnswer || !question.acceptedAnswer.text) {
			errors.push(`FAQ question ${index} missing "acceptedAnswer.text" property`);
		}
	});
}

/**
 * Validate ItemList schema
 */
function validateItemList(schema: any, errors: string[], warnings: string[]): void {
	if (!schema.itemListElement || !Array.isArray(schema.itemListElement)) {
		errors.push('ItemList missing required "itemListElement" array');
		return;
	}

	if (schema.numberOfItems !== schema.itemListElement.length) {
		warnings.push('ItemList numberOfItems does not match itemListElement array length');
	}
}

/**
 * Check for common schema issues
 */
function validateCommonIssues(schema: any, errors: string[], warnings: string[]): void {
	// Check for missing URLs in properties that should have them
	const urlFields = ['url', 'sameAs', 'image'];
	urlFields.forEach((field) => {
		if (schema[field] && typeof schema[field] === 'string') {
			if (!isValidUrl(schema[field])) {
				warnings.push(`Invalid URL format in "${field}": ${schema[field]}`);
			}
		}
	});

	// Check for empty required string fields
	const stringFields = ['name', 'description'];
	stringFields.forEach((field) => {
		if (schema[field] === '') {
			warnings.push(`Empty string in "${field}" property`);
		}
	});
}

/**
 * Simple URL validation
 */
function isValidUrl(string: string): boolean {
	try {
		new URL(string);
		return true;
	} catch (_) {
		return false;
	}
}

/**
 * Generate Rich Results testing URLs
 */
export function generateTestingUrls(pageUrl: string): {
	richResultsTest: string;
	structuredDataTest: string;
} {
	const encodedUrl = encodeURIComponent(pageUrl);

	return {
		richResultsTest: `https://search.google.com/test/rich-results?url=${encodedUrl}`,
		structuredDataTest: `https://validator.schema.org/#url=${encodedUrl}`
	};
}

/**
 * Development helper to log schema validation results
 */
export function logSchemaValidation(schemas: any[], pageUrl: string): void {
	if (typeof window === 'undefined') return; // Only run in browser

	console.group('🔍 Schema Validation Results');
	console.log('Page URL:', pageUrl);

	const testingUrls = generateTestingUrls(pageUrl);
	console.log('🧪 Testing URLs:');
	console.log('  - Rich Results Test:', testingUrls.richResultsTest);
	console.log('  - Schema Validator:', testingUrls.structuredDataTest);

	schemas.forEach((schema, index) => {
		const result = validateSchema(schema);
		console.group(`Schema ${index + 1}: ${schema['@type'] || 'Unknown'}`);

		if (result.isValid) {
			console.log('✅ Valid schema');
		} else {
			console.log('❌ Invalid schema');
		}

		if (result.errors.length > 0) {
			console.log('🚨 Errors:', result.errors);
		}

		if (result.warnings.length > 0) {
			console.log('⚠️ Warnings:', result.warnings);
		}

		console.log('📄 Schema:', schema);
		console.groupEnd();
	});

	console.groupEnd();
}

/**
 * Extract schemas from page HTML (for testing)
 */
export function extractSchemasFromPage(): any[] {
	if (typeof window === 'undefined') return [];

	const schemas: any[] = [];
	const scriptElements = document.querySelectorAll('script[type="application/ld+json"]');

	scriptElements.forEach((script) => {
		try {
			const schema = JSON.parse(script.textContent || '');
			if (schema['@graph']) {
				schemas.push(...schema['@graph']);
			} else {
				schemas.push(schema);
			}
		} catch (error) {
			console.warn('Failed to parse schema from script tag:', error);
		}
	});

	return schemas;
}

/**
 * Development tool to validate current page schemas
 */
export function validateCurrentPageSchemas(): void {
	const schemas = extractSchemasFromPage();
	const currentUrl = window.location.href;
	logSchemaValidation(schemas, currentUrl);
}
