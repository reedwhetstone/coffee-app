import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BeanForm from './BeanForm.svelte';

const UUIDS = [
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000002',
	'00000000-0000-4000-8000-000000000003'
] as const;

function response(ok: boolean, body: unknown, status = ok ? 200 : 503) {
	return {
		ok,
		status,
		json: vi.fn().mockResolvedValue(body)
	};
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

function idempotencyKey(fetchMock: ReturnType<typeof vi.fn>, call: number): string | undefined {
	const options = fetchMock.mock.calls[call][1] as { headers?: Record<string, string> };
	return options.headers?.['Idempotency-Key'];
}

function requestPayload(
	fetchMock: ReturnType<typeof vi.fn>,
	call: number
): Record<string, unknown> {
	const options = fetchMock.mock.calls[call][1] as { body?: string };
	return JSON.parse(options.body ?? '{}') as Record<string, unknown>;
}

describe('BeanForm manual-create idempotency', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(globalThis.crypto, 'randomUUID')
			.mockReturnValueOnce(UUIDS[0])
			.mockReturnValueOnce(UUIDS[1])
			.mockReturnValueOnce(UUIDS[2]);
		vi.stubGlobal('alert', vi.fn());
	});

	it('reuses the same key when a manual create is retried after an uncertain failure', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(false, { error: 'Connection interrupted' }))
			.mockResolvedValueOnce(response(true, { id: 42 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: []
		});
		await fillManualRows(['Retry lot']);
		await fireEvent.input(screen.getByLabelText('Total Tax & Shipping ($)'), {
			target: { value: '3' }
		});

		const form = container.querySelector('form');
		expect(form).not.toBeNull();
		await fireEvent.submit(form!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await fireEvent.submit(form!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(idempotencyKey(fetchMock, 0)).toBe(UUIDS[0]);
		expect(idempotencyKey(fetchMock, 1)).toBe(UUIDS[0]);
		expect(requestPayload(fetchMock, 0).tax_ship_cost).toBe(3);
		expect(requestPayload(fetchMock, 1).tax_ship_cost).toBe(3);
	});

	it('resets retry state after a definitive validation error', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(false, { error: 'Invalid score' }, 422))
			.mockResolvedValueOnce(response(true, { id: 42 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: []
		});
		await fillManualRows(['Invalid lot']);

		const form = container.querySelector('form');
		expect(form).not.toBeNull();
		await fireEvent.submit(form!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		await fireEvent.input(screen.getByLabelText('Coffee Name'), {
			target: { value: 'Corrected lot' }
		});
		await fireEvent.submit(form!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		expect(idempotencyKey(fetchMock, 0)).toBe(UUIDS[0]);
		expect(idempotencyKey(fetchMock, 1)).toBe(UUIDS[1]);
		expect(requestPayload(fetchMock, 0).manual_name).toBe('Invalid lot');
		expect(requestPayload(fetchMock, 1).manual_name).toBe('Corrected lot');
	});

	it('keeps surviving row keys aligned and gives a replacement row a fresh key', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(response(true, { id: 41 }))
			.mockResolvedValueOnce(response(false, { error: 'Connection interrupted' }))
			.mockResolvedValueOnce(response(true, { id: 41 }))
			.mockResolvedValueOnce(response(true, { id: 43 }));
		vi.stubGlobal('fetch', fetchMock);

		const { container } = render(BeanForm, {
			bean: null,
			onClose: vi.fn(),
			onSubmit: vi.fn(),
			catalogBeans: []
		});
		const addRowButton = Array.from(container.querySelectorAll('button')).find((button) =>
			button.textContent?.includes('+')
		);
		expect(addRowButton).toBeDefined();
		await fireEvent.click(addRowButton!);
		await fireEvent.click(addRowButton!);
		await fillManualRows(['First lot', 'Removed lot', 'Replacement lot']);
		await fireEvent.input(screen.getByLabelText('Total Tax & Shipping ($)'), {
			target: { value: '9' }
		});

		const form = container.querySelector('form');
		expect(form).not.toBeNull();
		await fireEvent.submit(form!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

		await fireEvent.click(screen.getAllByRole('button', { name: '✕' })[0]);
		await fireEvent.submit(form!);
		await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

		expect(idempotencyKey(fetchMock, 0)).toBe(UUIDS[0]);
		expect(idempotencyKey(fetchMock, 1)).toBe(UUIDS[1]);
		expect(idempotencyKey(fetchMock, 2)).toBe(UUIDS[2]);
		expect(requestPayload(fetchMock, 0).tax_ship_cost).toBe(3);
		expect(requestPayload(fetchMock, 1).tax_ship_cost).toBe(3);
		expect(requestPayload(fetchMock, 2).tax_ship_cost).toBe(4.5);
	});
});
