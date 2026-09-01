import { describe, expect, it, vi } from 'vitest';
import {
	createParchmentInventoryShareGrant,
	redeemParchmentInventoryShareGrant
} from './parchmentShares';

const TOKEN = 'a'.repeat(64);
const GRANT = {
	id: '00000000-0000-4000-8000-000000000001',
	token: TOKEN,
	scope: { type: 'all' as const },
	expiresAt: '2026-09-07T12:00:00.000Z'
};

describe('Parchment inventory share boundary', () => {
	it('unwraps a created grant', async () => {
		const create = vi.fn().mockResolvedValue({ data: { data: GRANT } });
		const client = { inventory: { shareGrants: { create } } };
		const request = {
			operationId: '00000000-0000-4000-8000-000000000002',
			scope: { type: 'all' as const },
			expiresInDays: 7
		};

		await expect(createParchmentInventoryShareGrant(client as never, request)).resolves.toEqual(
			GRANT
		);
		expect(create).toHaveBeenCalledWith(request);
	});

	it('rejects an invalid created-grant response', async () => {
		const client = {
			inventory: { shareGrants: { create: vi.fn().mockResolvedValue({ data: { data: {} } }) } }
		};

		await expect(
			createParchmentInventoryShareGrant(client as never, {
				operationId: '00000000-0000-4000-8000-000000000002',
				scope: { type: 'all' }
			})
		).rejects.toMatchObject({ name: 'ParchmentShareError', status: 502 });
	});

	it('redeems anonymously supplied capability data', async () => {
		const rows = [{ id: 42, roast_profiles: [] }];
		const redeem = vi.fn().mockResolvedValue({ data: { data: rows } });
		const client = { inventory: { shareGrants: { redeem } } };

		await expect(redeemParchmentInventoryShareGrant(client as never, TOKEN)).resolves.toEqual(rows);
		expect(redeem).toHaveBeenCalledWith({ token: TOKEN });
	});

	it('preserves upstream status and body', async () => {
		const body = { error: { message: 'Rate limited' } };
		const client = {
			inventory: {
				shareGrants: {
					redeem: vi.fn().mockResolvedValue({
						error: body,
						response: new Response(null, { status: 429 })
					})
				}
			}
		};

		await expect(redeemParchmentInventoryShareGrant(client as never, TOKEN)).rejects.toEqual(
			expect.objectContaining({
				name: 'ParchmentShareError',
				status: 429,
				body
			})
		);
	});
});
