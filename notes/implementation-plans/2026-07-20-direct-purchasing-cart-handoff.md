# Direct Purchasing: Supplier Cart Handoff + Attribution Infrastructure

**Status:** Proposed
**Date:** 2026-07-20
**Scope:** coffee-scraper (variant persistence) + coffee-app (cart + handoff UX) + parchment-api (cart contract, later phase)
**Origin:** Reed's direct-purchasing question, #purveyors 2026-07-20; research summary below

## Problem

Purveyors recommends and compares green coffee but hands the buyer nothing more than a product deep link. The purchase happens on the supplier's site with zero attribution, so suppliers never see Purveyors in their revenue data and we have no evidence base for affiliate or rev-share conversations.

## Research findings (2026-07-20)

1. **Shopify cart permalinks need zero merchant cooperation.** Every Shopify store supports `https://{store}/cart/{variant_id}:{qty},{variant_id}:{qty}`. Multiple line items chain with commas. `?discount=CODE` auto-applies a discount code. Arbitrary query params (UTMs) can be appended. There is also a `/cart/add?id={variant_id}&quantity={n}` endpoint for single adds. Docs: help.shopify.com cart-permalink, shopify.dev create-cart-permalinks.
2. **Attribution is native.** Shopify order attribution captures UTM referral source out of the box; merchants see "sales by referral source" in their own analytics with no app install. `utm_source=purveyors&utm_medium=marketplace` makes Purveyors-attributed revenue visible in supplier dashboards before we ever ask for anything.
3. **Discount codes are the strongest attribution + partnership primitive.** A supplier-created `PURVEYORS` code auto-applied via permalink gives per-order tracking that survives cookie loss and gives buyers a reason to route through us. Indie-merchant affiliate tooling (Shopify Collabs, Refersion, UpPromote) all rides on codes + UTMs. Green coffee importers are not on Amazon-style affiliate networks; the realistic revenue path is direct rev-share deals backed by our own attribution data.
4. **Storefront API (`cartCreate` → `checkoutUrl`) requires a merchant-issued access token.** That is a cooperating-supplier feature, not a starting point.
5. **Universal-checkout aggregators (Rye, Violet) exist** for multi-merchant carts and agentic checkout, but they take a cut and add a dependency. Overkill while the majority of the catalog is Shopify with a free native mechanism.
6. **WooCommerce equivalent:** `?add-to-cart={product_id}&quantity={n}` works for single items (multi-item requires plugin support). Custom-platform suppliers (Covoya, Genuine Origin, etc.) fall back to deep links with UTMs.

## Current gap on our side

The generic Shopify scraper (`coffee-scraper/scrape/sources/generic/shopify-scraper.ts`) already parses `ShopifyVariant.id` but discards it. `coffee_catalog.price_tiers` stores only `{min_lbs, price}`. Without persisted variant IDs we cannot construct cart permalinks.

## Phased plan

### Phase 1: attribution + handoff (no merchant cooperation required)

**PR 1 (coffee-scraper): persist variant identity.**
- Extend price tier extraction so each tier carries `variant_id` (and `platform: shopify|woocommerce|custom` at the row level, derived from scraper type) into `coffee_catalog`.
- Additive jsonb change; ship compile-safe defaults first per the schema rollout rule. Backfill occurs naturally on next scrape cycle.

**PR 2 (coffee-app): UTM everything.**
- Append `utm_source=purveyors&utm_medium=marketplace&utm_campaign=catalog` to every outbound supplier link (catalog cards, detail pages, chat/GenUI links). Immediate evidence accrual, independent of cart work.

**PR 3 (coffee-app): cart + supplier handoff.**
- Client-side cart grouping items by supplier (carts are per-store; a mixed cart becomes one handoff per supplier).
- "Checkout at {supplier}" builds the cart permalink from persisted variant IDs + quantities + UTMs for Shopify suppliers; `add-to-cart` URL for WooCommerce single items; deep link fallback for custom platforms.
- Log every handoff event (supplier, items, estimated value) so we hold our own side of the attribution ledger.

### Phase 2: monetization conversations (after ~4-8 weeks of data)

- Rank suppliers by attributed click/handoff volume from our event log.
- Approach top 3-5 with the data; propose a `PURVEYORS` discount code (auto-applied in our permalinks) plus a rev-share or affiliate arrangement tracked by code usage.
- Where a supplier runs Refersion/UpPromote/Collabs, join their existing program instead of inventing one.

### Phase 3: deep integration (cooperating suppliers only)

- Storefront API tokens from willing suppliers → true programmatic carts (`cartCreate`, live inventory/price validation, `checkoutUrl` handoff).
- Parchment cart contract so CLI/chat/GenUI surfaces share the same cart primitives as the web app.
- Reassess Rye/Violet only if agentic checkout across non-cooperating merchants becomes a product requirement.

## Success criteria

- Phase 1: >95% of Shopify catalog rows carry variant IDs; handoff events logged; UTMs on all outbound links.
- Phase 2: at least one supplier discount-code agreement signed.
- Risks: permalink behavior varies slightly across themes (test top suppliers first); variant IDs go stale between scrapes (revalidate freshness at handoff time, fall back to product deep link).
