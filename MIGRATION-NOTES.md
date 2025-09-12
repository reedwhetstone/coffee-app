# API Migration Notes

## Legacy `/api/roast` to Modern `/api/roast-profiles` Migration

### Completed Changes

- ✅ All GET requests updated to use `/api/roast-profiles`
- ✅ All POST requests updated to use `/api/roast-profiles`
- ✅ Navbar preload updated to use `/api/roast-profiles`
- ✅ Legacy `/api/roast/+server.ts` file removed
- ✅ Fixed `created_at` schema error by removing non-existent column reference
- ✅ Fixed undefined array error in RoastProfileForm.svelte

### Missing Functionality (Requires Future Implementation)

#### 1. Share Token Support

**Status**: ❌ Missing from `/api/roast-profiles` endpoint

**Legacy Implementation** (was in `/api/roast/+server.ts`):

- Supported `shareToken` URL parameter for public roast profile sharing
- Validated share tokens against `shared_links` table
- Returned shared roast data without requiring authentication
- Handled both individual roast sharing and "all roasts" sharing

**Required Implementation**:

```typescript
// Add to /api/roast-profiles GET endpoint
const shareToken = url.searchParams.get('share');
if (shareToken) {
	// Validate share token and return public data
	const { data: shareData } = await locals.supabase
		.from('shared_links')
		.select('user_id, resource_id')
		.eq('share_token', shareToken)
		.eq('is_active', true)
		.gte('expires_at', new Date().toISOString())
		.single();

	if (shareData) {
		// Return shared roast profiles
	}
}
```

#### 2. SearchState Response Format

**Status**: ❌ Removed (no longer needed)

**Legacy Format**: `{ data: [], searchState: Object.fromEntries(url.searchParams.entries()) }`
**Modern Format**: `{ data: [] }`

**Note**: SearchState was intended for site search functionality that no longer exists.

### API Response Compatibility

- ✅ GET responses: Both return `{ data: [] }` format
- ✅ POST responses: Modern endpoint returns expected `{ profiles, roast_ids }` format
- ✅ Error handling: Compatible formats maintained
- ✅ Authentication: User auth and permissions preserved

### Breaking Changes Fixed

1. **Schema Error**: Fixed `created_at` column reference causing database errors
2. **JavaScript Error**: Fixed undefined array access in form component
3. **Endpoint Consistency**: All roast operations now use single modern endpoint

### Migration Benefits

- Eliminated schema errors preventing roast profile creation
- Enabled batch roast profile creation with multiple beans
- Added automatic weight loss percentage calculations
- Improved inventory status updates after roast operations
- Simplified codebase with single endpoint for all operations
