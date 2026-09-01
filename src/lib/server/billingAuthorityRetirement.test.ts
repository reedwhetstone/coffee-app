import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function productionSources(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);

		if (entry.isDirectory()) return productionSources(path);
		if (entry.name.endsWith('.test.ts') || entry.name === 'database.types.ts') return [];
		return ['.ts', '.svelte'].includes(extname(entry.name)) ? [path] : [];
	});
}

describe('coffee-app billing and deletion authority retirement', () => {
	it('keeps the exact Parchment consumer artifact and no server Stripe dependency', () => {
		const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

		expect(packageJson.dependencies['@purveyors/sdk']).toBe('0.34.0');
		expect(packageJson.dependencies[['stri', 'pe'].join('')]).toBeUndefined();
	});

	it('keeps alternate billing and deletion authority out of production source', () => {
		const source = productionSources(resolve('src'))
			.map((path) => readFileSync(path, 'utf8'))
			.join('\n');
		const retiredTokens = [
			['/api/', 'stripe', '/'],
			['get', 'Stripe', '('],
			['request', 'Orchestrated'],
			['providerWork', 'Prepared'],
			['protocol', 'Version'],
			['auth.admin.', 'deleteUser'],
			['stripe_', 'customers'],
			['billing_', 'subscriptions'],
			['stripe_session_', 'processing'],
			['role_audit_', 'logs'],
			['account_deletion_', 'accepted']
		].map((parts) => parts.join(''));

		for (const token of retiredTokens) expect(source).not.toContain(token);
	});

	it('keeps retired credentials and rollout flags out of active configuration', () => {
		const configuration = [
			'.env.test.example',
			'.github/workflows/lint.yml',
			'scripts/bootstrap-worktree-env.sh',
			'scripts/check-env-contract.mjs'
		]
			.map((path) => readFileSync(resolve(path), 'utf8'))
			.join('\n');
		const retiredNames = [
			['STRIPE_', 'SECRET_KEY'],
			['STRIPE_', 'WEBHOOK_SECRET'],
			['PARCHMENT_ACCOUNT_DELETION_', 'PROVIDER_CREDENTIAL'],
			['PARCHMENT_CHECKOUT_ADMISSIONS_', 'ENABLED'],
			['PARCHMENT_CHECKOUT_ADMISSION_LEGACY_DRAIN_', 'ENABLED']
		].map((parts) => parts.join(''));

		for (const name of retiredNames) expect(configuration).not.toContain(name);
	});
});
