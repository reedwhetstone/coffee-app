# Parchment API Tier Model

This document outlines the shipped public tier structure and access logic for **Parchment API** on **purveyors.io**. It should be treated as a reference for implementation and audits, not as speculative pricing ideation.

---

## Overview of tiers

Parchment API currently markets **three tiers**:

| Public Tier | Internal Key     | Monthly Price | API Call Limit | Target User                                      |
| ----------- | ---------------- | ------------- | -------------- | ------------------------------------------------ |
| Green       | `api_viewer`     | $0            | 200            | Evaluation, prototypes, lightweight integrations |
| Origin      | `api_member`     | $99           | 10,000         | Production integrations and recurring sync jobs  |
| Enterprise  | `api_enterprise` | Contact sales | Unlimited      | B2B platforms, internal tools, custom support    |

---

## 🔐 Tier Permissions / Feature Flags

### 1. Green

- **Internal key**: `api_viewer`
- **Rate limit**: `200 calls/month`
- **Positioning**: Free evaluation tier for trying the catalog and validating integrations
- **Upgrade CTA**: Present if user hits 75% of usage quota

---

### 2. Origin

- **Internal key**: `api_member`
- **Rate limit**: `10,000 calls/month`
- **Positioning**: Self-serve paid tier for production API usage, higher-volume sync jobs, and ongoing integrations
- **Billing**: $99/month

---

### 3. Enterprise

- **Internal key**: `api_enterprise`
- **Rate limit**: Unlimited or contract-scoped
- **Positioning**: Contact-sales tier for custom commercial terms, volume, and support

---

## 🧱 Integration Notes

### API Access Control

- Gate API access by plan ID.
- Log and rate-limit usage at user level

### Billing Infrastructure

Use Stripe and internal entitlements for:

- Self-serve paid Origin checkout
- Upgrade flows from Green to Origin
- Enterprise contact-sales routing and downstream entitlement assignment
- Webhook handling to update the account tier state on plan change

---

## 🖥️ Frontend Implementation

### Landing page structure

| Section                   | Notes                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Hero**                  | Position Parchment API as normalized green coffee data for apps, agents, and internal tools |
| **Plan Comparison Table** | Show Green, Origin, and Enterprise explicitly                                               |
| **Free CTA**              | Start with Green                                                                            |
| **Upgrade Prompts**       | Trigger at 75%+ of API usage quota                                                          |
| **Enterprise CTA**        | Route to contact sales                                                                      |

---

## Canonical naming

| Public tier | Internal ID      |
| ----------- | ---------------- |
| Green       | `api_viewer`     |
| Origin      | `api_member`     |
| Enterprise  | `api_enterprise` |

Do not use Explorer, Roaster+, Integrate, or other alternate marketed names in current product copy.
