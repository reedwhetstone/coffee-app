import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { components } from '@purveyors/sdk';
import ProfilePicker from './ProfilePicker.svelte';
import { buildProfileOptionGroups, type PickerRoast } from '$lib/roast/profile-picker-model';

type Summary = components['schemas']['ReferenceProfileSummary'];

const reference = (id: string, title: string, createdAt: string): Summary => ({
	id,
	title,
	notes: null,
	sourceClass: 'artisan_upload',
	status: 'active',
	currentRevisionId: `${id}-revision`,
	createdAt,
	updatedAt: createdAt
});

const roast = (roast_id: number, roast_date: string, coffee_name: string): PickerRoast => ({
	roast_id,
	coffee_name,
	batch_name: `${coffee_name} - Green Batch - 8/4/2025`,
	roast_date,
	charge_time: 10
});

const groups = buildProfileOptionGroups(
	[
		roast(4100, '2026-08-12', 'Colombia Huila'),
		roast(4529, '2026-09-30', 'Ethiopia Guji Gogogu Natural'),
		roast(4528, '2026-09-30', 'Ethiopia Guji Gogogu Natural')
	],
	[reference('ref-1', 'newnewtest', '2026-09-28T00:00:00Z')]
);

const optionNames = () =>
	screen.getAllByRole('option').map((option) => option.textContent?.replace(/\s+/g, ' ').trim());

afterEach(cleanup);

describe('ProfilePicker', () => {
	it('opens to saved references first, then roasts from most recent, with counts', async () => {
		render(ProfilePicker, { label: 'First profile (A)', groups });

		const input = screen.getByRole('combobox', { name: 'First profile (A)' });
		expect(input).toHaveAttribute('aria-expanded', 'false');
		await fireEvent.focus(input);

		expect(input).toHaveAttribute('aria-expanded', 'true');
		const [references, roasts] = screen.getAllByRole('group');
		expect(references).toHaveAccessibleName(/Saved references/);
		expect(within(references).getByText('1')).toBeInTheDocument();
		expect(roasts).toHaveAccessibleName(/Roasts/);
		expect(within(roasts).getByText('3')).toBeInTheDocument();
		expect(optionNames()).toEqual([
			'newnewtest Artisan file · Saved Sep 28, 2026',
			'Ethiopia Guji Gogogu Natural Roasted Sep 30, 2026 · Green Batch - 8/4/2025 · Roast #4529',
			'Ethiopia Guji Gogogu Natural Roasted Sep 30, 2026 · Green Batch - 8/4/2025 · Roast #4528',
			'Colombia Huila Roasted Aug 12, 2026 · Green Batch - 8/4/2025 · Roast #4100'
		]);
	});

	it('filters as the user types and says how many of each group match', async () => {
		render(ProfilePicker, { label: 'First profile (A)', groups });
		const input = screen.getByRole('combobox');

		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'huila' } });

		expect(optionNames()).toEqual([
			'Colombia Huila Roasted Aug 12, 2026 · Green Batch - 8/4/2025 · Roast #4100'
		]);
		expect(screen.getByText('No saved references match your search.')).toBeInTheDocument();
		expect(screen.getByText('1 of 3')).toBeInTheDocument();
		expect(screen.getByText('0 of 1')).toBeInTheDocument();
	});

	it('chooses with the keyboard and shows the choice with its date and batch', async () => {
		render(ProfilePicker, { label: 'First profile (A)', groups });
		const input = screen.getByRole('combobox') as HTMLInputElement;

		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'guji' } });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		expect(input.getAttribute('aria-activedescendant')).toContain('executed_roast-4528');
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(input).toHaveAttribute('aria-expanded', 'false');
		expect(input.value).toBe('Ethiopia Guji Gogogu Natural');
		expect(
			screen.getByText('Roasted Sep 30, 2026 · Green Batch - 8/4/2025 · Roast #4528')
		).toBeInTheDocument();
	});

	it('chooses with a click and keeps the choice when the search is abandoned', async () => {
		render(ProfilePicker, { label: 'Second profile (B)', groups });
		const input = screen.getByRole('combobox') as HTMLInputElement;

		await fireEvent.focus(input);
		await fireEvent.click(screen.getByRole('option', { name: /newnewtest/ }));
		expect(input.value).toBe('newnewtest');

		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'zzz' } });
		expect(screen.getByText('No roasts match your search.')).toBeInTheDocument();
		await fireEvent.keyDown(input, { key: 'Escape' });

		expect(input).toHaveAttribute('aria-expanded', 'false');
		expect(input.value).toBe('newnewtest');
	});

	it('does not offer the profile already chosen on the other side', async () => {
		render(ProfilePicker, {
			label: 'Second profile (B)',
			groups,
			unavailableValue: 'reference_profile:ref-1'
		});
		const input = screen.getByRole('combobox') as HTMLInputElement;

		await fireEvent.focus(input);
		const taken = screen.getByRole('option', { name: /newnewtest/ });
		expect(taken).toHaveAttribute('aria-disabled', 'true');
		expect(taken).toHaveTextContent('Chosen on the other side');
		await fireEvent.click(taken);

		expect(input).toHaveAttribute('aria-expanded', 'true');
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		expect(input.getAttribute('aria-activedescendant')).toContain('executed_roast-4529');
	});

	it('explains an empty library instead of showing an empty list', async () => {
		render(ProfilePicker, { label: 'First profile (A)', groups: buildProfileOptionGroups([], []) });

		await fireEvent.focus(screen.getByRole('combobox'));

		expect(screen.getByText('No saved references yet.')).toBeInTheDocument();
		expect(screen.getByText('No recorded roasts yet.')).toBeInTheDocument();
	});
});
