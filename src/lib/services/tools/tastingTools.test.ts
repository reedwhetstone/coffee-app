import { describe, expect, it, vi } from 'vitest';
import { createTastingTools } from './tastingTools';

describe('bean tasting chat tool', () => {
	it('preserves the radar envelope while reading canonical tasting data through the SDK', async () => {
		const get = vi.fn().mockResolvedValue({
			data: {
				data: {
					beanId: 42,
					filter: 'both',
					supplier: {
						source: 'supplier',
						catalogId: 42,
						name: 'Kenya AA',
						processing: 'Washed',
						region: 'Nyeri',
						sourceName: 'Supplier A',
						cupping_notes: 'Blackcurrant',
						ai_tasting_notes: { body: 7, acidity: 9 },
						ai_description: 'Bright'
					},
					user: null
				}
			}
		});
		const tool = createTastingTools({ tasting: { get } } as never).bean_tasting_notes;
		const execute = tool.execute as unknown as (input: {
			bean_id: number;
			filter: 'user' | 'supplier' | 'both';
		}) => Promise<Record<string, unknown>>;

		const result = await execute({ bean_id: 42, filter: 'supplier' });

		expect(get).toHaveBeenCalledWith('42', { filter: 'both' });
		expect(result).toMatchObject({
			bean_info: { id: 42, name: 'Kenya AA' },
			radar_data: { body: 7, acidity: 9 },
			filter_applied: 'supplier'
		});
	});
});
