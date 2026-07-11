import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import RoastProfileForm from './RoastProfileForm.svelte';

describe('RoastProfileForm submission', () => {
	beforeEach(() => {
		vi.stubGlobal('alert', vi.fn());
		vi.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	it('keeps the form open and preserves input when profile creation fails', async () => {
		const onClose = vi.fn();
		const onSubmit = vi.fn().mockRejectedValue(new Error('Create failed'));
		render(RoastProfileForm, {
			onClose,
			onSubmit,
			selectedBean: { id: 42, name: 'Test Coffee' },
			availableCoffees: [{ id: 42, name: 'Test Coffee', stocked: true }]
		});

		const batchName = screen.getByLabelText('Batch Name') as HTMLInputElement;
		await fireEvent.input(batchName, { target: { value: 'Preserved batch' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Create Roast Profile' }));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		await waitFor(() => expect(globalThis.alert).toHaveBeenCalledWith('Create failed'));
		expect(onClose).not.toHaveBeenCalled();
		expect(batchName).toHaveValue('Preserved batch');
		expect(screen.getByRole('button', { name: 'Create Roast Profile' })).toBeEnabled();
	});
});
