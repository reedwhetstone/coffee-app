import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import RangeFields from './RangeFields.svelte';

const baseProps = {
	legend: 'Growing elevation',
	idPrefix: 'test-elevation',
	unit: 'elevation'
};

const lowest = () => screen.getByLabelText('Lowest elevation') as HTMLInputElement;
const highest = () => screen.getByLabelText('Highest elevation') as HTMLInputElement;

describe('RangeFields', () => {
	it('holds inverted bounds with an error instead of applying them', async () => {
		const onChange = vi.fn();
		render(RangeFields, { ...baseProps, min: '1200', max: '1900', onChange });

		await fireEvent.change(lowest(), { target: { value: '2500' } });

		expect(onChange).not.toHaveBeenCalled();
		expect(lowest().value).toBe('2500');
		expect(screen.getByRole('alert')).toHaveTextContent(
			'The lowest elevation cannot be above the highest.'
		);

		await fireEvent.change(highest(), { target: { value: '3000' } });

		expect(onChange).toHaveBeenCalledWith({ min: '2500', max: '3000', includeUnknown: false });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('discards inverted bounds when the applied range changes', async () => {
		const onChange = vi.fn();
		const { rerender } = render(RangeFields, {
			...baseProps,
			min: '1200',
			max: '1900',
			onChange
		});
		await fireEvent.change(lowest(), { target: { value: '2500' } });
		expect(screen.getByRole('alert')).toBeInTheDocument();

		// The filter was cleared somewhere else, such as its chip or "Clear all".
		await rerender({ ...baseProps, min: '', max: '', onChange });

		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		expect(lowest().value).toBe('');
		expect(highest().value).toBe('');

		// A later edit starts from the cleared range, not the discarded bounds.
		await fireEvent.change(highest(), { target: { value: '1500' } });
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith({ min: '', max: '1500', includeUnknown: false });
	});

	it('holds a bound outside a ruled range with an error instead of applying it', async () => {
		const onChange = vi.fn();
		render(RangeFields, {
			legend: 'Screen size',
			idPrefix: 'test-screen',
			unit: 'screen size',
			step: 1,
			lowest: 8,
			highest: 20,
			min: '',
			max: '',
			outOfRangeText: 'Screen size is a whole number from 8 to 20.',
			onChange
		});
		const low = screen.getByLabelText('Lowest screen size') as HTMLInputElement;
		const high = screen.getByLabelText('Highest screen size') as HTMLInputElement;

		for (const typed of ['7', '15.5', '21']) {
			await fireEvent.change(low, { target: { value: typed } });
			expect(onChange).not.toHaveBeenCalled();
			expect(low.value).toBe(typed);
			expect(screen.getByRole('alert')).toHaveTextContent(
				'Screen size is a whole number from 8 to 20.'
			);
		}

		await fireEvent.change(high, { target: { value: '18' } });
		expect(onChange).not.toHaveBeenCalled();

		await fireEvent.change(low, { target: { value: '15' } });
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith({ min: '15', max: '18', includeUnknown: false });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('applies any bound when the range has no ruled limits', async () => {
		const onChange = vi.fn();
		render(RangeFields, { ...baseProps, step: 50, highest: 3000, min: '', max: '', onChange });

		await fireEvent.change(lowest(), { target: { value: '1234' } });

		expect(onChange).toHaveBeenCalledWith({ min: '1234', max: '', includeUnknown: false });
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});
});
