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

	it('distinguishes checkout-blocking bundle states from entitled bundle access', () => {
		const subscription = readSource('src/routes/subscription/+page.svelte');

		expect(subscription).toContain('hasBundledBillingSubscription(data.subscriptions)');
		expect(subscription).toContain('hasNonterminalBundledBillingSubscription(data.subscriptions)');
		expect(subscription).toContain('Bundle subscription needs attention');
		expect(subscription).toContain(
			'This bundle is not currently granting Studio or Intelligence access.'
		);
	});

	it('keeps the everyday plan comparison separate from API and Enterprise access', () => {
		const pricing = readSource('src/lib/components/marketing/Pricing.svelte');
		const subscription = readSource('src/routes/subscription/+page.svelte');
		const api = readSource('src/routes/api/+page.svelte');

		expect(pricing).toContain('Simple self-serve plans');
		expect(pricing).toContain('See API plans');
		expect(pricing).not.toContain("handleSelectPlan('api')");
		expect(pricing).not.toContain("handleSelectPlan('enterprise')");
		expect(subscription).toContain('selfServeProductCards');
		expect(subscription).toContain('id="api-plans"');
		expect(subscription).toContain('A separate path for different users');
		expect(api).toContain('id="plans"');
		expect(api).toContain('$99/month');
	});
});
