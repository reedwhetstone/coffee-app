import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/api/profit sales read boundary', () => {
	it('keeps direct sales-table reads out of the GET transport', () => {
		const routeSource = readFileSync(resolve('src/routes/api/profit/+server.ts'), 'utf8');
		const getHandler = routeSource.slice(
			routeSource.indexOf('export const GET'),
			routeSource.indexOf('export const PUT')
		);
		const salesSource = readFileSync(resolve('src/lib/data/sales.ts'), 'utf8');
		const profitSummary = salesSource.slice(
			salesSource.indexOf('export async function getProfitData'),
			salesSource.indexOf('export async function recordSale')
		);

		expect(getHandler).toContain('fetchParchmentSales');
		expect(getHandler).not.toContain(".from('sales')");
		expect(salesSource).not.toContain('export async function listSales');
		expect(profitSummary).toContain('sales(');
	});
});
