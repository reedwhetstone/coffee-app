import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoastCreatePayload } from '$lib/roast/create-operation';
import RoastProfileForm from './RoastProfileForm.svelte';

const recoveredPayload = JSON.stringify({
	batch_name: 'Morning batch',
	batch_beans: [
		{ coffee_id: 7, coffee_name: 'Ethiopia', oz_in: 12, oz_out: null },
		{ coffee_id: 8, coffee_name: 'Colombia', oz_in: null, oz_out: 9 }
	],
	roast_date: '2026-09-01',
	roast_notes: 'Keep an eye on first crack',
	roast_targets: 'Development time'
});

const availableCoffees = [
	{ id: 7, name: 'Ethiopia', stocked: true },
	{ id: 8, name: 'Colombia', stocked: true }
];

describe('RoastProfileForm recovery', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.stubGlobal(
			'confirm',
			vi.fn(() => true)
		);
	});

	it('restores the exact persisted payload and retries it without editing', async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const onDiscardPending = vi.fn();
		const { container } = render(RoastProfileForm, {
			selectedBean: null,
			availableCoffees,
			onClose: vi.fn(),
			onSubmit,
			initialPayload: recoveredPayload,
			onDiscardPending
		});

		await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('retry it exactly'));
		expect(screen.getByLabelText('Batch Name')).toHaveValue('Morning batch');
		expect(screen.getByLabelText('Roast Date')).toHaveValue('2026-09-01');
		expect(screen.getAllByLabelText('Select Coffee')).toHaveLength(2);
		expect(screen.getAllByLabelText('Green Weight (oz)')[0]).toHaveValue(12);
		expect(screen.getAllByLabelText('Roasted Weight (oz)')[1]).toHaveValue(9);
		expect(screen.getByLabelText('Batch Name')).toBeDisabled();

		await fireEvent.submit(container.querySelector('form')!);
		await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());

		expect(onSubmit.mock.calls[0][0]).toEqual(JSON.parse(recoveredPayload) as RoastCreatePayload);
		expect(onSubmit.mock.calls[0][1]).toBe(recoveredPayload);

		await fireEvent.click(screen.getByRole('button', { name: 'Discard saved batch' }));
		expect(onDiscardPending).toHaveBeenCalledOnce();
		await waitFor(() => expect(screen.queryByText(/retry it exactly/)).not.toBeInTheDocument());
		expect(screen.getByLabelText('Batch Name')).not.toBeDisabled();
	});

	it('refreshes the selected profile after a batch Artisan upload', async () => {
		const onSubmit = vi.fn().mockResolvedValue({
			roast_ids: [42],
			profiles: [{ last_updated: '2026-09-01T19:00:00.000Z' }]
		});
		const onArtisanImportComplete = vi.fn().mockResolvedValue(undefined);
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response(JSON.stringify({ imported: true }), { status: 200 }))
		);
		const { container } = render(RoastProfileForm, {
			selectedBean: { id: 7, name: 'Ethiopia' },
			availableCoffees,
			onClose: vi.fn(),
			onSubmit,
			onArtisanImportComplete
		});

		const file = new File(['artisan'], 'roast.alog', { type: 'application/json' });
		await fireEvent.change(screen.getByLabelText('Artisan Roast Log (Optional)'), {
			target: { files: [file] }
		});
		await fireEvent.submit(container.querySelector('form')!);

		await waitFor(() => expect(onArtisanImportComplete).toHaveBeenCalledWith(42));
	});
});
