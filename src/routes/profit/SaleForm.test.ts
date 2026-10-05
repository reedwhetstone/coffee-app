import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
			availableRoasts: []
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
			availableRoasts: []
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
			availableRoasts: []
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
			availableRoasts: []
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
			availableRoasts: []
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
			availableRoasts: []
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

const OCT_1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const SEP_24 = 'aaaaaaaa-0000-4000-8000-000000000002';
const GUJI = 'aaaaaaaa-0000-4000-8000-000000000003';
// A batch a link still names after it was deleted: none of the member's roasts are in it.
const GONE = 'aaaaaaaa-0000-4000-8000-00000000dead';

const coffees = [
	{ id: 101, name: 'Ethiopia Wush Wush', stocked: true, purchase_date: '2026-08-01' },
	{ id: 102, name: 'Colombia Sierra Nevada', stocked: true, purchase_date: '2026-08-05' },
	{ id: 103, name: 'Kenya Nyeri', stocked: true, purchase_date: '2026-08-09' }
];

// "Wednesday roast" is roasted every week: Oct 1 and Sep 24 are two batches with one name.
const batchRoasts = [
	{
		roast_id: 4531,
		batch_id: OCT_1,
		batch_name: 'Wednesday roast',
		roast_date: '2026-10-01',
		coffee_id: 101,
		coffee_name: 'Ethiopia Wush Wush'
	},
	{
		roast_id: 4530,
		batch_id: OCT_1,
		batch_name: 'Wednesday roast',
		roast_date: '2026-10-01',
		coffee_id: 102,
		coffee_name: 'Colombia Sierra Nevada'
	},
	{
		roast_id: 4529,
		batch_id: GUJI,
		batch_name: 'Guji drop test',
		roast_date: '2026-09-27',
		coffee_id: 101,
		coffee_name: 'Ethiopia Wush Wush'
	},
	{
		roast_id: 4521,
		batch_id: SEP_24,
		batch_name: 'Wednesday roast',
		roast_date: '2026-09-24',
		coffee_id: 101,
		coffee_name: 'Ethiopia Wush Wush'
	}
];

