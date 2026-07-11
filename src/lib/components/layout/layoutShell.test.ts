import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import RootLayoutNavigationHarness from './RootLayoutNavigationHarness.test.svelte';

describe('root layout navigation shell lifecycle', () => {
	it('keeps the committed app shell and form node mounted through delayed public navigation cancellation', async () => {
		const view = render(RootLayoutNavigationHarness, {
			committedPathname: '/roast',
			destinationPathname: null,
			active: false
		});
		const input = screen.getByLabelText('Draft roast') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'Do not lose this' } });

		await view.rerender({
			committedPathname: '/roast',
			destinationPathname: '/blog/context-windows',
			active: true
		});

		expect(screen.getByTestId('app-shell')).toBeInTheDocument();
		expect(screen.queryByTestId('public-shell')).not.toBeInTheDocument();
		expect(screen.getByLabelText('Draft roast')).toBe(input);
		expect(input).toHaveValue('Do not lose this');
		expect(screen.getByTestId('navigation-source-route')).toHaveAttribute('inert');

		// Navigation cancellation or redirect clears the pending destination. The
		// same committed source node and its local state become interactive again.
		await view.rerender({
			committedPathname: '/roast',
			destinationPathname: null,
			active: false
		});
		expect(screen.getByLabelText('Draft roast')).toBe(input);
		expect(input).toHaveValue('Do not lose this');
		expect(screen.getByTestId('navigation-source-route')).not.toHaveAttribute('inert');
	});
});
