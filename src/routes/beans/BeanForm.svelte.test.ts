import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BeanForm from './BeanForm.svelte';

const UUIDS = [
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000002',
	'00000000-0000-4000-8000-000000000003',
	'00000000-0000-4000-8000-000000000004'
] as const;

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

describe('BeanForm atomic manual inventory batches', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal('alert', vi.fn());
		sessionStorage.clear();
	});

	it('submits every manual row once with one batch UUID and a shared exact-cent total', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2]);
		const created = [{ id: 41 }, { id: 42 }];
		const fetchMock = vi.fn().mockResolvedValue(response(201, created));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit,
			catalogBeans: []
		});
		await fireEvent.click(screen.getAllByRole('button', { name: /Add Bean/ })[0]);
		await fillManualRows(['First lot', 'Second lot']);
		await fireEvent.input(screen.getByLabelText('Total Tax & Shipping ($)'), {
			target: { value: '5.01' }
		});

		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

		const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('/api/beans');
		expect(options.method).toBe('POST');
		expect(options.headers).toEqual({
			'Content-Type': 'application/json',
			'Idempotency-Key': UUIDS[0]
		});
		expect(requestPayload(fetchMock, 0)).toMatchObject({
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
		expect(onSubmit).toHaveBeenCalledWith(created);
	});

	it('shows exact-cent allocation copy only for manual batches', async () => {
		render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: []
		});

		expect(
			screen.getByText('Parchment will allocate this total across the manual batch in exact cents')
		).toBeInTheDocument();

		await fireEvent.click(screen.getByText('Select from Catalog'));

		expect(
			screen.queryByText(
				'Parchment will allocate this total across the manual batch in exact cents'
			)
		).not.toBeInTheDocument();
		expect(
			screen.getByText('This total will be divided evenly across catalog items')
		).toBeInTheDocument();
	});

	it('locks the draft after an uncertain batch instead of allowing edits before reconciliation', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2]);
		const committed = [{ id: 41 }, { id: 42 }];
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(503, { error: 'Response was uncertain' }))
			.mockResolvedValueOnce(response(200, committed));
		vi.stubGlobal('fetch', fetchMock);
		const onSubmit = vi.fn();

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit,
			catalogBeans: []
		});
		await fireEvent.click(screen.getAllByRole('button', { name: /Add Bean/ })[0]);
		await fillManualRows(['Committed first lot', 'Committed second lot']);

		const form = container.querySelector('form')!;
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		expect(screen.getByRole('status')).toHaveTextContent(
			'Editing is locked until it is reconciled'
		);
		expect(screen.getAllByLabelText('Coffee Name')[0]).toBeDisabled();
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(fetchMock.mock.calls[1][0]).toBe(`/api/beans?manualBatchId=${UUIDS[0]}`);
		expect(fetchMock.mock.calls[1][1]).toBeUndefined();
		expect(
			fetchMock.mock.calls.filter(
				([, options]) => (options as RequestInit | undefined)?.method === 'POST'
			)
		).toHaveLength(1);
		expect(onSubmit).toHaveBeenCalledWith(committed);
	});

	it('reconciles the same uncertain batch after the form is canceled and reopened', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1]);
		const committed = [{ id: 41 }];
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(503, { error: 'Response was uncertain' }))
			.mockResolvedValueOnce(response(200, committed));
		vi.stubGlobal('fetch', fetchMock);
		const firstClose = vi.fn();

		const first = render(BeanForm, {
			bean: null,
			onClose: firstClose,
			onSubmit: vi.fn(),
			catalogBeans: []
		});
		await fillManualRows(['Committed lot']);
		await fireEvent.submit(first.container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(firstClose).toHaveBeenCalledOnce();
		first.unmount();

		const onSubmit = vi.fn();
		const reopened = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit,
			catalogBeans: []
		});
		expect(screen.getByRole('status')).toHaveTextContent(
			'Editing is locked until it is reconciled'
		);
		expect(screen.getByLabelText('Coffee Name')).toBeDisabled();
		await fireEvent.submit(reopened.container.querySelector('form')!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(fetchMock.mock.calls[1][0]).toBe(`/api/beans?manualBatchId=${UUIDS[0]}`);
		expect(
			fetchMock.mock.calls.filter(
				([, options]) => (options as RequestInit | undefined)?.method === 'POST'
			)
		).toHaveLength(1);
		expect(onSubmit).toHaveBeenCalledWith(committed);
	});

	it('uses a fresh batch UUID after a definitive validation rejection', async () => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2])
			.mockReturnValueOnce(UUIDS[3]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(400, { error: 'Invalid manual batch' }))
			.mockResolvedValueOnce(response(201, [{ id: 42 }]));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: []
		});
		await fillManualRows(['Invalid lot']);

		const form = container.querySelector('form')!;
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.input(screen.getByLabelText('Coffee Name'), {
			target: { value: 'Corrected lot' }
		});
		await fireEvent.submit(form);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		const firstHeaders = fetchMock.mock.calls[0][1].headers as Record<string, string>;
		const secondHeaders = fetchMock.mock.calls[1][1].headers as Record<string, string>;
		expect(firstHeaders['Idempotency-Key']).toBe(UUIDS[0]);
		expect(secondHeaders['Idempotency-Key']).toBe(UUIDS[2]);
		expect(requestPayload(fetchMock, 1)).toMatchObject({
			items: [{ rowId: UUIDS[3], manualCoffee: { name: 'Corrected lot' } }]
		});
	});

	it.each([
		[401, { error: 'Session expired' }],
		[403, { error: 'Access check unavailable' }],
		[409, { error: 'Batch is still running', code: 'idempotency_in_progress' }]
	])('retains the batch UUID after retryable reconciliation status %i', async (status, error) => {
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1]);
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(status, error))
			.mockResolvedValueOnce(response(200, [{ id: 42 }]));
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
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(fetchMock.mock.calls[1][0]).toBe(`/api/beans?manualBatchId=${UUIDS[0]}`);
		expect(
			fetchMock.mock.calls.filter(
				([, options]) => (options as RequestInit | undefined)?.method === 'POST'
			)
		).toHaveLength(1);
	});
});
