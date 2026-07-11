import { describe, expect, it, vi } from 'vitest';
import { COMMITTED_REFRESH_WARNING, refreshAfterCommittedCreate } from './committed-refresh';

describe('refreshAfterCommittedCreate', () => {
	it('reports no warning when the committed roast can be reloaded', async () => {
		const reload = vi.fn().mockResolvedValue({ roast_id: 42 });
		await expect(refreshAfterCommittedCreate(42, reload)).resolves.toBeNull();
		expect(reload).toHaveBeenCalledWith(42);
	});

	it('resolves with a recovery warning when refresh fails after the write committed', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const reload = vi.fn().mockRejectedValue(new Error('network unavailable'));
		await expect(refreshAfterCommittedCreate(42, reload)).resolves.toBe(COMMITTED_REFRESH_WARNING);
	});

	it('treats a missing read-after-write result as committed partial success', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		await expect(refreshAfterCommittedCreate(42, vi.fn().mockResolvedValue(null))).resolves.toBe(
			COMMITTED_REFRESH_WARNING
		);
	});
});
