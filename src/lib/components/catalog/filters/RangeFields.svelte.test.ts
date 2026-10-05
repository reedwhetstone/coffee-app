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
});
