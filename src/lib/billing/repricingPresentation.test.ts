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
		expect(pricing).toContain("return 'Choose both products';");
		expect(pricing).toContain("return `${isSignedIn ? 'Start' : 'Choose'} ${plan.name}`;");
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
			'This bundle is not currently granting Mallard Studio or Parchment Intelligence access.'
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
		expect(pricing).not.toContain('See API plans');
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
		expect(details).toContain('Every self-serve subscription includes Cherry AI');
		expect(details).toContain('The Cherry Roast Agent is included with Mallard Studio.');
		expect(details).toContain('The Cherry Green Agent is included with Parchment Intelligence.');
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
		const personas = readSource('src/lib/components/marketing/PersonaRouter.svelte');
		const homepage = readSource('src/routes/(home)/+page.svelte');

		expect(hero).toContain('The intelligence layer for coffee.');
		expect(hero).toMatch(
			/Purveyors connects live green coffee data, coffee-native intelligence, and roastery\s+operations in one trusted system\. See the market, understand the evidence, and turn insight\s+into action\./
		);
		expect(hero).toContain('Cherry AI');
		expect(hero).toContain('Parchment Intelligence provides live offers and pricing insight');
		expect(hero).toMatch(/Mallard Studio structures\s+inventory, roasts, and sales/);
		expect(hero).toMatch(
			/Cherry AI works across both - reasoning, acting, and moving\s+work forward\./
		);
		expect(hero).not.toContain('Parchment supplies current offers');
		expect(hero).not.toContain('Ask Parchment');
		expect(hero).toContain('prefers-reduced-motion: reduce');
		expect(personas).toContain('One connected coffee system');
		expect(personas).toContain('From market signal to real work.');
		expect(personas).toContain('Cherry Green Agent');
		expect(personas).toContain('Cherry Roast Agent');
		expect(personas).toContain('product-grid mt-10 grid');
		expect(personas).toContain('product-path group flex flex-col');
		expect(personas).toContain('grid-template-rows: repeat(5, auto);');
		expect(personas).toContain('grid-row: span 5;');
		expect(personas).toContain('grid-template-rows: subgrid;');
		expect(homepage).toContain('Today’s coffee catalog, already normalized.');
		expect(homepage).toMatch(
			/Source-linked offers from specialty importers across retail and wholesale quantities,\s+ready to compare by origin, process, price, and evidence\./
		);
		expect(homepage).toContain('data.data.slice(0, 3)');
		expect(homepage).toContain('<CoffeeCard {coffee} {parseTastingNotes} compact />');
		expect(homepage).not.toContain('Features');
		expect(homepage).not.toContain('LazyLoad');
	});
});
