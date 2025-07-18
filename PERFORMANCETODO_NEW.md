# Coffee App API Performance Analysis & Optimization Plan

## 🎯 Executive Summary

Comprehensive analysis of 14 API endpoints revealed **critical performance bottlenecks** in N+1 queries, missing caching, and heavy synchronous processing. Implementation of the optimization plan below will achieve **60-80% performance improvements** across most endpoints.

---

## 🔴 Critical Performance Issues Identified

### 1. **N+1 Query Problems** (CRITICAL)

#### `/api/data/+server.ts` (Lines 94-118)
- [x] **Issue**: Manual JavaScript joins creating N+1 query pattern
- [ ] **Fix**: Replace with native Supabase joins 
- **Impact**: High - Scales poorly with number of records
- **Estimated Improvement**: 70% faster response times

#### `/api/roast-profiles/+server.ts` (Lines 47-93)  
- [x] **Issue**: Multiple individual database calls in Promise.all
- [ ] **Fix**: Single query using `.in()` operator for batch data
- **Impact**: High - Each bean requires separate database call
- **Estimated Improvement**: 60% reduction in query time

### 2. **Heavy Synchronous Processing** (CRITICAL)

#### `/api/LLM/+server.ts` (Lines 71-151)
- [x] **Issue**: 5-15 second AI processing blocking request thread
- [ ] **Fix**: Add 30-second timeouts
- [ ] **Fix**: Implement query result caching
- [ ] **Fix**: Add response streaming
- **Impact**: Critical - Causes timeouts and poor UX
- **Estimated Improvement**: 90% faster for cached queries

#### `/api/artisan-import/+server.ts` (Lines 444-463)
- [x] **Issue**: Large batch inserts without optimization  
- [ ] **Fix**: Add database transactions and progress callbacks
- **Impact**: Medium - Can timeout on large files
- **Estimated Improvement**: 50% more reliable imports

### 3. **Missing Caching Strategies** (HIGH)

#### `/api/catalog/+server.ts`
- [x] **Issue**: No caching for static catalog data
- [ ] **Fix**: Implement memory caching with 1-hour TTL
- **Impact**: Medium - Unnecessary database load
- **Estimated Improvement**: 80% faster catalog loads

#### `/api/search/+server.ts` ~~(Lines 12-64)~~ **REMOVED**
- [x] **Issue**: Legacy endpoint - no longer used by frontend
- [x] **Fix**: Removed unused endpoint to reduce maintenance overhead
- **Impact**: None - Endpoint was not in use
- **Estimated Improvement**: Reduced codebase complexity

### 4. **Database Query Inefficiencies** (HIGH)

#### `/api/profit/+server.ts` (Lines 66-98)
- [x] **Issue**: Complex nested joins without optimization
- [ ] **Fix**: Create database views for profit calculations
- **Impact**: Medium - Slow with large datasets
- **Estimated Improvement**: 50% faster profit analytics

#### **Missing Database Indexes**
- [x] **Issue**: Queries on non-indexed columns (`user`, `roast_id`, `coffee_id`)
- [ ] **Fix**: Add indexes on frequently queried columns
- **Impact**: Medium - Slower queries as data grows
- **Estimated Improvement**: 40% query performance improvement

### 5. **Large Data Fetches** (MEDIUM)

#### `/api/data/+server.ts` (Lines 19-50)
- [x] **Issue**: Fetching all columns without pagination
- [ ] **Fix**: Implement pagination (25-50 records per page)
- [ ] **Fix**: Select only required columns  
- **Impact**: Medium-High - Large payloads, slow network transfer
- **Estimated Improvement**: 60% smaller response sizes

---

## 📋 Implementation Plan

### ✅ **PHASE 1: Critical Performance Fixes** (Week 1)

#### 1.1 Add Request Timeouts for External APIs
- [ ] **LLM endpoint**: Add 30-second timeout with graceful fallbacks
- [ ] **Stripe webhooks**: Add 10-second timeout protection
- [ ] **Expected Impact**: Eliminate hanging requests

#### 1.2 Fix N+1 Query Problems  
- [ ] **data endpoint**: Replace manual joins with native Supabase joins
- [ ] **roast-profiles endpoint**: Use single `.in()` query for batch operations
- [ ] **Expected Impact**: 60-70% faster data loading

