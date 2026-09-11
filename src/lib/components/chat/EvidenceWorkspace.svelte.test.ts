import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EvidenceWorkspace from './EvidenceWorkspace.svelte';
import { canvasStore } from '$lib/stores/canvasStore.svelte';

beforeEach(() => canvasStore.resetAll());
const props = () => ({
	open: true,
	overlay: false,
	expanded: false,
	canExpand: true,
	onClose: vi.fn(),
	onToggleExpand: vi.fn(),
	onAction: vi.fn(),
	onScrollToMessage: vi.fn(),
	onExecuteAction: vi.fn(async () => ({}))
});
function addProposal() {
	canvasStore.dispatch({
		type: 'add',
		messageId: 'answer',
		title: 'Record sale',
		block: {
			type: 'action-card',
			version: 1,
			data: {
				executionId: 'answer:proposal',
				actionType: 'record_sale',
				summary: 'Record sale',
				fields: [{ key: 'quantity', label: 'Quantity', type: 'number', value: 1, editable: true }],
				status: 'proposed'
			}
		}
	});
}
describe('retained evidence workspace', () => {
	it('keeps edits through close/reopen, expanded/mobile presentation, and incoming replace', async () => {
		addProposal();
		const originalId = canvasStore.focusBlockId;
		const data = props();
		const mounted = render(EvidenceWorkspace, data);
		await fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
		const input = screen.getByRole('spinbutton', { name: 'Quantity' });
		await fireEvent.input(input, { target: { value: '7' } });
		await mounted.rerender({ ...data, open: false });
		expect(screen.queryByRole('spinbutton')).toBeNull();
		canvasStore.dispatch(
			{
				type: 'replace',
				blocks: [
					{
						messageId: 'later',
						title: 'New coffee',
						block: { type: 'coffee-cards', version: 1, data: [] }
					}
				]
			},
			'agent'
		);
		await mounted.rerender({ ...data, overlay: true, expanded: true });
		expect(screen.getByRole('spinbutton')).toBe(input);
		expect(input).toHaveValue(7);
		expect(canvasStore.focusBlockId).toBe(originalId);
		expect(screen.getByRole('dialog', { name: 'Evidence workspace' })).toHaveAttribute(
			'aria-modal',
			'true'
		);
		await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(data.onClose).toHaveBeenCalledOnce();
	});
	it('does not duplicate an in-flight action across visibility changes', async () => {
		addProposal();
		let finish!: (value: unknown) => void;
		const execute = vi.fn(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		const data = { ...props(), onExecuteAction: execute };
		const mounted = render(EvidenceWorkspace, data);
		await fireEvent.click(screen.getByRole('button', { name: 'Execute' }));
		await mounted.rerender({ ...data, open: false });
		await mounted.rerender({ ...data, overlay: true });
		expect(screen.getByText('Processing...')).toBeVisible();
		expect(screen.queryByRole('button', { name: 'Execute' })).toBeNull();
		finish({ success: true });
		await waitFor(() => expect(screen.getByText('Action completed successfully.')).toBeVisible());
		expect(execute).toHaveBeenCalledOnce();
	});
});

it('returns from nested coffee and block details without closing the workspace', async () => {
	canvasStore.dispatch({
		type: 'add',
		messageId: 'answer',
		title: 'Shortlist',
		block: { type: 'coffee-cards', version: 1, data: [{ id: 42, name: 'Colombia' }] as never }
	});
	const data = { ...props(), overlay: true };
	render(EvidenceWorkspace, data);
	const trigger = await screen.findByRole('button', { name: 'View details for Colombia' });
	trigger.focus();
	await fireEvent.click(trigger);
	const coffee = await screen.findByRole('dialog', { name: 'Colombia' });
	await waitFor(() => expect(coffee.contains(document.activeElement)).toBe(true));
	await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
	await waitFor(() => expect(trigger).toHaveFocus());
	expect(screen.queryByRole('dialog', { name: 'Colombia' })).toBeNull();
	expect(data.onClose).not.toHaveBeenCalled();
	await fireEvent.click(trigger);
	await screen.findByRole('dialog', { name: 'Colombia' });
	const backgroundControl = screen.getByRole('button', { name: 'Open active evidence details' });
	await fireEvent.keyDown(backgroundControl, { key: 'Escape' });
	await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Colombia' })).toBeNull());
	expect(data.onClose).not.toHaveBeenCalled();
	const details = screen.getByRole('button', { name: 'Open active evidence details' });
	details.focus();
	await fireEvent.click(details);
	const panel = await screen.findByRole('dialog', { name: 'Shortlist details' });
	await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
	await fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
	await waitFor(() => expect(details).toHaveFocus());
	expect(screen.queryByRole('dialog', { name: 'Shortlist details' })).toBeNull();
	expect(data.onClose).not.toHaveBeenCalled();
});
