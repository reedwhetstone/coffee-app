import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MemoryPanel from './MemoryPanel.svelte';

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe('MemoryPanel keyboard ownership', () => {
	it('handles Escape and traps Tab inside the nested dialog', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ content: '' })));
		render(MemoryPanel, { open: true });

		const dialog = await screen.findByRole('dialog', { name: 'Memory document' });
		await waitFor(() => expect(screen.getByRole('button', { name: 'Close memory' })).toHaveFocus());

		const saveButton = screen.getByRole('button', { name: 'Save' });
		saveButton.focus();
		await fireEvent.keyDown(saveButton, { key: 'Tab' });
		expect(screen.getByRole('button', { name: 'Close memory' })).toHaveFocus();

		const closeButton = screen.getByRole('button', { name: 'Close memory' });
		closeButton.focus();
		await fireEvent.keyDown(closeButton, { key: 'Tab', shiftKey: true });
		expect(saveButton).toHaveFocus();

		await fireEvent.keyDown(dialog, { key: 'Escape' });
		expect(screen.queryByRole('dialog', { name: 'Memory document' })).not.toBeInTheDocument();
	});
});
