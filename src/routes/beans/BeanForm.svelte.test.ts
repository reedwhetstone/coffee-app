import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogInventoryBatchLifecycle, components } from '@purveyors/sdk';
import type { CoffeeCatalog } from '$lib/types/component.types';
import BeanForm from './BeanForm.svelte';

const UUIDS = [
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000002',
	'00000000-0000-4000-8000-000000000003',
	'00000000-0000-4000-8000-000000000004'
] as const;

const CATALOG_BEANS = [
	{
		id: 101,
		name: 'First catalog lot',
		stocked: true,
		source: 'Supplier A',
		price_tiers: null,
		price_per_lb: 5,
		cost_lb: 5
	},
	{
		id: 102,
		name: 'Second catalog lot',
		stocked: true,
		source: 'Supplier B',
		price_tiers: null,
		price_per_lb: 6,
		cost_lb: 6
	}
] as unknown as CoffeeCatalog[];

function response(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function requestPayload(fetchMock: ReturnType<typeof vi.fn>, call: number) {
	const options = fetchMock.mock.calls[call][1] as RequestInit;
	return JSON.parse(String(options.body)) as Record<string, unknown>;
}

function storedReservation(storageKey: string): Record<string, unknown> {
	const stored = sessionStorage.getItem(storageKey);
	expect(stored).not.toBeNull();
	return (JSON.parse(String(stored)) as { request: Record<string, unknown> }).request;
}

function storeReservation(storageKey: string, request: Record<string, unknown>) {
	sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, request }));
}

async function fillManualRows(names: string[]) {
	const nameInputs = screen.getAllByLabelText('Coffee Name');
	const quantityInputs = screen.getAllByLabelText('Purchased Quantity (lbs)');
	const costInputs = screen.getAllByLabelText('Bean Cost ($)');

	for (const [index, name] of names.entries()) {
		await fireEvent.input(nameInputs[index], { target: { value: name } });
		await fireEvent.input(quantityInputs[index], { target: { value: '1' } });
		await fireEvent.input(costInputs[index], { target: { value: '10' } });
	}
}

function lifecycle(
	batchId: string,
	status: CatalogInventoryBatchLifecycle['status']
): CatalogInventoryBatchLifecycle {
	return {
		batchId,
		status,
		result:
			status === 'completed' ? { batchId, items: [{ rowId: UUIDS[1], inventoryId: 41 }] } : null,
		error:
			status === 'terminal_rejected'
				? { code: 'catalog_unavailable', message: 'Catalog lot is no longer available' }
				: null,
		updatedAt: '2026-08-29T15:00:00.000Z'
	};
}

type ManualInventoryBatchLifecycle = components['schemas']['ManualInventoryBatchLifecycle'];

function manualLifecycle(
	batchId: string,
	status: ManualInventoryBatchLifecycle['status']
): ManualInventoryBatchLifecycle {
	return {
		batchId,
		status,
		result:
			status === 'completed'
				? {
						batchId,
						items: [{ rowId: UUIDS[1], resource: { id: 41 } as never }]
					}
				: null,
		error:
			status === 'terminal_rejected'
				? { code: 'invalid_manual_batch', message: 'Manual batch is no longer valid' }
				: null,
		updatedAt: '2026-08-29T15:00:00.000Z'
	};
}

async function selectCatalogRows(ids: number[]) {
	await fireEvent.click(screen.getByText('Select from Catalog'));
	if (ids.length > 1) {
		for (let index = 1; index < ids.length; index++) {
			await fireEvent.click(screen.getAllByRole('button', { name: /Add Bean/ })[0]);
		}
	}

	const selects = screen.getAllByLabelText('Select Coffee Bean');
	const quantities = screen.getAllByLabelText('Purchased Quantity (lbs)');
	const costs = screen.getAllByLabelText('Bean Cost ($)');
	for (const [index, id] of ids.entries()) {
		await fireEvent.change(selects[index], { target: { value: String(id) } });
		await fireEvent.input(quantities[index], { target: { value: String(index + 1) } });
		await fireEvent.input(costs[index], { target: { value: String((index + 1) * 5) } });
	}
}

