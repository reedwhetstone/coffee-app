import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
	resolve(process.cwd(), 'supabase/migrations/20260711_chat_action_execution_ledger.sql'),
	'utf8'
);

describe('chat action execution ledger migration', () => {
	it('keeps ledger mutation behind the security-definer execution function', () => {
		expect(sql).toContain('security definer');
		expect(sql).toContain(
			'revoke insert, update, delete on public.chat_action_executions from anon, authenticated'
		);
		expect(sql).not.toContain('Users insert own chat action executions');
		expect(sql).not.toContain('Users update own chat action executions');
	});

	it('supports every write action and preserves inventory stocked recalculation', () => {
		for (const action of [
			'add_bean_to_inventory',
			'update_bean',
			'create_roast_session',
			'update_roast_notes',
			'record_sale'
		]) {
			expect(sql).toContain(`p_action_type = '${action}'`);
		}
		expect(sql).toContain('sum(coalesce(oz_in, 0))');
		expect(sql).toContain("p_fields ? 'purchased_qty_lbs' and not (p_fields ? 'stocked')");
	});

	it('allows both members and admins while retaining the Parchment action exception', () => {
		expect(sql).toContain("r.role in ('member'::public.user_role, 'admin'::public.user_role)");
		expect(sql).toContain("p_action_type in ('add_bean_to_inventory','update_bean')");
		expect(sql).toContain('coalesce(r.ppi_access,false)');
	});

	it('uses a transactional pending claim and rolls failures back instead of advertising durable failed rows', () => {
		expect(sql).toContain("status in ('pending', 'success')");
		expect(sql).toContain("p_fields, 'pending'");
		expect(sql).not.toContain("p_fields, 'failed'");
	});
});
