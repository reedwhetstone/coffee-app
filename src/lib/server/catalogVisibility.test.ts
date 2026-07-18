import { describe, expect, it } from 'vitest';
import { resolveCatalogVisibility } from './catalogVisibility';

describe('resolveCatalogVisibility', () => {
	it('includes wholesale by default for public and member sessions', () => {
		expect(resolveCatalogVisibility({ session: null, role: null }).showWholesale).toBe(true);
		expect(
			resolveCatalogVisibility({ session: { user: {} } as never, role: 'member' }).showWholesale
		).toBe(true);
	});

	it('allows every visitor to narrow to hobbyist suppliers only', () => {
		expect(
			resolveCatalogVisibility({
				session: null,
				role: null,
				showWholesaleRequested: false
			})
		).toMatchObject({ publicOnly: true, showWholesale: false, wholesaleOnly: false });
	});

	it('keeps wholesale-only scope restricted to member sessions', () => {
		expect(
			resolveCatalogVisibility({
				session: null,
				role: null,
				wholesaleOnlyRequested: true
			}).wholesaleOnly
		).toBe(false);
	});
});
