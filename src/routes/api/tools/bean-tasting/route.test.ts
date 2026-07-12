import { describe, expect, it, vi } from 'vitest';
import { toLegacyTastingEnvelope } from '$lib/services/tools/tastingEnvelope';
import { _readLegacyTasting } from './+server';

const tasting = {
	beanId: 42,
	filter: 'both' as const,
	supplier: {
		source: 'supplier' as const,
		catalogId: 42,
		name: 'Kenya AA',
		processing: 'Washed',
		region: 'Nyeri',
		sourceName: 'Supplier A',
		cupping_notes: 'Blackcurrant',
		ai_tasting_notes: { body: 7, acidity: 9 },
		ai_description: 'Bright'
	},
	user: {
		source: 'user' as const,
		inventoryId: 1,
		catalogId: 42,
		notes: 'Juicy',
		cupping_notes: 'Berry'
	}
};

describe('bean tasting legacy envelope', () => {
	it('preserves the compatibility keys for both notes', () => {
		const result = toLegacyTastingEnvelope(tasting, 'both', true);
		expect(Object.keys(result)).toEqual([
			'bean_info',
			'tasting_notes',
			'radar_data',
			'filter_applied',
			'message'
		]);
		expect(result.bean_info).toEqual({
			id: 42,
			name: 'Kenya AA',
			processing: 'Washed',
			region: 'Nyeri',
			source: 'Supplier A'
		});
		expect(result.radar_data).toEqual({
			body: 7,
			flavor: 0,
			acidity: 9,
			sweetness: 0,
			fragrance_aroma: 0
		});
		expect(result.tasting_notes).toMatchObject({
			user_notes: { notes: 'Juicy' },
			supplier_notes: { cupping_notes: 'Blackcurrant' }
		});
	});

	it('keeps catalog and AI context but does not leak supplier notes for user-only output', () => {
		const result = toLegacyTastingEnvelope(tasting, 'user', true);
		expect(result.bean_info.name).toBe('Kenya AA');
		expect(result.tasting_notes).toMatchObject({
			user_notes: { notes: 'Juicy' },
			ai_notes: { description: 'Bright' }
		});
		expect(result.tasting_notes).not.toHaveProperty('supplier_notes');
		expect(result.filter_applied).toBe('user');
	});

	it('returns supplier and AI context without user notes for supplier-only output', () => {
		const result = toLegacyTastingEnvelope(tasting, 'supplier', true);
		expect(result.tasting_notes).toMatchObject({
			supplier_notes: { cupping_notes: 'Blackcurrant' },
			ai_notes: { description: 'Bright' }
		});
		expect(result.tasting_notes).not.toHaveProperty('user_notes');
		expect(result.filter_applied).toBe('supplier');
	});

	it('honors include_radar_data=false', () => {
		expect(toLegacyTastingEnvelope(tasting, 'both', false).radar_data).toBeUndefined();
	});

	it('preserves legacy not-found behavior when canonical catalog context is missing', () => {
		expect(() =>
			toLegacyTastingEnvelope({ ...tasting, filter: 'user', supplier: null }, 'user', true)
		).toThrow('No coffee found with bean_id: 42');
		try {
			toLegacyTastingEnvelope({ ...tasting, filter: 'user', supplier: null }, 'user', true);
		} catch (error) {
			expect(error).toMatchObject({ status: 404 });
		}
	});

	it('fetches canonical both context even for a user-only legacy request', async () => {
		const get = vi.fn().mockResolvedValue({ data: { data: tasting } });
		const result = await _readLegacyTasting({ tasting: { get } } as never, 42, 'user', false);
		expect(get).toHaveBeenCalledWith('42', { filter: 'both' });
		expect(result.filter_applied).toBe('user');
		expect(result.tasting_notes).not.toHaveProperty('supplier_notes');
	});

	it('maps an SDK catalog 404 to the legacy route error status', async () => {
		const get = vi.fn().mockResolvedValue({
			error: { error: { message: 'not found' } },
			response: { status: 404 }
		});
		await expect(
			_readLegacyTasting({ tasting: { get } } as never, 404, 'user', true)
		).rejects.toMatchObject({ status: 404 });
	});
});
