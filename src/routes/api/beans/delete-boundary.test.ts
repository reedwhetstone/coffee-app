import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/api/beans DELETE data boundary', () => {
	it('routes inventory update and delete mutations only through Parchment', () => {
		const routeSource = readFileSync(resolve('src/routes/api/beans/+server.ts'), 'utf8');
		const updateHandler = routeSource.slice(
			routeSource.indexOf('export const PUT'),
			routeSource.indexOf('export const DELETE')
		);
		const deleteHandler = routeSource.slice(routeSource.indexOf('export const DELETE'));
		const inventorySource = readFileSync(resolve('src/lib/data/inventory.ts'), 'utf8');

		expect(updateHandler).toContain('updateParchmentInventoryItem');
		expect(updateHandler).not.toContain('supabase');
		expect(updateHandler).not.toContain('updateInventory');
		expect(deleteHandler).toContain('deleteParchmentInventoryItem');
		expect(deleteHandler).not.toContain('supabase');
		expect(deleteHandler).not.toContain('deleteInventoryItem');
		expect(inventorySource).not.toContain('export async function deleteInventoryItem');
		expect(inventorySource).not.toContain('export async function updateInventory');
		expect(inventorySource).not.toContain('export async function updateStockedStatus');
	});

	it('leaves stocked derivation to the Parchment-owned roast trigger', () => {
		const roastRouteSource = readFileSync(
			resolve('src/routes/api/roast-profiles/+server.ts'),
			'utf8'
		);

		expect(roastRouteSource).not.toContain('updateStockedStatus');
		expect(roastRouteSource).not.toContain('$lib/data/inventory');
	});

	it('wires the dependency-safe confirmation into the deletion component', () => {
		const componentSource = readFileSync(
			resolve('src/routes/beans/BeanProfileTabs.svelte'),
			'utf8'
		);

		expect(componentSource).toContain('confirm(INVENTORY_DELETE_CONFIRMATION)');
		expect(componentSource).not.toContain('also delete all associated');
		expect(componentSource.match(/'If-Match'/g)).toHaveLength(2);
		expect(componentSource).toContain('editedRecord[key] !== selectedRecord[key]');
		expect(componentSource).not.toContain('...selectedBean,');
		expect(componentSource).not.toContain('last_updated: new Date().toISOString()');
	});
});