describe('SaleForm batches and roasts', () => {
	let fetchMock: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers({ now: new Date('2026-10-05T12:00:00Z'), toFake: ['Date'] });
		fetchMock = vi.fn(
			async () =>
				new Response(JSON.stringify({ id: 31 }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' }
				})
		);
		vi.stubGlobal('fetch', fetchMock);
		vi.stubGlobal('alert', vi.fn());
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	function renderForm(props: Record<string, unknown> = {}) {
		const onSubmit = vi.fn();
		const view = render(SaleForm, {
			onClose: vi.fn(),
			onSubmit,
			availableCoffees: coffees,
			availableRoasts: batchRoasts,
			...props
		} as never);
		return { ...view, onSubmit };
	}

	const coffeeSelect = () => screen.getByLabelText('Coffee Name') as HTMLSelectElement;
	const batchSelect = () => screen.getByLabelText(/^Batch/) as HTMLSelectElement;
	const optionLabels = (select: HTMLSelectElement) =>
		Array.from(select.options).map((option) => option.textContent?.replace(/\s+/g, ' ').trim());
	const chosen = (select: HTMLSelectElement) =>
		Array.from(select.options)
			.find((option) => option.selected)
			?.textContent?.replace(/\s+/g, ' ')
			.trim();
	const roastCheckbox = () => screen.queryByRole('checkbox', { name: /From roast #\d+ only/ });

	async function fillSale() {
		await fireEvent.input(screen.getByLabelText('Buyer'), { target: { value: 'Corner Cafe' } });
		await fireEvent.input(screen.getByLabelText('Amount Sold (oz)'), { target: { value: '12' } });
		await fireEvent.input(screen.getByLabelText('Sale Price ($)'), { target: { value: '24' } });
	}

	async function submitted(container: HTMLElement) {
		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalled());
		const [url, init] = fetchMock.mock.calls.at(-1)! as [string, RequestInit];
		return { url, method: init.method, body: JSON.parse(String(init.body)) };
	}

	it('labels each batch by its date, so two batches with one name can be told apart', () => {
		renderForm();

		expect(optionLabels(batchSelect())).toEqual([
			'Select a batch (optional)...',
			'Oct 1 · Wednesday roast',
			'Sep 27 · Guji drop test',
			'Sep 24 · Wednesday roast'
		]);
	});

	it('adds the coffee to the label of batches that share a name and a day', () => {
		renderForm({
			availableRoasts: [batchRoasts[0], { ...batchRoasts[1], batch_id: SEP_24 }, batchRoasts[2]]
		});

		expect(optionLabels(batchSelect())).toEqual([
			'Select a batch (optional)...',
			'Oct 1 · Wednesday roast · Ethiopia Wush Wush',
			'Oct 1 · Wednesday roast · Colombia Sierra Nevada',
			'Sep 27 · Guji drop test'
		]);
	});

	it('opens from a roast with the coffee, the batch, and the roast filled in, and sends their IDs', async () => {
		const { container } = renderForm({
			prefill: { coffeeId: 101, batchId: OCT_1, roastId: 4531 }
		});

		expect(chosen(coffeeSelect())).toBe('Ethiopia Wush Wush');
		expect(chosen(batchSelect())).toBe('Oct 1 · Wednesday roast');
		expect(roastCheckbox()).toBeChecked();

		await fillSale();
		const request = await submitted(container);

		expect(request.url).toBe('/api/profit');
		expect(request.method).toBe('POST');
		expect(request.body).toEqual({
			green_coffee_inv_id: 101,
			oz_sold: 12,
			price: 24,
			buyer: 'Corner Cafe',
			sell_date: '2026-10-05',
			batch_id: OCT_1,
			roast_id: 4531
		});
	});

	it('sends the batch alone once the roast is cleared', async () => {
		const { container } = renderForm({
			prefill: { coffeeId: 101, batchId: OCT_1, roastId: 4531 }
		});

		await fireEvent.click(roastCheckbox()!);
		await fillSale();
		const { body } = await submitted(container);

		expect(body.batch_id).toBe(OCT_1);
		expect(body).not.toHaveProperty('roast_id');
		expect(body).not.toHaveProperty('batch_name');
	});

	it('opens from a batch of one coffee with that coffee chosen, and names no roast', async () => {
		const { container } = renderForm({
			prefill: { coffeeId: null, batchId: GUJI, roastId: null }
		});

		await waitFor(() => expect(chosen(coffeeSelect())).toBe('Ethiopia Wush Wush'));
		expect(chosen(batchSelect())).toBe('Sep 27 · Guji drop test');
		expect(roastCheckbox()).toBeNull();

		await fillSale();
		const { body } = await submitted(container);

		expect(body).toMatchObject({ green_coffee_inv_id: 101, batch_id: GUJI });
		expect(body).not.toHaveProperty('roast_id');
	});

	it('opens from a batch of two coffees with only those two to choose from', async () => {
		const { container } = renderForm({
			prefill: { coffeeId: null, batchId: OCT_1, roastId: null }
		});

		expect(chosen(batchSelect())).toBe('Oct 1 · Wednesday roast');
		expect(optionLabels(coffeeSelect())).toEqual([
			'Select a coffee...',
			'Ethiopia Wush Wush',
			'Colombia Sierra Nevada'
		]);

		await fireEvent.change(coffeeSelect(), { target: { value: '102' } });
		await fillSale();
		const { body } = await submitted(container);

		expect(body).toMatchObject({ green_coffee_inv_id: 102, batch_id: OCT_1 });
		expect(body).not.toHaveProperty('roast_id');
	});

	it('fills in the coffee and batch from the roast when a link names only the roast', async () => {
		renderForm({ prefill: { coffeeId: null, batchId: null, roastId: 4530 } });

		await waitFor(() => expect(chosen(coffeeSelect())).toBe('Colombia Sierra Nevada'));
		expect(chosen(batchSelect())).toBe('Oct 1 · Wednesday roast');
		expect(roastCheckbox()).toBeChecked();
	});

	it('does not name a roast that is not of the coffee the link names', async () => {
		const { container } = renderForm({
			prefill: { coffeeId: 102, batchId: OCT_1, roastId: 4531 }
		});

		await waitFor(() => expect(roastCheckbox()).toBeNull());
		await fillSale();
		const { body } = await submitted(container);

		expect(body).toMatchObject({ green_coffee_inv_id: 102, batch_id: OCT_1 });
		expect(body).not.toHaveProperty('roast_id');
	});

	it('drops a roast the link names once the roasts have loaded without it', async () => {
		const { container } = renderForm({
			prefill: { coffeeId: 101, batchId: OCT_1, roastId: 9999 }
		});

		expect(chosen(batchSelect())).toBe('Oct 1 · Wednesday roast');
		expect(roastCheckbox()).toBeNull();

		await fillSale();
		const { body } = await submitted(container);

		expect(body).toMatchObject({ green_coffee_inv_id: 101, batch_id: OCT_1 });
		expect(body).not.toHaveProperty('roast_id');
	});

	it('drops a batch the link names once the roasts have loaded without it', async () => {
		const { container } = renderForm({
			prefill: { coffeeId: 101, batchId: GONE, roastId: null }
		});

		expect(chosen(batchSelect())).toBe('Select a batch (optional)...');

		await fillSale();
		const { body } = await submitted(container);

		expect(body.green_coffee_inv_id).toBe(101);
		expect(body).not.toHaveProperty('batch_id');
		expect(body).not.toHaveProperty('roast_id');
	});

	it('takes the batch from the roast when the batch the link names is gone', async () => {
		const { container } = renderForm({
			prefill: { coffeeId: 102, batchId: GONE, roastId: 4530 }
		});

		await waitFor(() => expect(chosen(batchSelect())).toBe('Oct 1 · Wednesday roast'));
		expect(roastCheckbox()).toBeChecked();

		await fillSale();
		const { body } = await submitted(container);

		expect(body).toMatchObject({ green_coffee_inv_id: 102, batch_id: OCT_1, roast_id: 4530 });
	});

	it('keeps what the link names while the roasts are still loading, then shows it', async () => {
		const prefill = { coffeeId: 101, batchId: OCT_1, roastId: 4531 };
		const { container, rerender } = renderForm({
			availableRoasts: [],
			roastsLoaded: false,
			prefill
		});

		expect(roastCheckbox()).toBeNull();

		await rerender({ availableRoasts: batchRoasts, roastsLoaded: true });

		await waitFor(() => expect(roastCheckbox()).toBeChecked());
		expect(chosen(batchSelect())).toBe('Oct 1 · Wednesday roast');

		await fillSale();
		const { body } = await submitted(container);

		expect(body).toMatchObject({ batch_id: OCT_1, roast_id: 4531 });
	});

	it('drops what the link names when the roasts arrive without it', async () => {
		const { container, rerender } = renderForm({
			availableRoasts: [],
			roastsLoaded: false,
			prefill: { coffeeId: 101, batchId: GONE, roastId: 9999 }
		});

		await rerender({ availableRoasts: batchRoasts, roastsLoaded: true });
		await fillSale();
		const { body } = await submitted(container);

		expect(body.green_coffee_inv_id).toBe(101);
		expect(body).not.toHaveProperty('batch_id');
		expect(body).not.toHaveProperty('roast_id');
	});

	it('sends what the link names when the roasts could not be loaded', async () => {
		const { container } = renderForm({
			availableRoasts: [],
			roastsLoaded: false,
			prefill: { coffeeId: 101, batchId: OCT_1, roastId: 4531 }
		});

		await fillSale();
		const { body } = await submitted(container);

		expect(body).toMatchObject({ green_coffee_inv_id: 101, batch_id: OCT_1, roast_id: 4531 });
	});

	it('still offers a roasted coffee that is no longer in stock', () => {
		renderForm({
			availableCoffees: coffees.filter((coffee) => coffee.id !== 101),
			prefill: { coffeeId: 101, batchId: SEP_24, roastId: 4521 }
		});

		expect(chosen(coffeeSelect())).toBe('Ethiopia Wush Wush');
		expect(chosen(batchSelect())).toBe('Sep 24 · Wednesday roast');
	});

	it('lists only the batches the chosen coffee was roasted in', async () => {
		renderForm();

		await fireEvent.change(coffeeSelect(), { target: { value: '102' } });

		expect(optionLabels(batchSelect())).toEqual([
			'Select a batch (optional)...',
			'Oct 1 · Wednesday roast'
		]);
	});

	it('keeps the batch and stops naming the roast when the other coffee of the batch is chosen', async () => {
		const { container } = renderForm({
			prefill: { coffeeId: 101, batchId: OCT_1, roastId: 4531 }
		});

		await fireEvent.change(coffeeSelect(), { target: { value: '102' } });

		expect(chosen(batchSelect())).toBe('Oct 1 · Wednesday roast');
		expect(roastCheckbox()).toBeNull();

		await fillSale();
		const { body } = await submitted(container);
		expect(body).toEqual({
			green_coffee_inv_id: 102,
			oz_sold: 12,
			price: 24,
			buyer: 'Corner Cafe',
			sell_date: '2026-10-05',
			batch_id: OCT_1
		});
	});

	it('clears the batch and the roast with the coffee', async () => {
		renderForm({ prefill: { coffeeId: 101, batchId: OCT_1, roastId: 4531 } });

		await fireEvent.change(coffeeSelect(), { target: { value: '' } });

		expect(batchSelect().value).toBe('');
		expect(roastCheckbox()).toBeNull();
		expect(optionLabels(coffeeSelect())).toEqual([
			'Select a coffee...',
			'Ethiopia Wush Wush',
			'Colombia Sierra Nevada',
			'Kenya Nyeri'
		]);
	});

	it('records a sale with no batch when none is chosen', async () => {
		const { container } = renderForm();

		await fireEvent.change(coffeeSelect(), { target: { value: '103' } });
		await fillSale();
		const { body } = await submitted(container);

		expect(body).toEqual({
			green_coffee_inv_id: 103,
			oz_sold: 12,
			price: 24,
			buyer: 'Corner Cafe',
			sell_date: '2026-10-05'
		});
	});

	describe('an existing sale', () => {
		const legacySale = {
			id: 28,
			green_coffee_inv_id: 101,
			batch_id: null,
			roast_id: null,
			batch_name: 'Wednesday roast',
			buyer: 'Corner Cafe',
			oz_sold: 12,
			price: 24,
			sell_date: '2026-09-25',
			purchase_date: '2026-08-01',
			coffee_name: 'Ethiopia Wush Wush',
			wholesale: false
		};
		const linkedSale = { ...legacySale, id: 29, batch_id: OCT_1, roast_id: 4531 };

		it('shows a sale with a batch name and no batch as it was recorded, and says it is not linked', () => {
			renderForm({ sale: legacySale });

			expect(screen.getByRole('heading', { name: 'Edit Sale' })).toBeInTheDocument();
			expect(chosen(coffeeSelect())).toBe('Ethiopia Wush Wush');
			// A recorded sale keeps its coffee; only what it is recorded against can change.
			expect(coffeeSelect()).toBeDisabled();
			expect(chosen(batchSelect())).toBe('Not linked · recorded as “Wednesday roast”');
			expect(batchSelect()).toHaveAccessibleDescription(
				'This sale was recorded with a batch name and is not linked to a batch. Choose the batch to link it.'
			);
			expect(screen.getByLabelText('Buyer')).toHaveValue('Corner Cafe');
			expect(roastCheckbox()).toBeNull();
		});

		it('saves an edit to an unlinked sale without touching what batch it names', async () => {
			const { container } = renderForm({ sale: legacySale });

			await fireEvent.input(screen.getByLabelText('Sale Price ($)'), { target: { value: '26' } });
			const request = await submitted(container);

			expect(request.url).toBe('/api/profit?id=28');
			expect(request.method).toBe('PUT');
			expect(request.body).toEqual({
				oz_sold: 12,
				price: 26,
				buyer: 'Corner Cafe',
				sell_date: '2026-09-25'
			});
		});

		it('links an unlinked sale to the batch the member chooses, by ID', async () => {
			const { container } = renderForm({ sale: legacySale });

			await fireEvent.change(batchSelect(), { target: { value: SEP_24 } });
			const { body } = await submitted(container);

			expect(body).toEqual({
				oz_sold: 12,
				price: 24,
				buyer: 'Corner Cafe',
				sell_date: '2026-09-25',
				batch_id: SEP_24
			});
		});

		it('shows a linked sale on its batch and roast, and leaves both alone on an unrelated edit', async () => {
			const { container } = renderForm({ sale: linkedSale });

			expect(chosen(batchSelect())).toBe('Oct 1 · Wednesday roast');
			expect(roastCheckbox()).toBeChecked();

			await fireEvent.input(screen.getByLabelText('Buyer'), { target: { value: 'New buyer' } });
			const { body } = await submitted(container);

			expect(body).toEqual({
				oz_sold: 12,
				price: 24,
				buyer: 'New buyer',
				sell_date: '2026-09-25'
			});
		});

		it('moves a linked sale to another batch and stops naming the roast', async () => {
			const { container } = renderForm({ sale: linkedSale });

			await fireEvent.change(batchSelect(), { target: { value: SEP_24 } });
			const { body } = await submitted(container);

			expect(body).toMatchObject({ batch_id: SEP_24, roast_id: null });
		});

		it('removes the batch from a linked sale when "No batch" is chosen', async () => {
			const { container } = renderForm({ sale: linkedSale });

			await fireEvent.change(batchSelect(), { target: { value: '' } });
			const { body } = await submitted(container);

			expect(body).toMatchObject({ batch_id: null, roast_id: null });
		});

		it('keeps the batch and stops naming the roast when the roast is cleared', async () => {
			const { container } = renderForm({ sale: linkedSale });

			await fireEvent.click(roastCheckbox()!);
			const { body } = await submitted(container);

			expect(body).toMatchObject({ roast_id: null });
			expect(body).not.toHaveProperty('batch_id');
		});

		it('still shows the batch of a sale whose batch holds no roasts any more', () => {
			renderForm({
				sale: { ...linkedSale, batch_id: 'aaaaaaaa-0000-4000-8000-00000000ffff', roast_id: null }
			});

			expect(chosen(batchSelect())).toBe('Wednesday roast');
		});

		it('leaves the batch and roast of a sale alone when neither is among the roasts any more', async () => {
			const { container } = renderForm({
				sale: { ...linkedSale, batch_id: GONE, roast_id: 9999 }
			});

			await fireEvent.input(screen.getByLabelText('Buyer'), { target: { value: 'New buyer' } });
			const { body } = await submitted(container);

			expect(body.buyer).toBe('New buyer');
			expect(body).not.toHaveProperty('batch_id');
			expect(body).not.toHaveProperty('roast_id');
		});
	});
});