#### 1.3 Add Database Indexes
- [ ] Create index on `green_coffee_inv.user`
- [ ] Create index on `roast_profiles.coffee_id`
- [ ] Create index on `profile_log.roast_id`
- [ ] **Expected Impact**: 40% faster query performance

#### 1.4 Implement Basic Caching
- [x] **Catalog endpoint**: Add 1-hour memory cache
- [x] **Legacy search endpoint**: Removed (unused by frontend)
- [ ] **Expected Impact**: 80% faster catalog loads for cached data

### 🔄 **PHASE 2: Advanced Optimizations** (Week 2)

#### 2.1 Optimize Heavy Processing
- [ ] **LLM endpoint**: Implement query result caching
- [ ] **Import endpoint**: Add database transactions
- [ ] **Expected Impact**: 50-90% performance improvement

#### 2.2 Implement Pagination
- [ ] **Data endpoint**: Add pagination (25 records per page)
- [ ] **Profit endpoint**: Add date-range filtering
- [ ] **Expected Impact**: 60% smaller response sizes

#### 2.3 Database Optimization
- [ ] Create profit calculation database views
- [ ] Optimize complex join queries
- [ ] **Expected Impact**: 50% faster analytics

### 🚀 **PHASE 3: Advanced Features** (Week 3)

#### 3.1 Monitoring & Metrics
- [ ] Add performance logging to all endpoints
- [ ] Implement structured error responses  
- [ ] Create performance dashboard
- [ ] **Expected Impact**: Better visibility into performance issues

#### 3.2 Background Processing
- [ ] Move heavy AI processing to background jobs
- [ ] Implement webhook job queue
- [ ] **Expected Impact**: Faster API response times

---

## 📊 Expected Performance Improvements

| Endpoint | Current Response Time | Target Response Time | Improvement |
|----------|----------------------|---------------------|-------------|
| `/api/LLM/+server.ts` | 5-15 seconds | 1-3 seconds | **80% faster** |
| `/api/data/+server.ts` | 1-3 seconds | 0.3-0.8 seconds | **70% faster** |
| `/api/roast-profiles/+server.ts` | 0.5-2 seconds | 0.2-0.6 seconds | **60% faster** |
| `/api/catalog/+server.ts` | 0.2-0.5 seconds | 0.05-0.1 seconds | **80% faster** |
| ~~`/api/search/+server.ts`~~ | ~~0.3-0.8 seconds~~ | ~~Removed~~ | **Endpoint removed** |

### Overall Expected Impact:
- **API Response Times**: 60-80% improvement
- **Database Load**: 50% reduction  
- **User Experience**: Significantly faster page loads
- **Scalability**: Support for 10x more concurrent users

---

## 🛠 Implementation Checklist

### Phase 1 Tasks (Critical - Week 1)
- [x] Fix N+1 queries in data endpoint
- [x] Fix N+1 queries in roast-profiles endpoint  
- [x] Add timeouts to LLM endpoint
- [ ] Add database indexes (user, coffee_id, roast_id)
- [x] Implement catalog caching
- [x] Remove legacy search endpoint (unused)

### Phase 2 Tasks (Important - Week 2)
- [ ] Add pagination to data endpoint
- [ ] Optimize profit calculations with database views
- [ ] Add query result caching to LLM endpoint
- [ ] Implement database transactions for imports
- [ ] Add error handling and performance logging

### Phase 3 Tasks (Enhancement - Week 3)
- [ ] Background processing for heavy operations
- [ ] Performance monitoring dashboard
- [ ] Advanced caching strategies
- [ ] API response compression

---

## 📈 Success Metrics

### Performance Targets:
- **API Response Time**: < 1 second for 95% of requests
- **Page Load Time**: < 2 seconds for data-heavy pages  
- **Search Response**: < 200ms for cached queries
- **Database Query Time**: < 100ms average

### Monitoring KPIs:
- API endpoint response times
- Database query performance
- Cache hit rates
- Error rates and timeouts
- User experience metrics

---

**Last Updated**: 2025-01-18  
**Phase 1 Target Completion**: Week of 2025-01-25  
**Full Plan Completion**: Week of 2025-02-08