describe('BeanForm atomic manual inventory batches', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal('alert', vi.fn());
		sessionStorage.clear();
	});

	it('reserves complete intent, commits once, and refreshes only after completion', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(201, manualLifecycle(UUIDS[0], 'accepted')))
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[0], 'completed')));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();
		const onClose = vi.fn();

		const { container } = render(BeanForm, {
			bean: null,
			onClose,
			onSubmit,
			catalogBeans: [],
			ownerId: 'user-a'
		});
		await fireEvent.click(screen.getAllByRole('button', { name: /Add Bean/ })[0]);
		await fillManualRows(['First lot', 'Second lot']);
		await fireEvent.input(screen.getByLabelText('Total Tax & Shipping ($)'), {
			target: { value: '5.01' }
		});

		expect(screen.getByRole('button', { name: 'Add 2 Beans' })).toHaveAttribute('type', 'button');
		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('/api/beans');
		expect(options.method).toBe('POST');
		expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
		expect(requestPayload(fetchMock, 0)).toMatchObject({
			batchId: UUIDS[0],
			taxShipTotal: 5.01,
			items: [
				{
					rowId: UUIDS[1],
					manualCoffee: { name: 'First lot' },
					qty: 1,
					cost: 10
				},
				{
					rowId: UUIDS[2],
					manualCoffee: { name: 'Second lot' },
					qty: 1,
					cost: 10
				}
			]
		});
		expect(fetchMock.mock.calls[1]).toEqual([
			`/api/beans?manualBatchId=${UUIDS[0]}`,
			{ method: 'POST' }
		]);
		expect(onSubmit).toHaveBeenCalledWith([]);
		expect(onClose).toHaveBeenCalledOnce();
		expect(sessionStorage.getItem('purveyors:pending-manual-inventory-batch:user-a')).toBeNull();
	});

	it('shows exact-cent Parchment allocation copy for both batch types', async () => {
		render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: [],
			ownerId: 'user-a'
		});

		expect(
			screen.getByText('This total will be allocated across the manual batch in exact cents')
		).toBeInTheDocument();

		await fireEvent.click(screen.getByText('Select from Catalog'));

		expect(
			screen.queryByText('This total will be allocated across the manual batch in exact cents')
		).not.toBeInTheDocument();
		expect(
			screen.getByText('This total will be allocated across the catalog batch in exact cents')
		).toBeInTheDocument();
	});

	it('retries an uncertain reservation with the exact in-memory request and durable UUID', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1]);
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError('Network response was lost'))
			.mockResolvedValueOnce(response(201, manualLifecycle(UUIDS[0], 'accepted')))
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[0], 'completed')));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: [],
			ownerId: 'user-a'
		});
		await fillManualRows(['Uncertain lot']);

		const form = container.querySelector('form')!;
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(screen.getByRole('status')).toHaveTextContent('manual batch is unresolved');
		expect(storedReservation('purveyors:pending-manual-inventory-batch:user-a')).toEqual(
			requestPayload(fetchMock, 0)
		);
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

		expect(fetchMock.mock.calls[0][0]).toBe('/api/beans');
		expect(fetchMock.mock.calls[1][0]).toBe('/api/beans');
		expect(requestPayload(fetchMock, 1)).toEqual(requestPayload(fetchMock, 0));
	});

	it('retries the persisted manual reservation envelope after remount', async () => {
		const request = {
			batchId: UUIDS[0],
			purchaseDate: '2026-08-29',
			taxShipTotal: 5.01,
			items: [
				{
					rowId: UUIDS[1],
					manualCoffee: { name: 'Persisted manual lot' },
					qty: 2,
					cost: 20
				}
			]
		};
		storeReservation('purveyors:pending-manual-inventory-batch:user-a', request);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(201, manualLifecycle(UUIDS[0], 'accepted')))
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[0], 'completed')));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();
		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit,
			catalogBeans: [],
			ownerId: 'user-a'
		});

		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent('exact reservation can be retried')
		);
		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(fetchMock.mock.calls[0][0]).toBe('/api/beans');
		expect(requestPayload(fetchMock, 0)).toEqual(request);
		expect(fetchMock.mock.calls[1]).toEqual([
			`/api/beans?manualBatchId=${UUIDS[0]}`,
			{ method: 'POST' }
		]);
		expect(onSubmit).toHaveBeenCalledWith([]);
		expect(sessionStorage.getItem('purveyors:pending-manual-inventory-batch:user-a')).toBeNull();
	});

	it('reconciles a persisted UUID after reload and keeps unknown nonterminal', async () => {
		sessionStorage.setItem('purveyors:pending-manual-inventory-batch:user-a', UUIDS[0]);
		const fetchMock = vi
			.fn()
			.mockResolvedValue(response(200, manualLifecycle(UUIDS[0], 'unknown')));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();
		const onClose = vi.fn();
		const { container } = render(BeanForm, {
			bean: null,
			onClose,
			onSubmit,
			catalogBeans: [],
			ownerId: 'user-a'
		});
		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent('A manual batch is reserved')
		);
		expect(screen.getByLabelText('Coffee Name')).toBeDisabled();
		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

		expect(fetchMock.mock.calls[0]).toEqual([`/api/beans?manualBatchId=${UUIDS[0]}`]);
		expect(sessionStorage.getItem('purveyors:pending-manual-inventory-batch:user-a')).toBe(
			UUIDS[0]
		);
		expect(onSubmit).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('commits an accepted persisted batch after reload', async () => {
		sessionStorage.setItem('purveyors:pending-manual-inventory-batch:user-a', UUIDS[0]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[0], 'accepted')))
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[0], 'completed')));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();
		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit,
			catalogBeans: [],
			ownerId: 'user-a'
		});

		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock.mock.calls[0]).toEqual([`/api/beans?manualBatchId=${UUIDS[0]}`]);
		expect(fetchMock.mock.calls[1]).toEqual([
			`/api/beans?manualBatchId=${UUIDS[0]}`,
			{ method: 'POST' }
		]);
		expect(onSubmit).toHaveBeenCalledWith([]);
		expect(sessionStorage.getItem('purveyors:pending-manual-inventory-batch:user-a')).toBeNull();
	});

	it('isolates persisted batches between owners in the same tab', async () => {
		const ownerARequest = {
			batchId: UUIDS[0],
			items: [
				{
					rowId: UUIDS[3],
					manualCoffee: { name: 'Owner A lot' },
					qty: 1
				}
			]
		};
		storeReservation('purveyors:pending-manual-inventory-batch:user-a', ownerARequest);
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(201, manualLifecycle(UUIDS[1], 'accepted')))
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[1], 'completed')));
		vi.stubGlobal('fetch', fetchMock);
		const ownerBSubmit = vi.fn();
		render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: ownerBSubmit,
			catalogBeans: [],
			ownerId: 'user-b'
		});
		expect(screen.queryByRole('status')).not.toBeInTheDocument();
		await fillManualRows(['Owner B lot']);
		await fireEvent.submit(document.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(fetchMock.mock.calls[0][0]).toBe('/api/beans');
		expect(requestPayload(fetchMock, 0).batchId).toBe(UUIDS[1]);
		expect(storedReservation('purveyors:pending-manual-inventory-batch:user-a')).toEqual(
			ownerARequest
		);
		expect(sessionStorage.getItem('purveyors:pending-manual-inventory-batch:user-b')).toBeNull();
		expect(ownerBSubmit).toHaveBeenCalledWith([]);
	});

	it('keeps a terminally rejected draft editable and submits corrected intent under a fresh UUID', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2])
			.mockReturnValueOnce(UUIDS[3]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(201, manualLifecycle(UUIDS[0], 'terminal_rejected')))
			.mockResolvedValueOnce(response(201, manualLifecycle(UUIDS[2], 'accepted')))
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[2], 'completed')));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: [],
			ownerId: 'user-a'
		});
		await fillManualRows(['Invalid lot']);

		const form = container.querySelector('form')!;
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.input(screen.getByLabelText('Coffee Name'), {
			target: { value: 'Corrected lot' }
		});
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

		expect(requestPayload(fetchMock, 0).batchId).toBe(UUIDS[0]);
		expect(requestPayload(fetchMock, 1).batchId).toBe(UUIDS[2]);
		expect(requestPayload(fetchMock, 1)).toMatchObject({
			items: [{ rowId: UUIDS[3], manualCoffee: { name: 'Corrected lot' } }]
		});
	});

	it('rotates the UUID after a changed-payload conflict', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2])
			.mockReturnValueOnce(UUIDS[3]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				response(409, {
					error: 'Batch UUID belongs to another request',
					code: 'idempotency_conflict'
				})
			)
			.mockResolvedValueOnce(response(201, manualLifecycle(UUIDS[2], 'accepted')))
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[2], 'completed')));
		vi.stubGlobal('fetch', fetchMock);
		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: [],
			ownerId: 'user-a'
		});
		await fillManualRows(['Conflicting lot']);
		const form = container.querySelector('form')!;

		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText('Coffee Name')).not.toBeDisabled();
		await fireEvent.input(screen.getByLabelText('Coffee Name'), {
			target: { value: 'Corrected lot' }
		});
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

		expect(requestPayload(fetchMock, 0).batchId).toBe(UUIDS[0]);
		expect(requestPayload(fetchMock, 1).batchId).toBe(UUIDS[2]);
	});

	it.each([
		[401, { error: 'Session expired' }],
		[403, { error: 'Access check unavailable' }],
		[409, { error: 'Batch is still running', code: 'idempotency_in_progress' }]
	])('retries the exact reservation after retryable status %i', async (status, error) => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(status, error))
			.mockResolvedValueOnce(response(201, manualLifecycle(UUIDS[0], 'accepted')))
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[0], 'completed')));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: []
		});
		await fillManualRows(['Retryable lot']);

		const form = container.querySelector('form')!;
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

		expect(fetchMock.mock.calls[0][0]).toBe('/api/beans');
		expect(fetchMock.mock.calls[1][0]).toBe('/api/beans');
		expect(requestPayload(fetchMock, 1)).toEqual(requestPayload(fetchMock, 0));
	});

	it('does not overlap reservation requests while one submission is pending', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1]);
		let resolveReservation!: (value: Response) => void;
		const reservation = new Promise<Response>((resolve) => {
			resolveReservation = resolve;
		});
		const fetchMock = vi
			.fn()
			.mockReturnValueOnce(reservation)
			.mockResolvedValueOnce(response(200, manualLifecycle(UUIDS[0], 'completed')));
		vi.stubGlobal('fetch', fetchMock);
		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: [],
			ownerId: 'user-a'
		});
		await fillManualRows(['Overlapping lot']);
		const form = container.querySelector('form')!;

		void fireEvent.submit(form);
		void fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
		resolveReservation(response(201, manualLifecycle(UUIDS[0], 'accepted')));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
	});
});

