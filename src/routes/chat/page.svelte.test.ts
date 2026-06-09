import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import ChatPage from './+page.svelte';
import type { PageData } from './$types';

const { goto, pageState, sendMessage } = vi.hoisted(() => ({
	goto: vi.fn(),
	pageState: { url: new URL('https://example.com/chat') },
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

function createData(overrides: Partial<PageData> = {}): PageData {
	return {
		session: { user: { id: 'user-1' } },
		user: { id: 'user-1' },
		role: 'viewer',
		ppiAccess: true,
		...overrides
	} as unknown as PageData;
}

describe('chat analytics seed', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		pageState.url = new URL('https://example.com/chat');
	});

	it('prefills the input from an analytics prompt for users who can use chat', () => {
		pageState.url = new URL(
			'https://example.com/chat?source=analytics&prompt=Review%20Colombia%20market%20signals'
		);

		render(ChatPage, { data: createData() });

		expect(screen.getByRole('textbox')).toHaveValue('Review Colombia market signals');
	});

	it('does not prefill analytics prompts for signed-in users without chat access', () => {
		pageState.url = new URL(
			'https://example.com/chat?source=analytics&prompt=Review%20Colombia%20market%20signals'
		);

		render(ChatPage, { data: createData({ ppiAccess: false }) });

		expect(screen.queryByRole('textbox')).toBeNull();
		expect(
			screen.getByText(/Chat is available with Parchment Intelligence or Mallard Studio/i)
		).toBeTruthy();
	});
});
