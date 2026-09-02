import { describe, expect, it } from 'vitest';
import { resolveCatalogMapPreviewEnabled } from './catalogMapPreview';

describe('resolveCatalogMapPreviewEnabled', () => {
	it('auto-enables review deployments without changing production defaults', () => {
		expect(resolveCatalogMapPreviewEnabled({ VERCEL_ENV: 'preview' })).toBe(true);
		expect(resolveCatalogMapPreviewEnabled({ VERCEL_ENV: 'production' })).toBe(false);
		expect(resolveCatalogMapPreviewEnabled({})).toBe(false);
	});

	it('lets the explicit release flag override the deployment environment', () => {
		expect(
			resolveCatalogMapPreviewEnabled({
				CATALOG_MAP_PREVIEW_ENABLED: 'false',
				VERCEL_ENV: 'preview'
			})
		).toBe(false);
		expect(
			resolveCatalogMapPreviewEnabled({
				CATALOG_MAP_PREVIEW_ENABLED: 'true',
				VERCEL_ENV: 'production'
			})
		).toBe(true);
	});
});
