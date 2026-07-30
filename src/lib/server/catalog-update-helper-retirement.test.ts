import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('catalog update compatibility helper retirement', () => {
	it('keeps the unused direct-Supabase RPC helper retired', () => {
		expect(existsSync(resolve('src/lib/server/updateUtils.ts'))).toBe(false);
	});
});
