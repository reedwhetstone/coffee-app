import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/api/profit Parchment sales boundary', () => {
	it('keeps direct sales-table access out of every sales transport', () => {
		const routeSource = readFileSync(resolve('src/routes/api/profit/+server.ts'), 'utf8');
		const getHandler = routeSource.slice(
			routeSource.indexOf('export const GET'),
			routeSource.indexOf('export const PUT')
		);
		const salesSource = readFileSync(resolve('src/lib/data/sales.ts'), 'utf8');

		expect(getHandler).toContain('fetchParchmentSales');
		expect(getHandler).not.toContain(".from('sales')");
		expect(routeSource).toContain('createParchmentSale');
		expect(routeSource).toContain('updateParchmentSale');
		expect(routeSource).toContain('deleteParchmentSale');
		expect(routeSource).not.toContain(".from('sales')");
		expect(salesSource).not.toContain('export async function listSales');
		expect(salesSource).not.toContain('export async function recordSale');
		expect(salesSource).not.toContain('export async function updateSale');
		expect(salesSource).not.toContain('export async function deleteSale');
		expect(salesSource).toContain('sales(');
	});
});