describe('BeanForm atomic catalog inventory batches', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal('alert', vi.fn());
		sessionStorage.clear();
	});

	it('reserves complete intent once, preserves shared cents, and refreshes only after completion', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(201, lifecycle(UUIDS[0], 'accepted')))
			.mockResolvedValueOnce(response(200, lifecycle(UUIDS[0], 'completed')));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();
		const onClose = vi.fn();

		const { container } = render(BeanForm, {
			bean: null,
			onClose,
			onSubmit,
			catalogBeans: CATALOG_BEANS,
			ownerId: 'user-a'
		});
		await selectCatalogRows([101, 102]);
		await fireEvent.input(screen.getByLabelText('Total Tax & Shipping ($)'), {
			target: { value: '5.01' }
		});
		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(fetchMock.mock.calls[0][0]).toBe('/api/beans');
		expect(requestPayload(fetchMock, 0)).toMatchObject({
			batchId: UUIDS[0],
			taxShipTotal: 5.01,
			items: [
				{ rowId: UUIDS[1], catalogId: 101, qty: 1, cost: 5 },
				{ rowId: UUIDS[2], catalogId: 102, qty: 2, cost: 10 }
			]
		});
		expect(fetchMock.mock.calls[1]).toEqual([
			`/api/beans?catalogBatchId=${UUIDS[0]}`,
			{ method: 'POST' }
		]);
		expect(onSubmit).toHaveBeenCalledOnce();
		expect(onSubmit).toHaveBeenCalledWith([]);
		expect(onClose).toHaveBeenCalledOnce();
		expect(sessionStorage.getItem('purveyors:pending-catalog-inventory-batch:user-a')).toBeNull();
	});

	it('retries an uncertain reservation with the exact in-memory request and durable UUID', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1]);
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(new TypeError('Network response was lost'))
			.mockResolvedValueOnce(response(201, lifecycle(UUIDS[0], 'accepted')))
			.mockResolvedValueOnce(response(200, lifecycle(UUIDS[0], 'completed')));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: CATALOG_BEANS,
			ownerId: 'user-a'
		});
		await selectCatalogRows([101]);

		const form = container.querySelector('form')!;
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(screen.getByRole('status')).toHaveTextContent('catalog batch is unresolved');
		expect(storedReservation('purveyors:pending-catalog-inventory-batch:user-a')).toEqual(
			requestPayload(fetchMock, 0)
		);

		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
		expect(fetchMock.mock.calls[0][0]).toBe('/api/beans');
		expect(fetchMock.mock.calls[1][0]).toBe('/api/beans');
		expect(requestPayload(fetchMock, 1)).toEqual(requestPayload(fetchMock, 0));
	});

	it('retries the persisted catalog reservation envelope after remount', async () => {
		const request = {
			batchId: UUIDS[0],
			purchaseDate: '2026-08-29',
			taxShipTotal: 5.01,
			items: [{ rowId: UUIDS[1], catalogId: 101, qty: 2, cost: 10 }]
		};
		storeReservation('purveyors:pending-catalog-inventory-batch:user-a', request);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(201, lifecycle(UUIDS[0], 'in_progress')))
			.mockResolvedValueOnce(response(200, lifecycle(UUIDS[0], 'completed')));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();
		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit,
			catalogBeans: CATALOG_BEANS,
			ownerId: 'user-a'
		});

		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent('exact reservation can be retried')
		);
		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(fetchMock.mock.calls[0][0]).toBe('/api/beans');
		expect(requestPayload(fetchMock, 0)).toEqual(request);
		expect(fetchMock.mock.calls[1]).toEqual([
			`/api/beans?catalogBatchId=${UUIDS[0]}`,
			{ method: 'POST' }
		]);
		expect(onSubmit).toHaveBeenCalledWith([]);
		expect(sessionStorage.getItem('purveyors:pending-catalog-inventory-batch:user-a')).toBeNull();
	});

	it('reconciles a persisted UUID after reload and keeps unknown nonterminal', async () => {
		sessionStorage.setItem('purveyors:pending-catalog-inventory-batch:user-a', UUIDS[0]);
		const fetchMock = vi.fn().mockResolvedValue(response(200, lifecycle(UUIDS[0], 'unknown')));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();
		const onClose = vi.fn();

		const { container } = render(BeanForm, {
			bean: null,
			onClose,
			onSubmit,
			catalogBeans: CATALOG_BEANS,
			ownerId: 'user-a'
		});
		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent('A catalog batch is reserved')
		);
		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

		expect(fetchMock.mock.calls[0]).toEqual([`/api/beans?catalogBatchId=${UUIDS[0]}`]);
		expect(sessionStorage.getItem('purveyors:pending-catalog-inventory-batch:user-a')).toBe(
			UUIDS[0]
		);
		expect(onSubmit).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('keeps a rejected draft editable and submits corrected intent under a fresh UUID', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2])
			.mockReturnValueOnce(UUIDS[3]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(201, lifecycle(UUIDS[0], 'terminal_rejected')))
			.mockResolvedValueOnce(response(201, lifecycle(UUIDS[2], 'accepted')))
			.mockResolvedValueOnce(response(200, lifecycle(UUIDS[2], 'completed')));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit,
			catalogBeans: CATALOG_BEANS,
			ownerId: 'user-a'
		});
		await selectCatalogRows([101]);
		const form = container.querySelector('form')!;
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(screen.getByLabelText('Purchased Quantity (lbs)')).not.toBeDisabled();

		await fireEvent.input(screen.getByLabelText('Purchased Quantity (lbs)'), {
			target: { value: '2' }
		});
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

		expect(requestPayload(fetchMock, 0).batchId).toBe(UUIDS[0]);
		expect(requestPayload(fetchMock, 1).batchId).toBe(UUIDS[2]);
		expect(onSubmit).toHaveBeenCalledOnce();
	});
});
