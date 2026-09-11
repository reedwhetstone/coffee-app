import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import ChatComposer from './ChatComposer.svelte';

function props(overrides: Record<string, unknown> = {}) {
	return {
		agentName: 'Cherry Green Agent' as const,
		inputMessage: 'Find stocked Ethiopias',
		isActive: false,
		suggestions: [],
		slashCompletions: [],
		chatError: null,
		chatCanRetry: false,
		workspaceError: null,
		workspaceReady: true,
		initializingWorkspace: false,
		onSend: vi.fn(),
		onStop: vi.fn(),
		onRetry: vi.fn(),
		onRetryWorkspace: vi.fn(),
		onDismissError: vi.fn(),
		...overrides
	};
}

describe('ChatComposer recovery controls', () => {
	it('uses a short placeholder without a repeated identity footer', () => {
		render(ChatComposer, props());
		expect(screen.getByRole('textbox', { name: 'Message Cherry Green Agent' })).toHaveAttribute(
			'placeholder',
			'Ask about coffee…'
		);
		expect(screen.queryByText('Cherry Green Agent')).not.toBeInTheDocument();
	});

	it('keeps context in a disclosure and returns focus on Escape without sending', async () => {
		const onToggleChip = vi.fn();
		const onSend = vi.fn();
		render(
			ChatComposer,
			props({
				contextChips: [
					{ id: 'page', label: 'Current view', detail: 'Catalog filters', active: true }
				],
				onToggleChip,
				onSend
			})
		);
		const summary = screen.getByLabelText('Context: using 1 of 1 sources');
		const disclosure = summary.closest('details');
		expect(disclosure).not.toHaveAttribute('open');
		await fireEvent.click(summary);
		expect(disclosure).toHaveAttribute('open');
		const toggle = screen.getByRole('button', { name: 'Current view' });
		toggle.focus();
		await fireEvent.click(toggle);
		expect(onToggleChip).toHaveBeenCalledWith('page');
		expect(disclosure).toHaveAttribute('open');
		await fireEvent.keyDown(toggle, { key: 'Escape' });
		expect(disclosure).not.toHaveAttribute('open');
		expect(summary).toHaveFocus();
		expect(onSend).not.toHaveBeenCalled();
	});

	it('puts suggested prompts into the draft without sending, and closes on outside focus', async () => {
		const onSend = vi.fn();
		render(
			ChatComposer,
			props({ onSend, suggestions: [{ label: 'Compare lots', text: 'Compare these lots' }] })
		);
		const summary = screen.getByLabelText('Suggested prompts');
		await fireEvent.click(summary);
		await fireEvent.click(screen.getByRole('button', { name: 'Compare lots' }));
		expect(screen.getByRole('textbox')).toHaveValue('Compare these lots');
		expect(screen.getByRole('textbox')).toHaveFocus();
		expect(summary.closest('details')).not.toHaveAttribute('open');
		expect(onSend).not.toHaveBeenCalled();
		summary.focus();
		await fireEvent.click(summary);
		screen.getByRole('textbox').focus();
		expect(summary.closest('details')).not.toHaveAttribute('open');
	});

	it('replaces send with an accessible stop control during a turn', async () => {
		const onStop = vi.fn();
		render(ChatComposer, props({ isActive: true, onStop }));
		await fireEvent.click(screen.getByRole('button', { name: 'Stop response' }));
		expect(onStop).toHaveBeenCalledOnce();
	});

	it('offers retry only for recoverable chat failures', () => {
		const { rerender } = render(
			ChatComposer,
			props({ chatError: 'The response took too long.', chatCanRetry: true })
		);
		expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
		rerender(props({ chatError: 'This request needs access.', chatCanRetry: false }));
		expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
	});

	it('gates sending and exposes workspace setup retry when persistence is unavailable', async () => {
		const onRetryWorkspace = vi.fn();
		render(
			ChatComposer,
			props({
				workspaceReady: false,
				workspaceError: 'Failed to create workspace',
				onRetryWorkspace
			})
		);
		expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry setup' }));
		expect(onRetryWorkspace).toHaveBeenCalledOnce();
	});
});
