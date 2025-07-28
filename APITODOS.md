# API Product Implementation Plan

This document outlines the complete implementation plan for the full API product offering, including Bearer token authentication, API dashboard, Stripe integration, and usage management.

## Overview

Transform the current session-based catalog API into a full commercial API product with:

- Bearer token authentication system
- Self-service API dashboard
- Multiple subscription tiers with Stripe integration
- Usage tracking and rate limiting
- Comprehensive documentation and analytics

---

## Phase 1: Database & Auth Infrastructure

### 1.1 Database Schema Extensions

#### New Table: `api_keys`

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_roles(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  permissions JSONB DEFAULT '{}',
  UNIQUE(key_hash)
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
```

#### New Table: `api_usage`

```sql
CREATE TABLE api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response_time_ms INTEGER,
  status_code INTEGER,
  user_agent TEXT,
  ip_address INET
);

CREATE INDEX idx_api_usage_key_id ON api_usage(api_key_id);
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);
```

#### Update User Roles

```sql
-- Add 'api' role support (update existing enum or modify role checking logic)
-- The 'api' role should have viewer-level access + API-specific permissions
-- API users can access home catalog but NOT member features like /roast, /beans, /profit
-- Members get catalog data via UI only - they do NOT have API endpoint access
```

**Reference Files:**

- `src/lib/types/database.types.ts` - Add new table types
- `src/lib/types/auth.types.ts` - Add 'api' to UserRole type and update hierarchy

### 1.2 Bearer Token Authentication System

#### Create `src/lib/server/apiAuth.ts`

```typescript
// New file with the following functions:
// - generateApiKey(): string - Generate secure API keys with prefixes
// - hashApiKey(key: string): string - Hash keys for secure storage
// - validateApiKey(key: string): Promise<{valid: boolean, userId?: string}>
// - logApiUsage(apiKeyId: string, endpoint: string, statusCode: number, responseTime: number)
// - checkRateLimit(apiKeyId: string): Promise<{allowed: boolean, resetTime?: number}>
```

**Implementation Requirements:**

- Use crypto.randomBytes() for secure key generation
- API key format: `pk_live_` or `pk_test_` prefix + 32 random characters
- Use bcrypt or similar for hashing
- Implement sliding window rate limiting

**Reference Files:**

- Study: `src/lib/server/auth.ts` - Current auth patterns
- Study: `src/hooks.server.ts` - How auth middleware works
- Update: `src/routes/api/catalog-api/+server.ts` - Replace session auth with Bearer tokens

---

## Phase 2: API Management Dashboard

### 2.1 New Routes Structure

#### Create `/api-dashboard` route group

```
src/routes/(authenticated)/api-dashboard/
├── +layout.svelte (shared dashboard layout)
├── +layout.server.ts (require 'api' role)
├── +page.svelte (main dashboard overview)
├── +page.server.ts (load API keys & usage summary)
├── keys/
│   ├── +page.svelte (API key management interface)
│   ├── +page.server.ts (load existing keys)
│   └── generate/
│       └── +server.ts (POST endpoint to generate new keys)
├── usage/
│   ├── +page.svelte (usage analytics with charts)
│   └── +page.server.ts (load usage data for charts)
└── docs/
    └── +page.svelte (move from /api/docs, personalize with user's API key)
```

**Reference Files:**

- Study: `src/routes/(authenticated)/beans/` - Protected route patterns
- Study: `src/routes/(authenticated)/roast/` - Chart implementation with D3.js
- Move: `src/routes/api/docs/+page.svelte` to dashboard
- Study: `src/hooks.server.ts` - Role-based protection implementation

### 2.2 Dashboard Components

#### Create `src/lib/components/api/`

```
src/lib/components/api/
├── ApiKeyCard.svelte (individual API key display/management)
├── ApiKeyGenerator.svelte (form to create new keys)
├── UsageChart.svelte (D3.js charts for API usage)
├── RateLimitStatus.svelte (current rate limit status)
└── ApiTester.svelte (interactive API testing interface)
```

**Component Requirements:**

- API keys should be masked after creation (show only first/last 4 chars)
- Copy-to-clipboard functionality for keys
- Real-time usage charts using existing D3.js patterns
- Integration with existing design system components

**Reference Files:**

- Study: `src/lib/components/` - Existing component patterns
- Study: `src/routes/(authenticated)/roast/` - D3.js chart implementations
- Study: `src/routes/subscription/` - Subscription management UI patterns

---

## Phase 3: Stripe Integration for API Product

### 3.1 New Stripe Product Configuration

#### Stripe Dashboard Setup (Manual)

1. Create new Product: "API Access"
2. Create Price IDs for three tiers:
   - Developer: $19/month (10,000 requests)
   - Growth: $49/month (100,000 requests)
   - Enterprise: $149/month (1,000,000 requests)

#### Update subscription data structure

```typescript
// Add to existing subscription types
interface ApiSubscription {
	tier: 'developer' | 'growth' | 'enterprise';
	monthlyLimit: number;
	currentUsage: number;
	resetDate: Date;
}
```

**Reference Files:**

- Study: `src/lib/services/stripe.ts` - Current Stripe integration patterns
- Update: `src/routes/subscription/+page.svelte` - Add API plan selection
- Study: `src/routes/api/stripe/webhook/+server.ts` - Webhook event handling

### 3.2 Subscription Flow Updates

#### Update `/subscription` page

- Add tab/section for API subscriptions
- Allow users to have both roaster AND API subscriptions
- Show current API usage alongside roaster features

#### Create API-specific webhook handlers

```typescript
// Add to existing webhook handler
// Handle events: customer.subscription.created, updated, deleted for API products
// Auto-assign 'api' role on successful API subscription
// Handle plan upgrades/downgrades
// Update API rate limits based on new subscription tier
```

**Reference Files:**

- Update: `src/routes/subscription/+page.svelte` - Add API product UI
- Update: `src/lib/services/stripe-webhook.ts` - Add API subscription handling
- Study: `src/routes/api/stripe/` - All existing Stripe endpoints

### 3.3 Role Management Updates

#### Update authentication system for multiple roles

```typescript
// Users can have multiple roles: ['member', 'api']
// Update role checking logic to handle arrays instead of single role
// API dashboard requires 'api' role, roasting features require 'member' role
```

**Reference Files:**

- Update: `src/lib/types/auth.types.ts` - Support multiple roles
- Update: `src/lib/server/auth.ts` - Role checking functions
- Update: `src/hooks.server.ts` - Middleware role validation

---

## Phase 4: Enhanced API Features

### 4.1 Rate Limiting & Monitoring

#### Create `src/lib/server/rateLimit.ts`

```typescript
// Implement rate limiting middleware
// Support different limits per subscription tier
// Return proper HTTP 429 responses with retry headers
// Option 1: Redis-based (production)
// Option 2: In-memory with cleanup (development/small scale)
```

#### Update API endpoints with rate limiting

- Add rate limit middleware to all API endpoints
- Include rate limit headers in responses
- Log rate limit violations

**Reference Files:**

- Study: `src/routes/api/catalog-api/+server.ts` - Current API structure
- Create: Rate limiting middleware
- Update: All API endpoints with rate limiting

### 4.2 API Versioning Support

#### Add versioning to existing API

```typescript
// Update catalog-api to support versions
// Add version headers and URL versioning
// Maintain backward compatibility
// Version-specific documentation
```

**Reference Files:**

- Update: `src/routes/api/catalog-api/+server.ts` - Add versioning
- Update: API documentation to show version info

### 4.3 Additional API Endpoints (Future Phase)

```
/api/v1/coffee/{id} - Individual coffee details
/api/v1/search - Advanced search with filters
/api/v1/suppliers - Supplier information
/api/v1/webhooks - Webhook management for customers
```

---

## Phase 5: Security & Production Readiness

### 5.1 Security Enhancements

#### API Security Middleware

```typescript
// Create src/lib/server/apiSecurity.ts
// - API key prefix validation (prevent accidental commits to public repos)
// - Request signing for sensitive operations (optional)
// - IP whitelisting for enterprise customers
// - Comprehensive audit logging
// - Rate limit bypass detection
```

#### Security Headers and Validation

- Add security headers to API responses
- Input validation and sanitization
- SQL injection prevention (already handled by Supabase)
- XSS prevention in API responses

**Reference Files:**

- Create: `src/lib/server/apiSecurity.ts`
- Update: All API endpoints with security middleware

### 5.2 Monitoring & Alerting

#### Create monitoring infrastructure

```typescript
// Create src/lib/services/apiMonitoring.ts
// - Usage threshold alerts (email/webhook)
// - API health monitoring
// - Error rate tracking
// - Automated fraud detection
// - Performance monitoring
```

**Reference Files:**

- Create: Monitoring service
- Integrate: With existing logging patterns

---

## Implementation Timeline & Dependencies

### Week 1: Foundation

**Tasks:**

1. Create database tables (`api_keys`, `api_usage`)
2. Update type definitions
3. Create basic API authentication system
4. Update existing catalog-api endpoint

**Dependencies:**

- Database migration capabilities
- Understanding of current auth system

**Key Files:**

- New: `src/lib/server/apiAuth.ts`
- Update: `src/lib/types/auth.types.ts`
- Update: `src/lib/types/database.types.ts`
- Update: `src/routes/api/catalog-api/+server.ts`

### Week 2: Dashboard Foundation

**Tasks:**

1. Create protected API dashboard routes
2. Build basic API key management interface
3. Implement key generation endpoint

**Dependencies:**

- Week 1 completion
- Understanding of current dashboard patterns

**Key Files:**

- New: `src/routes/(authenticated)/api-dashboard/` (entire directory)
- New: `src/lib/components/api/` (component library)

### Week 3: Stripe Integration

**Tasks:**

1. Create API products in Stripe
2. Update subscription flow for API plans
3. Implement webhook handling for API subscriptions

**Dependencies:**

- Existing Stripe integration understanding
- Week 1-2 completion

**Key Files:**

- Update: `src/routes/subscription/+page.svelte`
- Update: `src/lib/services/stripe-webhook.ts`
- New: API-specific Stripe endpoints

### Week 4: Usage & Analytics

**Tasks:**

1. Implement usage tracking
2. Build analytics dashboard with charts
3. Add rate limiting system

**Dependencies:**

- D3.js chart system understanding
- Week 1-3 completion

**Key Files:**

- New: `src/lib/server/rateLimit.ts`
- New: Usage analytics components
- Update: All API endpoints with usage tracking

### Week 5: Security & Polish

**Tasks:**

1. Add comprehensive security measures
2. Implement monitoring and alerting
3. Enhanced documentation and testing interface

**Dependencies:**

- All previous weeks
- Security best practices review

**Key Files:**

- New: `src/lib/server/apiSecurity.ts`
- New: `src/lib/services/apiMonitoring.ts`
- Polish: All dashboard components

### Week 6: Testing & Launch Prep

**Tasks:**

1. End-to-end testing
2. Documentation finalization
3. Launch preparation and migration planning

---

## Critical Reference Files Summary

### Current System Files to Study:

1. **Authentication System:**

   - `src/hooks.server.ts` - Middleware and role protection
   - `src/lib/server/auth.ts` - Current auth functions
   - `src/lib/types/auth.types.ts` - Role definitions

2. **Database & Types:**

   - `src/lib/types/database.types.ts` - Database type definitions
   - `src/lib/supabase.ts` - Database client setup

3. **Existing API:**

   - `src/routes/api/catalog-api/+server.ts` - Current API implementation
   - `src/routes/api/docs/+page.svelte` - Current documentation

4. **Stripe Integration:**

   - `src/lib/services/stripe.ts` - Stripe service functions
   - `src/lib/services/stripe-webhook.ts` - Webhook handling
   - `src/routes/subscription/` - Current subscription UI
   - `src/routes/api/stripe/` - All Stripe endpoints

5. **Dashboard Patterns:**
   - `src/routes/(authenticated)/beans/` - Protected route example
   - `src/routes/(authenticated)/roast/` - D3.js chart implementation
   - `src/lib/components/` - Existing component patterns

### Files to Create:

1. **New API Infrastructure:**

   - `src/lib/server/apiAuth.ts`
   - `src/lib/server/rateLimit.ts`
   - `src/lib/server/apiSecurity.ts`
   - `src/lib/services/apiMonitoring.ts`

2. **Dashboard Routes:**

   - Complete `src/routes/(authenticated)/api-dashboard/` directory structure

3. **API Components:**
   - Complete `src/lib/components/api/` component library

### Files to Update:

1. **Type Definitions:**

   - `src/lib/types/auth.types.ts` - Add 'api' role
   - `src/lib/types/database.types.ts` - Add new tables

2. **Authentication System:**

   - `src/hooks.server.ts` - Support multiple roles
   - `src/lib/server/auth.ts` - Enhanced role checking

3. **Existing API:**

   - `src/routes/api/catalog-api/+server.ts` - Bearer token auth

4. **Subscription System:**
   - `src/routes/subscription/+page.svelte` - Add API plans
   - `src/lib/services/stripe-webhook.ts` - API subscription handling

---

## Success Metrics

### Technical Metrics:

- API response times < 200ms average
- 99.9% API uptime
- Zero security vulnerabilities
- Comprehensive test coverage

### Business Metrics:

- API subscription conversion rate
- Monthly recurring revenue from API
- Customer retention and usage growth
- Support ticket reduction through self-service

### User Experience Metrics:

- Dashboard load times < 2 seconds
- API key generation success rate
- Documentation clarity and completeness
- Time-to-first-API-call for new users

This implementation plan provides a comprehensive roadmap for transforming the current catalog API into a full commercial API product with all the necessary infrastructure, security, and user experience features.
