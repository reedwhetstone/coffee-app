import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('/api/beans DELETE data boundary', () => {
	it('cannot reach the retired direct-Supabase cascade', () => {
		const routeSource = readFileSync(resolve('src/routes/api/beans/+server.ts'), 'utf8');
		const deleteHandler = routeSource.slice(routeSource.indexOf('export const DELETE'));
		const inventorySource = readFileSync(resolve('src/lib/data/inventory.ts'), 'utf8');

		expect(deleteHandler).toContain('deleteParchmentInventoryItem');
		expect(deleteHandler).not.toContain('supabase');
		expect(deleteHandler).not.toContain('deleteInventoryItem');
		expect(inventorySource).not.toContain('export async function deleteInventoryItem');
	});

	it('wires the dependency-safe confirmation into the deletion component', () => {
		const componentSource = readFileSync(
			resolve('src/routes/beans/BeanProfileTabs.svelte'),
			'utf8'
		);

		expect(componentSource).toContain('confirm(INVENTORY_DELETE_CONFIRMATION)');
		expect(componentSource).not.toContain('also delete all associated');
	});
});
