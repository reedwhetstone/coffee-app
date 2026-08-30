import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(path), 'utf8');

describe('repricing presentation contract', () => {
	it('qualifies every trial promise because eligibility remains upstream-owned', () => {
		const pricing = readSource('src/lib/components/marketing/Pricing.svelte');
		const planCard = readSource('src/lib/components/marketing/SelfServePlanCard.svelte');
		const plans = readSource('src/lib/billing/selfServePlans.ts');
		const personas = readSource('src/lib/components/marketing/PersonaRouter.svelte');
		const subscription = readSource('src/routes/subscription/+page.svelte');

		expect(pricing).toContain(
			'Eligible accounts receive one five-day free trial on their first self-serve paid plan.'
		);
		expect(planCard).toContain('{plan.offer.trialDays}-day free trial if eligible');
		expect(pricing).not.toMatch(/Try (?:Intelligence|Studio|both) free/);
		expect(pricing).toContain("return 'Choose both';");
		expect(pricing).toContain("plan.id === 'studio' ? 'Studio' : 'Intelligence'");
		expect(plans).toContain('offer: BILLING_OFFERS.intelligenceMonthly');
		expect(plans).toContain('offer: BILLING_OFFERS.studioMonthly');
		expect(plans).toContain('offer: BILLING_OFFERS.bothMonthly');
		expect(personas).not.toMatch(/free trial/i);
		expect(subscription).toContain(
			'If eligible, your {selectedOffer.trialDays}-day free trial starts today.'
		);
		expect(subscription).toMatch(/Otherwise,\s+billing starts today\./);
	});

	it('guards both direct and intent-restored interactive checkout entry points', () => {
		const subscription = readSource('src/routes/subscription/+page.svelte');

		expect(subscription).toContain('hasInteractiveBillingSubscription(data.subscriptions)');
		expect(subscription).toContain('const hasInteractiveAccess = $derived(');
		expect(subscription).toContain('if (isProductCheckoutBlocked(product)) return;');
		expect(subscription).toContain('disabled={isSignedIn && isProductCheckoutBlocked(product)}');
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

	it('presents self-serve, API, and Enterprise options in customer language', () => {
		const pricing = readSource('src/lib/components/marketing/Pricing.svelte');
		const planCard = readSource('src/lib/components/marketing/SelfServePlanCard.svelte');
		const plans = readSource('src/lib/billing/selfServePlans.ts');
		const details = readSource('src/lib/components/marketing/SubscriptionPlanDetails.svelte');
		const productDetail = readSource(
			'src/lib/components/marketing/SubscriptionProductDetail.svelte'
		);
		const subscription = readSource('src/routes/subscription/+page.svelte');
		const api = readSource('src/routes/api/+page.svelte');

		expect(pricing).toContain('Simple self-serve plans');
		expect(pricing).toContain('<SelfServePlanCard');
		expect(subscription).toContain('<SelfServePlanCard');
		expect(pricing).toContain('SELF_SERVE_PLANS');
		expect(subscription).toContain('SELF_SERVE_PLANS');
		expect(planCard).toContain('plan.features');
		expect(planCard).not.toContain('plan.iconPath');
		expect(planCard).not.toContain('absolute inset-x-0 top-0 h-1');
		expect(planCard).not.toContain('bg-intelligence');
		expect(plans).not.toContain('iconPath:');
		expect(pricing).toContain('See API plans');
		expect(pricing).not.toContain("handleSelectPlan('api')");
		expect(pricing).not.toContain("handleSelectPlan('enterprise')");
		expect(plans).toContain("learnMoreHref: '/subscription#intelligence-details'");
		expect(plans).toContain("learnMoreHref: '/subscription#studio-details'");
		expect(plans).toContain("learnMoreHref: '/subscription#both-details'");
		expect(subscription).toContain('selfServeProductCardsById');
		expect(subscription).toContain('<SubscriptionPlanDetails />');
		expect(subscription).toContain('id="api-plans"');
		expect(subscription).toContain('Build with Purveyors or tailor it to your business');
		expect(subscription).not.toMatch(
			/stay separate below|stay out of the everyday product comparison/
		);
		expect(details).toContain('anchorId="intelligence-details"');
		expect(details).toContain('anchorId="studio-details"');
		expect(details).toContain('id="both-details"');
		expect(productDetail).toContain('id={anchorId}');
		expect(details).toContain('Every self-serve subscription includes Cherry');
		expect(details).toContain('The Cherry Roast Agent is included with Studio.');
		expect(details).toContain('The Cherry Green Agent is included with Intelligence.');
		expect(details.match(/<SubscriptionProductDetail/g)?.length).toBe(2);
		expect(details).toContain('One AI system. The right context for the work.');
		expect(plans.match(/Cherry/g)?.length).toBeGreaterThanOrEqual(3);
		expect(api).toContain('id="plans"');
		expect(api).toContain('$99/month');
	});

	it('hands homepage plan choices directly to the subscription checkout intent', () => {
		const pricing = readSource('src/lib/components/marketing/Pricing.svelte');
		const subscription = readSource('src/routes/subscription/+page.svelte');

		expect(pricing).toContain('goto(`/subscription?plan=${plan.offer.offerId}&intent=checkout`)');
		expect(subscription).toContain(
			"const hasCheckoutIntent = $derived(page.url.searchParams.get('intent') === 'checkout');"
		);
		expect(subscription).toContain('if (isSignedIn && hasCheckoutIntent && intendedOfferId) {');
		expect(subscription).toContain('openCheckoutByOfferId(intendedOfferId);');
	});

	it('frames the homepage as a concrete AI-forward coffee system', () => {
		const hero = readSource('src/lib/components/marketing/Hero.svelte');
		const features = readSource('src/lib/components/marketing/Features.svelte');
		const personas = readSource('src/lib/components/marketing/PersonaRouter.svelte');

		expect(hero).toContain('Coffee intelligence you can ask, act on, and build with.');
		expect(hero).toContain('Cherry');
		expect(hero).toContain('Cherry Runtime works from the coffee data, tools, and records');
		expect(features).toContain('Cherry connects context to a decision.');
		expect(features).toContain('Work in Purveyors or build with it.');
		expect(personas).toContain('One coffee data layer, built for decisions and systems.');
	});
});
