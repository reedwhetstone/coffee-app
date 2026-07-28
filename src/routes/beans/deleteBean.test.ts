import { describe, expect, it, vi } from 'vitest';
import {
	deletePortfolioBean,
	INVENTORY_DELETE_CONFIRMATION,
	INVENTORY_DELETE_DEPENDENCY_MESSAGE
} from './deleteBean';

describe('portfolio inventory deletion', () => {
	it('refreshes the portfolio only after a successful deletion', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		);
		const refresh = vi.fn().mockResolvedValue(undefined);

		await expect(deletePortfolioBean(fetcher, 17, refresh)).resolves.toEqual({ ok: true });
		expect(fetcher).toHaveBeenCalledWith('/api/beans?id=17', { method: 'DELETE' });
		expect(refresh).toHaveBeenCalledOnce();
	});

	it('keeps the row visible and returns actionable feedback on a dependency conflict', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					error: {
						code: 'dependency_conflict',
						message: 'Inventory item has dependent records'
					}
				}),
				{
					status: 409,
					headers: { 'content-type': 'application/json' }
				}
			)
		);
		const refresh = vi.fn().mockResolvedValue(undefined);

		await expect(deletePortfolioBean(fetcher, 17, refresh)).resolves.toEqual({
			ok: false,
			message: INVENTORY_DELETE_DEPENDENCY_MESSAGE
		});
		expect(refresh).not.toHaveBeenCalled();
	});

	it.each([
		[404, 'This coffee is no longer in your inventory.'],
		[429, 'Too many inventory changes were requested. Wait a moment, then try again.'],
		[503, 'Inventory deletion is temporarily unavailable. Try again shortly.']
	])('maps status %i to useful feedback', async (status, message) => {
		const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }));

		await expect(deletePortfolioBean(fetcher, 17, vi.fn())).resolves.toEqual({
			ok: false,
			message
		});
	});

	it('states that dependencies block deletion without promising a cascade', () => {
		expect(INVENTORY_DELETE_CONFIRMATION).toContain('blocked');
		expect(INVENTORY_DELETE_CONFIRMATION).toContain('roast profiles');
		expect(INVENTORY_DELETE_CONFIRMATION).toContain('sales');
		expect(INVENTORY_DELETE_CONFIRMATION).not.toContain('also delete');
	});
});
