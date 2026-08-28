import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(path), 'utf8');

describe('repricing presentation contract', () => {
	it('qualifies every trial promise because eligibility remains upstream-owned', () => {
		const pricing = readSource('src/lib/components/marketing/Pricing.svelte');
		const personas = readSource('src/lib/components/marketing/PersonaRouter.svelte');
		const subscription = readSource('src/routes/subscription/+page.svelte');

		expect(pricing).toContain(
			'Eligible accounts receive one five-day free trial on their first self-serve paid plan.'
		);
		expect(pricing.match(/if eligible/g)).toHaveLength(3);
		expect(pricing).not.toMatch(/Try (?:Intelligence|Studio|both) free/);
		expect(pricing).toContain('Choose Intelligence');
		expect(pricing).toContain('Choose Studio');
		expect(pricing).toContain('Choose both');
		expect(personas.match(/if eligible/g)).toHaveLength(3);
		expect(subscription).toContain(
			'If eligible, your {selectedOffer.trialDays}-day free trial starts today.'
		);
		expect(subscription).toMatch(/Otherwise,\s+billing starts today\./);
		expect(subscription).toContain('{option.trialDays}-day free trial if eligible');
	});

	it('guards both direct and intent-restored interactive checkout entry points', () => {
		const subscription = readSource('src/routes/subscription/+page.svelte');

		expect(subscription).toContain('hasInteractiveBillingSubscription(data.subscriptions)');
		expect(subscription).toContain('const hasInteractiveAccess = $derived(');
		expect(subscription).toContain('if (isProductCheckoutBlocked(product)) return;');
		expect(subscription).toContain('disabled={isProductCheckoutBlocked(product)}');
		expect(subscription).toContain("return 'Plan change unavailable';");
	});
});
