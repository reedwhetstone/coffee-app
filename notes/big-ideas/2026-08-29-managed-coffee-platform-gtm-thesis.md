# Managed Coffee Platform GTM Thesis

**Status:** Discussion draft, not canonical product or architecture direction  
**Owner:** Reed Whetstone  
**Captured:** 2026-08-29  
**Source:** Product-owner GTM exploration shared during coffee-app PR #550 review

> **Product naming addendum, 2026-08-29:** Cherry is now the customer-facing umbrella for
> Purveyors' coffee-native AI. The runtime roles are Cherry Green Agent, Cherry Roast Agent, and
> Cherry Synthesis Agent. This resolves the naming question below without accepting the broader,
> still-unresolved platform claims in this discussion draft.

## Throughline worth preserving

Purveyors should increasingly present one connected coffee system, not a shelf of unrelated products. The durable customer promise is that Purveyors owns difficult shared coffee context so customers can make decisions, run workflows, or build products without separately recreating supplier normalization, coffee semantics, provenance, market history, and domain-specific intelligence.

The clearest proposed adoption model is:

- **Work in Purveyors:** buyers and roasters use the public market, Parchment Intelligence, Cherry, and Mallard Studio directly.
- **Build with Purveyors:** developers, software platforms, hardware teams, and agents use the Parchment API, generated SDK, CLI, and future supported interfaces.

This is compatible with the current product vision when it strengthens the normalized green-coffee data moat and keeps Mallard as a first-party operating surface rather than redefining Purveyors as generic roast-management software.

## Current product truth that supports the thesis

- Purveyors already normalizes live offers across 40+ US specialty importers into shared catalog and market entities.
- The public catalog and Market Index expose the visible edge of that data asset.
- Parchment API provides a stable external `/v1/*` contract; the generated SDK and Purveyors CLI are separate supported consumers.
- Mallard Studio provides first-party inventory, roast, tasting, sales, and margin workflows.
- Cherry Runtime already selects entitlement-specific execution roles:
  - Intelligence unlocks the Cherry Green Agent with sourcing, catalog, portfolio, price-index, and market-signal context.
  - Studio unlocks the Cherry Roast Agent with catalog, inventory, roast, tasting, and sales context.
  - Studio + Intelligence unlocks the Cherry Synthesis Agent with both context families.
- Billing and entitlement authority already sits upstream in Parchment rather than in the presentation client.

These are enough to frame Purveyors as AI-forward and connected today. They are not enough to claim that Parchment already provides a complete operational control plane or that every Mallard capability has a supported public contract.

## Concepts under consideration

The source exploration proposes a longer-term hierarchy:

- **Purveyors:** company and overarching coffee data/operations story.
- **Parchment:** shared data, contract, identity, entitlement, and eventually operational infrastructure.
- **Mallard Studio:** first-party operator application using that infrastructure.
- **Parchment Intelligence:** reusable market and decision capability rather than an isolated application.
- **Cherry:** the coffee-native AI umbrella spanning runtime roles, specialist models, and evals.

This hierarchy is useful internally, but current brand guidance deliberately avoids “Parchment Platform” in public copy. Any naming change needs an explicit product and brand decision rather than implementation by repetition.

## High-value GTM implications

1. **Lead with removed complexity.** Explain the supplier normalization, coffee context, and decision work customers no longer need to recreate.
2. **Make Cherry concrete.** Show the questions Cherry can analyze and the evidence or roaster records Cherry Runtime can use. Do not market generic chat.
3. **Connect the product story.** Market data, Intelligence, Studio, API, CLI, and agent interfaces should look like ways to use one coffee system.
4. **Keep the entry wedge specific.** The normalized market graph is the strongest proven differentiator. Broader operations claims should expand from real customer demand.
5. **Protect ontology and trust.** Customer extensions must not fork canonical coffee meaning, and private operational data needs explicit governance before any network-effect claim.

## Unresolved decisions

- Which buyer and urgent job should lead the first infrastructure-oriented GTM motion?
- Which Mallard operations should become supported headless contracts, and in what order?
- How much customer-defined configuration is necessary before “platform” is a defensible category claim?
- Where does first-party Mallard scope stop so software and hardware partners can trust Parchment as infrastructure?
- What shared/private data boundaries and aggregation policies are required for a credible data-network story?
- Should Parchment remain a product-family name, become an infrastructure brand, or stay mostly behind Purveyors?

## Practical strategy test

For platform-oriented work, ask:

1. Does it strengthen the shared coffee domain model or provenance?
2. Can first-party and external consumers use the underlying capability through an appropriate supported contract?
3. Does it remove real coffee-specific infrastructure a customer would otherwise maintain?
4. Does it connect market data to a concrete sourcing or operational job?
5. Does it preserve tenant privacy and canonical semantics?
6. Is the claim true now, or is it explicitly labeled as direction?

The sharp long-term test remains: could a coffee software product, roasting-machine company, or agent use Parchment as its coffee backend without adopting Mallard, while Mallard itself relies on the same durable domain capabilities? That is a useful destination question, not a statement of current completion.
