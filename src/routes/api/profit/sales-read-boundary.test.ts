import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/api/profit Parchment data boundary', () => {
	it('keeps direct sales and profit access out of every transport', () => {
		const routeSource = readFileSync(resolve('src/routes/api/profit/+server.ts'), 'utf8');
		const getHandler = routeSource.slice(
			routeSource.indexOf('export const GET'),
			routeSource.indexOf('export const PUT')
		);
		const profitSource = readFileSync(resolve('src/lib/server/parchmentProfit.ts'), 'utf8');

		expect(getHandler).toContain('fetchParchmentSales');
		expect(getHandler).toContain('fetchParchmentProfit');
		expect(getHandler).not.toContain(".from('sales')");
		expect(getHandler).not.toContain(".from('green_coffee_inv')");
		expect(routeSource).toContain('createParchmentSale');
		expect(routeSource).toContain('updateParchmentSale');
		expect(routeSource).toContain('deleteParchmentSale');
		expect(routeSource).not.toContain(".from('sales')");
		expect(routeSource).not.toContain(".from('green_coffee_inv')");
		expect(profitSource).toContain('client.profit.list');
		expect(profitSource).not.toContain('supabase');
		expect(profitSource).not.toContain(".from('green_coffee_inv')");
	});
});
