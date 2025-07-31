# 📦 Green Coffee API — Pricing Tier Integration Instructions

This document outlines the pricing structure and access logic for the Green Coffee API on **purveyors.io**. It is designed for implementation into the app’s frontend, backend authentication/limits, and billing workflow.

---

## 🎯 Overview of Pricing Tiers

We offer **three tiers** of service:

| Tier Name | Plan ID          | Monthly Price    | API Call Limit | Target User           |
| --------- | ---------------- | ---------------- | -------------- | --------------------- |
| Explorer  | `api_viewer`     | $0               | 200            | Hobbyists, developers |
| Roaster+  | `api_member`     | $99              | 10,000         | Active roasters, pros |
| Integrate | `api_enterprise` | Custom ($1,500+) | Unlimited      | B2B platforms, ERPs   |

---

## 🔐 Tier Permissions / Feature Flags

### 1. 🟢 Explorer (Free Tier)

- **Plan ID**: `api_viewer`
- **Rate Limit**: `200 calls/month`
- **Features**:
  - ✅ Access to live inventory feed cached daily
  - ✅ Basic filters (origin, price, process)
  - ❌ Advanced cupping filters
  - ❌ CSV/JSON export
  - ❌ Alerts or notifications
  - ❌ Support (community only)
- **Upgrade CTA**: Present if user hits 75% of usage quota

---

### 2. 🟡 Roaster+ (Pro Tier)

- **Plan ID**: `api_member`
- **Rate Limit**: `10,000 calls/month`
- **Features**:
  - ✅ Full real-time supplier inventory
  - ✅ All filter options: cupping score, process, altitude, price, etc.
  - ✅ Alerts: e.g., price drops, origin availability
  - ✅ CSV and JSON data export
  - ✅ Monthly trend reports - origin, supplier, price, etc
  - ✅ Email support
- **Billing**: $99/month or $999/year (if annual prepay selected)
- **Overage Logic**:
  - Soft cap with warning at 80% usage
  - Option to purchase extra calls: `$10 per 1,000 calls`

---

### 3. 🔵 Integrate (Enterprise Tier)

- **Plan ID**: `api_enterprise`
- **Rate Limit**: Unlimited (or custom with SLA)
- **Features**:
  - ✅ All Pro features
  - ✅ White-labeled or embedded endpoints
  - ✅ Webhook support (push updates on lot changes)
  - ✅ Live trend data & custom reporting
  - ✅ Multi-user access (roles, team API keys)
  - ✅ Dedicated onboarding + account manager
  - ✅ SLAs and performance guarantees
  - ✅ Priority support (Slack/email)
- **Billing**:
  - Custom contracts starting at $1,500/month
  - Requires sales contact flow or admin approval
- **Optional Add-ons**:
  - Custom alerts or dashboards
  - Private vendor integrations
  - Forecasting or analytics modules

---

## 🧱 Integration Notes

### API Access Control

- Gate API access by plan ID.
- Log and rate-limit usage at user level

### Billing Infrastructure

Use Stripe for:

- Tier subscriptions - `api_viewer`, `api_member`, `api_enterprise`
- Upgrade/downgrade flows
- Webhook to update user’s tier in DB on plan change

---

## 🖥️ Frontend Implementation

### Landing Page Structure

| Section                   | Notes                                             |
| ------------------------- | ------------------------------------------------- |
| **Hero**                  | “Explore the world’s green coffee in one API”     |
| **Plan Comparison Table** | Dynamically rendered from pricing metadata        |
| **Free CTA**              | “Get Started Free – 200 API calls/month”          |
| **Upgrade Prompts**       | Trigger at 75%, 100%, and 110% of API usage quota |
| **Enterprise CTA**        | “Need more? Contact us for an integration demo.”  |

---

## ✨ Optional Naming (Marketing-Ready)

| Plan Name | Internal ID      | Display Name |
| --------- | ---------------- | ------------ |
| Explorer  | `api_viewer`     | “Hobbiest”   |
| Roaster+  | `api_member`     | “Member”     |
| Integrate | `api_enterprise` | “Enterprise” |
