import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import ChatDrawer from './ChatDrawer.svelte';
import { pageChatContext } from '$lib/stores/pageContextStore.svelte';

const { goto, pageState, sendMessage } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('https://example.com/catalog') },
	sendMessage: vi.fn()
}));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/state', () => ({ page: pageState }));
vi.mock('@ai-sdk/svelte', () => ({
	Chat: vi.fn().mockImplementation(() => ({
		messages: [],
		status: 'ready',
		sendMessage,
		stop: vi.fn()
	}))
}));
vi.mock('ai', () => ({ DefaultChatTransport: vi.fn() }));
vi.mock('@humanspeak/svelte-markdown', () => ({ default: vi.fn() }));
vi.mock('$lib/components/genui/GenUIBlockRenderer.svelte', () => ({ default: vi.fn() }));
vi.mock('$lib/components/genui/InlineStatusLine.svelte', () => ({ default: vi.fn() }));
vi.mock('$lib/components/canvas/Canvas.svelte', () => ({ default: vi.fn() }));
vi.mock('$lib/components/genui/SuggestionChips.svelte', () => ({ default: vi.fn() }));

describe('ChatDrawer', () => {
	it('renders the drawer chat for entitled users when open', () => {
		render(ChatDrawer, { open: true, role: 'viewer', ppiAccess: true });

		expect(screen.getByRole('complementary', { name: 'Ask Parchment' })).toBeInTheDocument();
		expect(screen.getByRole('textbox')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Open full workspace' })).toHaveAttribute(
			'href',
			'/chat'
		);
	});

	it('renders nothing when closed', () => {
		render(ChatDrawer, { open: false, role: 'member', ppiAccess: true });

		expect(screen.queryByRole('complementary', { name: 'Ask Parchment' })).toBeNull();
	});

	it('renders nothing for users without chat access even when open', () => {
		render(ChatDrawer, { open: true, role: 'viewer', ppiAccess: false });

		expect(screen.queryByRole('complementary', { name: 'Ask Parchment' })).toBeNull();
	});
});

describe('ChatDrawer context chips', () => {
	afterEach(() => {
		pageChatContext.clear();
	});

	it('shows a toggleable chip for the published page context', async () => {
		pageChatContext.set({
			surface: 'catalog',
			summary: 'Green coffee catalog filtered by country: Ethiopia — 12 coffees in view.'
		});

		render(ChatDrawer, { open: true, role: 'viewer', ppiAccess: true });

		const chip = screen.getByRole('button', { name: /Viewing: catalog/ });
		expect(chip).toHaveAttribute('aria-pressed', 'true');

		await fireEvent.click(chip);
		expect(chip).toHaveAttribute('aria-pressed', 'false');
	});
});
