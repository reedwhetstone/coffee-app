#!/usr/bin/env node

/**
 * Schema validation script for CI/CD pipeline
 * Tests structured data on deployed pages
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Simple schema validation rules
const REQUIRED_SCHEMAS = {
	'/': ['Organization', 'WebSite', 'SoftwareApplication'], // Marketing or authenticated homepage
	'/api': ['Organization', 'Service', 'OfferCatalog', 'FAQPage'], // Enhanced API service page
	'/contact': ['Organization', 'AboutPage', 'Person'] // About page with founder information
};

const SCHEMA_TYPES = {
	Organization: {
		required: ['@type', '@context', 'name', 'url'],
		recommended: ['description', 'logo']
	},
	WebSite: {
		required: ['@type', '@context', 'name', 'url'],
		recommended: ['potentialAction']
	},
	SoftwareApplication: {
		required: ['@type', '@context', 'name'],
		recommended: ['description', 'applicationCategory']
	},
	Service: {
		required: ['@type', '@context', 'name', 'provider'],
		recommended: ['description', 'serviceType', 'hasOfferCatalog']
	},
	OfferCatalog: {
		required: ['@type', '@context', 'name'],
		recommended: ['itemListElement']
	},
	Product: {
		required: ['@type', '@context', 'name'],
		recommended: ['description', 'offers']
	},
	FAQPage: {
		required: ['@type', '@context', 'mainEntity'],
		recommended: []
	},
	AboutPage: {
		required: ['@type', '@context', 'name'],
		recommended: ['description', 'mainEntity']
	},
	Person: {
		required: ['@type', '@context', 'name'],
		recommended: ['jobTitle', 'worksFor']
	},
	ContactPage: {
		required: ['@type', '@context', 'name'],
		recommended: ['mainEntity']
	},
	ItemList: {
		required: ['@type', '@context', 'itemListElement'],
		recommended: ['name', 'numberOfItems']
	},
	AggregateOffer: {
		required: ['@type', '@context', 'lowPrice', 'highPrice'],
		recommended: ['offerCount', 'priceCurrency']
	}
};

/**
 * Validate a single schema object
 */
function validateSchema(schema, schemaType) {
	const errors = [];
	const warnings = [];
	const rules = SCHEMA_TYPES[schemaType];

	if (!rules) {
		warnings.push(`No validation rules defined for schema type: ${schemaType}`);
		return { errors, warnings };
	}

	// Check required fields
	rules.required.forEach((field) => {
		if (!schema[field]) {
			errors.push(`Missing required field: ${field}`);
		}
	});

	// Check recommended fields
	rules.recommended.forEach((field) => {
		if (!schema[field]) {
			warnings.push(`Missing recommended field: ${field}`);
		}
	});

	return { errors, warnings };
}

/**
 * Extract schemas from built HTML files
 */
function extractSchemasFromHTML(htmlContent) {
	const schemas = [];
	const scriptRegex = /<script type="application\/ld\+json">(.*?)<\/script>/gs;
	let match;

	while ((match = scriptRegex.exec(htmlContent)) !== null) {
		try {
			const schemaData = JSON.parse(match[1]);
			if (schemaData['@graph']) {
				schemas.push(...schemaData['@graph']);
			} else {
				schemas.push(schemaData);
			}
		} catch (error) {
			console.warn('Failed to parse schema JSON:', error.message);
		}
	}

	return schemas;
}

/**
 * Validate schemas for a specific page
 */
function validatePageSchemas(route, htmlContent) {
	const schemas = extractSchemasFromHTML(htmlContent);
	const expectedTypes = REQUIRED_SCHEMAS[route] || [];
	const foundTypes = schemas.map((s) => s['@type']).filter(Boolean);

	let hasErrors = false;
	const results = {
		route,
		expectedSchemas: expectedTypes,
		foundSchemas: foundTypes,
		validationResults: []
	};

	// Check if all expected schema types are present
	expectedTypes.forEach((expectedType) => {
		if (!foundTypes.includes(expectedType)) {
			console.error(`❌ Missing required schema type "${expectedType}" on route: ${route}`);
			hasErrors = true;
		}
	});

	// Validate each found schema
	schemas.forEach((schema) => {
		const schemaType = schema['@type'];
		if (schemaType) {
			const validation = validateSchema(schema, schemaType);
			results.validationResults.push({
				type: schemaType,
				...validation
			});

			if (validation.errors.length > 0) {
				console.error(`❌ Schema validation errors for ${schemaType}:`, validation.errors);
				hasErrors = true;
			}

			if (validation.warnings.length > 0) {
				console.warn(`⚠️  Schema validation warnings for ${schemaType}:`, validation.warnings);
			}
		}
	});

	if (!hasErrors && foundTypes.length > 0) {
		console.log(`✅ Schema validation passed for route: ${route}`);
	}

	return { hasErrors, results };
}

/**
 * Main validation function
 */
function validateBuildSchemas() {
	console.log('🔍 Validating structured data schemas...\n');

	let hasGlobalErrors = false;
	const buildDir = join(process.cwd(), '.svelte-kit/output/client');

	// Test specific routes
	Object.keys(REQUIRED_SCHEMAS).forEach((route) => {
		try {
			// Map route to file path
			let filePath;
			if (route === '/') {
				filePath = join(buildDir, 'index.html');
			} else {
				filePath = join(buildDir, route.slice(1), 'index.html');
			}

			try {
				const htmlContent = readFileSync(filePath, 'utf-8');
				const { hasErrors } = validatePageSchemas(route, htmlContent);
				if (hasErrors) hasGlobalErrors = true;
			} catch {
				console.warn(`⚠️  Could not read file for route ${route}: ${filePath}`);
				console.warn('This is expected if the route requires authentication or dynamic rendering.');
			}
		} catch (error) {
			console.error(`❌ Error validating route ${route}:`, error.message);
			hasGlobalErrors = true;
		}
	});

	console.log('\n🏁 Schema validation complete');

	if (hasGlobalErrors) {
		console.error('❌ Schema validation failed with errors');
		process.exit(1);
	} else {
		console.log('✅ All schema validations passed');
	}
}

// Run validation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	validateBuildSchemas();
}

export { validateBuildSchemas, validatePageSchemas, validateSchema };
