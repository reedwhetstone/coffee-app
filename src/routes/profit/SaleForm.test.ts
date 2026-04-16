import { describe, expect, it, vi } from 'vitest';

function createHandleSubmit({
	onSubmit,
	onClose,
	alertFn,
	fetchFn
}: {
	onSubmit: (sale: unknown) => Promise<void>;
	onClose: () => void;
	alertFn: (message: string) => void;
	fetchFn: () => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
}) {
	const formData = {
		green_coffee_inv_id: 1,
		oz_sold: 12,
		price: 24,
		buyer: 'Test Buyer',
		batch_name: '',
		sell_date: '2026-04-15',
		purchase_date: '2026-04-10',
		coffee_name: 'Test Coffee'
	};

	return async function handleSubmit() {
		const isUpdate = false;

		try {
			Object.fromEntries(
				Object.entries(formData).map(([key, value]) => [
					key,
					value === '' || value === undefined ? null : value
				])
			);

			const response = await fetchFn();

			if (response.ok) {
				const newSale = await response.json();
				try {
					await onSubmit(newSale);
				} catch (error) {
					const message = error instanceof Error ? error.message : 'Unknown error occurred';
					alertFn(`Sale was saved, but refreshing profit data failed: ${message}`);
					onClose();
				}
			} else {
				const data = (await response.json()) as { error?: string };
				alertFn(`Failed to ${isUpdate ? 'update' : 'create'} sale: ${data.error}`);
			}
		} catch (error) {
			console.error(`Error ${isUpdate ? 'updating' : 'creating'} sale:`, error);
		}
	};
}

describe('SaleForm submit failure handling', () => {
	it('alerts and closes when save succeeds but refresh fails', async () => {
		const onSubmit = vi.fn().mockRejectedValue(new Error('Failed to refresh profit data (500)'));
		const onClose = vi.fn();
		const alertFn = vi.fn();
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ id: 123 })
		});

		const handleSubmit = createHandleSubmit({
			onSubmit,
			onClose,
			alertFn,
			fetchFn
		});

		await handleSubmit();

		expect(onSubmit).toHaveBeenCalledWith({ id: 123 });
		expect(alertFn).toHaveBeenCalledWith(
			'Sale was saved, but refreshing profit data failed: Failed to refresh profit data (500)'
		);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('does not close or alert on successful save and refresh', async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const onClose = vi.fn();
		const alertFn = vi.fn();
		const fetchFn = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ id: 456 })
		});

		const handleSubmit = createHandleSubmit({
			onSubmit,
			onClose,
			alertFn,
			fetchFn
		});

		await handleSubmit();

		expect(onSubmit).toHaveBeenCalledWith({ id: 456 });
		expect(alertFn).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});
});
