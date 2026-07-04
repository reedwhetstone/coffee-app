import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import NavigationProgress from './NavigationProgress.svelte';

describe('NavigationProgress', () => {
	it('is hidden when no navigation is pending', () => {
		render(NavigationProgress, { active: false });
		expect(screen.queryByRole('progressbar')).toBeNull();
	});

	it('shows an accessible progress bar while navigation is pending', () => {
		render(NavigationProgress, { active: true });
		const bar = screen.getByRole('progressbar', { name: 'Page loading' });
		expect(bar).toBeInTheDocument();
		expect(bar).toHaveAttribute('aria-live', 'polite');
	});

	it('defaults to hidden when no active prop is provided', () => {
		render(NavigationProgress);
		expect(screen.queryByRole('progressbar')).toBeNull();
	});
});
