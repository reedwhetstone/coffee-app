import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('inventory share Parchment data boundary', () => {
	it('keeps creation and cross-principal redemption behind Parchment', () => {
		const createSource = readFileSync(resolve('src/routes/api/share/+server.ts'), 'utf8');
		const beansSource = readFileSync(resolve('src/routes/api/beans/+server.ts'), 'utf8');
		const boundarySource = readFileSync(resolve('src/lib/server/parchmentShares.ts'), 'utf8');
		const authSource = readFileSync(resolve('src/lib/server/auth.ts'), 'utf8');
		const databaseTypes = readFileSync(resolve('src/lib/types/database.types.ts'), 'utf8');

		expect(createSource).toContain('createParchmentInventoryShareGrant');
		expect(beansSource).toContain('redeemParchmentInventoryShareGrant');
		expect(createSource).not.toContain('locals.supabase');
		expect(beansSource).not.toContain('supabase');
		expect(beansSource).not.toContain('shared_links');
		expect(beansSource).not.toContain('green_coffee_inv');
		expect(beansSource).not.toContain('user_roles');
		expect(beansSource).not.toContain('getUserRoles');
		expect(authSource).not.toContain(".from('user_roles')");
		expect(authSource).not.toContain('getUserRoles');
		expect(boundarySource).toContain('client.inventory.shareGrants.create');
		expect(boundarySource).toContain('client.inventory.shareGrants.redeem');
		expect(boundarySource).not.toContain('supabase');
		expect(databaseTypes).not.toContain('shared_links:');
		expect(existsSync(resolve('src/lib/server/greenCoffeeUtils.ts'))).toBe(false);
	});
});
