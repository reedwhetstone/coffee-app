import { describe, expect, it } from 'vitest';
import {
	applyBffCatalogCacheHeaders,
	applyBffCatalogNoStore,
	resolveBffCatalogCacheControl,
	BFF_PUBLIC_CATALOG_CACHE_CONTROL,
	BFF_PRIVATE_CATALOG_CACHE_CONTROL
} from './cacheHeaders';

describe('resolveBffCatalogCacheControl', () => {
	it('gives anonymous callers the public short-TTL policy', () => {
		expect(resolveBffCatalogCacheControl(false)).toBe(BFF_PUBLIC_CATALOG_CACHE_CONTROL);
		expect(BFF_PUBLIC_CATALOG_CACHE_CONTROL).toBe(
			'public, s-maxage=60, stale-while-revalidate=300'
		);
	});

	it('forces authenticated callers to private/no-store', () => {
		expect(resolveBffCatalogCacheControl(true)).toBe(BFF_PRIVATE_CATALOG_CACHE_CONTROL);
		expect(BFF_PRIVATE_CATALOG_CACHE_CONTROL).toBe('private, no-store');
	});
});

describe('applyBffCatalogCacheHeaders', () => {
	it('adds Vary: Cookie for anonymous responses so a shared cache keys on the session', () => {
		const headers = applyBffCatalogCacheHeaders(new Headers(), false);
		expect(headers.get('Cache-Control')).toBe('public, s-maxage=60, stale-while-revalidate=300');
		expect(headers.get('Vary')).toContain('Cookie');
	});

	it('does not add Vary: Cookie for authenticated (no-store) responses', () => {
		const headers = applyBffCatalogCacheHeaders(new Headers(), true);
		expect(headers.get('Cache-Control')).toBe('private, no-store');
		expect(headers.get('Vary')).toBeNull();
	});

	it('merges Cookie into an existing Vary header without duplicating', () => {
		const seeded = new Headers({ Vary: 'Accept-Encoding' });
		const headers = applyBffCatalogCacheHeaders(seeded, false);
		const vary = headers.get('Vary') ?? '';
		expect(vary).toContain('Accept-Encoding');
		expect(vary).toContain('Cookie');
	});
});

describe('applyBffCatalogNoStore', () => {
	it('always forces no-store (error responses are never shared-cacheable)', () => {
		expect(applyBffCatalogNoStore(new Headers()).get('Cache-Control')).toBe('private, no-store');
	});
});
