import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import NavigationSkeletonOverlayHarness from './NavigationSkeletonOverlayHarness.test.svelte';

describe('NavigationSkeletonOverlay', () => {
	it('keeps source-route state mounted and makes it inert while the delayed skeleton is visible', async () => {
		const view = render(NavigationSkeletonOverlayHarness, { active: false });
		const input = screen.getByLabelText('Draft name') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'Unsaved roast' } });

		await view.rerender({ active: true });

		expect(screen.getByLabelText('Draft name')).toBe(input);
		expect(input).toHaveValue('Unsaved roast');
		expect(screen.getByTestId('navigation-source-route')).toHaveAttribute('inert');
		expect(screen.getByTestId('navigation-source-route')).toHaveAttribute('aria-hidden', 'true');
		expect(screen.getByRole('status')).toHaveTextContent('Loading destination page');

		await view.rerender({ active: false });
		expect(screen.getByLabelText('Draft name')).toBe(input);
		expect(input).toHaveValue('Unsaved roast');
		expect(screen.queryByTestId('navigation-skeleton-overlay')).not.toBeInTheDocument();
	});
});
