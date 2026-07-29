import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SaleForm from './SaleForm.svelte';

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

describe('SaleForm create idempotency', () => {
	it('uses one stable key and blocks a concurrent duplicate submit', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
			'00000000-0000-4000-8000-000000000001'
		);
		let resolveFetch!: (response: Response) => void;
		const fetchMock = vi.fn(
			(_input: RequestInfo | URL, _init?: RequestInit) =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve;
				})
		);
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();
		const { container } = render(SaleForm, {
			onClose: vi.fn(),
			onSubmit,
			availableCoffees: [],
			availableBatches: []
		});
		const form = container.querySelector('form')!;

		await fireEvent.submit(form);
		await fireEvent.submit(form);

		expect(fetchMock).toHaveBeenCalledOnce();
		expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
			'Content-Type': 'application/json',
			'Idempotency-Key': '00000000-0000-4000-8000-000000000001'
		});
		expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

		resolveFetch(
			new Response(JSON.stringify({ id: 31 }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ id: 31 }));
	});

	it('uses a new key when the payload changes after an ambiguous network failure', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
			.mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const fetchMock = vi
			.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response()))
			.mockRejectedValueOnce(new Error('connection lost'))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: 31 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchMock);
		const { container } = render(SaleForm, {
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			availableCoffees: [],
			availableBatches: []
		});
		const form = container.querySelector('form')!;

		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.input(screen.getByLabelText('Buyer'), { target: { value: 'Changed buyer' } });
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
		const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
		expect(firstHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001');
		expect(secondHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000002');
	});

	it('reuses the key when the same payload is retried after an ambiguous network failure', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
			'00000000-0000-4000-8000-000000000001'
		);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const fetchMock = vi
			.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response()))
			.mockRejectedValueOnce(new Error('connection lost'))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: 31 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchMock);
		const { container } = render(SaleForm, {
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			availableCoffees: [],
			availableBatches: []
		});
		const form = container.querySelector('form')!;

		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
		const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
		expect(firstHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001');
		expect(secondHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001');
	});

	it('reuses the key after an ambiguous HTTP failure response', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
			'00000000-0000-4000-8000-000000000001'
		);
		vi.stubGlobal('alert', vi.fn());
		const fetchMock = vi
			.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response()))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: 'Writes are temporarily disabled' }), {
					status: 503,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: 31 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchMock);
		const { container } = render(SaleForm, {
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			availableCoffees: [],
			availableBatches: []
		});
		const form = container.querySelector('form')!;

		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
		const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
		expect(firstHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001');
		expect(secondHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001');
	});

	it('rotates the key after a definitive HTTP failure response', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
			.mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
		vi.stubGlobal('alert', vi.fn());
		const fetchMock = vi
			.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response()))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: 'Invalid sale' }), {
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				})
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: 31 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchMock);
		const { container } = render(SaleForm, {
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			availableCoffees: [],
			availableBatches: []
		});
		const form = container.querySelector('form')!;

		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
		const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
		expect(firstHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001');
		expect(secondHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000002');
	});

	it('reuses the key when a successful response body cannot be consumed', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
			'00000000-0000-4000-8000-000000000001'
		);
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
		const fetchMock = vi
			.fn((_input: RequestInfo | URL, _init?: RequestInit) => Promise.resolve(new Response()))
			.mockResolvedValueOnce(new Response('not-json', { status: 200 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ id: 31 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
			);
		vi.stubGlobal('fetch', fetchMock);
		const { container } = render(SaleForm, {
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			availableCoffees: [],
			availableBatches: []
		});
		const form = container.querySelector('form')!;

		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
		const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
		expect(firstHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001');
		expect(secondHeaders['Idempotency-Key']).toBe('00000000-0000-4000-8000-000000000001');
	});
});
