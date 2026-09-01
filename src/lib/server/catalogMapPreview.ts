type CatalogMapPreviewEnvironment = {
	CATALOG_MAP_PREVIEW_ENABLED?: string;
	VERCEL_ENV?: string;
};

/**
 * Keep production rollout explicit while making review deployments useful by
 * default. An explicit flag always wins, including the emergency/off path.
 */
export function resolveCatalogMapPreviewEnabled(env: CatalogMapPreviewEnvironment): boolean {
	if (env.CATALOG_MAP_PREVIEW_ENABLED === 'true') return true;
	if (env.CATALOG_MAP_PREVIEW_ENABLED === 'false') return false;

	return env.VERCEL_ENV === 'preview';
}
