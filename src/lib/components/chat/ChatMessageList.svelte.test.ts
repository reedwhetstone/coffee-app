import { fireEvent, render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ChatMessageList from './ChatMessageList.svelte';
import { canvasStore } from '$lib/stores/canvasStore.svelte';

vi.mock('@humanspeak/svelte-markdown', () => ({ default: vi.fn() }));
vi.mock('$lib/components/genui/InlineStatusLine.svelte', () => ({ default: vi.fn() }));

function props(messages: Array<Record<string, unknown>> = []) {
	return {
		chat: { messages, status: 'ready' } as never,
		isActive: false,
		canUseMallardWorkspaces: false,
		onScroll: vi.fn(),
		onBlockAction: vi.fn(),
		onExecuteAction: vi.fn(),
		onExampleSelect: vi.fn(),
		onAskAgainMessage: vi.fn(),
		messageActionsDisabled: false
	};
}

describe('ChatMessageList conversation controls', () => {
	beforeEach(() => {
		canvasStore.resetAll();
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: vi.fn().mockResolvedValue(undefined) }
		});
	});

	it('shows four compact starter prompts', () => {
		render(ChatMessageList, props());
		expect(screen.getByRole('button', { name: 'Compare stocked Ethiopian coffees' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Find gaps in my current portfolio' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Review this week’s market movement' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Build a sourcing shortlist' })).toBeTruthy();
	});

	it('offers copy and parent-owned ask-again only for a completed assistant response', async () => {
		const componentProps = props([
			{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Find coffees' }] },
			{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Two options.' }] }
		]);
		render(ChatMessageList, componentProps);

		await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
		expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Two options.');
		expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Ask again' }));
		expect(componentProps.onAskAgainMessage).toHaveBeenCalledWith('assistant-1');
	});

	it('reports clipboard failures without rejecting the click handler', async () => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }
		});
		render(
			ChatMessageList,
			props([
				{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Evidence.' }] }
			])
		);

		await fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
		expect(screen.getByRole('button', { name: 'Copy failed' })).toBeTruthy();
	});

	it('disables ask-again while another chat action is active', () => {
		const componentProps = props([
			{ id: 'assistant-1', role: 'assistant', parts: [{ type: 'text', text: 'Evidence.' }] }
		]);
		componentProps.messageActionsDisabled = true;
		render(ChatMessageList, componentProps);

		expect(screen.getByRole('button', { name: 'Ask again' })).toBeDisabled();
	});

	it('maps primary, companion, and later previews to canvas IDs in dispatch order', async () => {
		const messageId = 'assistant-tools';
		const roastPart = {
			type: 'tool-roast_profiles',
			toolName: 'roast_profiles',
			toolCallId: 'roast-call',
			state: 'output-available',
			output: {
				profiles: [{ roast_id: 42, batch_name: 'Batch 42' }]
			}
		};
		const laterPart = {
			type: 'tool-coffee_catalog_search',
			toolName: 'coffee_catalog_search',
			toolCallId: 'coffee-call',
			state: 'output-available',
			output: { coffees: [{ id: 7, name: 'Later coffee', country: 'Ethiopia' }] }
		};
		const messages = [
			{
				id: messageId,
				role: 'assistant',
				parts: [
					{ type: 'tool-failed_lookup', state: 'output-error', errorText: 'Lookup failed' },
					roastPart,
					laterPart
				]
			}
		];

		canvasStore.dispatch({
			type: 'add',
			messageId,
			block: {
				type: 'roast-profiles',
				version: 1,
				data: [{ roast_id: '42', batch_name: 'Batch 42' } as never]
			}
		});
		canvasStore.dispatch({
			type: 'add',
			messageId,
			block: { type: 'roast-chart', version: 1, data: { roastId: 42 } }
		});
		canvasStore.dispatch({
			type: 'add',
			messageId,
			block: {
				type: 'coffee-cards',
				version: 1,
				data: [{ id: 7, name: 'Later coffee', country: 'Ethiopia' } as never]
			}
		});
		const [roastId, chartId, laterId] = canvasStore.blocks.map((block) => block.id);
		const componentProps = props(messages);
		render(ChatMessageList, componentProps);

		await fireEvent.click(screen.getByRole('button', { name: /Batch 42/ }));
		await fireEvent.click(screen.getByRole('button', { name: /Roast #42 chart/ }));
		await fireEvent.click(screen.getByRole('button', { name: /Later coffee Ethiopia/ }));

		expect(componentProps.onBlockAction.mock.calls).toEqual([
			[{ type: 'focus-canvas-block', blockId: roastId }],
			[{ type: 'focus-canvas-block', blockId: chartId }],
			[{ type: 'focus-canvas-block', blockId: laterId }]
		]);
	});

	it('disables compact evidence links after their canvas targets are cleared', () => {
		const messages = [
			{
				id: 'assistant-tools',
				role: 'assistant',
				parts: [
					{
						type: 'tool-coffee_catalog_search',
						toolName: 'coffee_catalog_search',
						toolCallId: 'coffee-call',
						state: 'output-available',
						output: { coffees: [{ id: 7, name: 'Older coffee', country: 'Ethiopia' }] }
					}
				]
			}
		];

		render(ChatMessageList, props(messages));

		expect(screen.getByRole('button', { name: /Older coffee Ethiopia/ })).toBeDisabled();
	});
});
