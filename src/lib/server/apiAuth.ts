import { createAdminClient } from '$lib/supabase-admin';
import bcrypt from 'bcryptjs';
import type { Database, Json } from '$lib/types/database.types';

const supabase = createAdminClient();

// Type aliases for database operations
type ApiKeyRow = Database['public']['Tables']['api_keys']['Row'];
// API key configuration
export const API_KEY_PREFIX = 'pk_live_';

// API access plans — separate from app roles.
// viewer = Green tier, member = Origin tier, enterprise = Enterprise tier.
export type ApiPlan = 'viewer' | 'member' | 'enterprise';

export interface ApiKeyValidationResult {
	valid: boolean;
	userId?: string;
	keyId?: string;
	keyName?: string;
	permissions?: Json | null;
	error?: string;
}

/**
 * Validate an API key and return user information
 */
export async function validateApiKey(key: string): Promise<ApiKeyValidationResult> {
	try {
		// Basic format validation
		if (!key.startsWith(API_KEY_PREFIX)) {
			return { valid: false, error: 'Invalid API key format' };
		}

		// Type alias for the select result
		type ApiKeySelectResult = Pick<
			ApiKeyRow,
			'id' | 'user_id' | 'key_hash' | 'is_active' | 'last_used_at' | 'name' | 'permissions'
		>;

		// Get all active API keys (we need to check hashes)
		const { data: apiKeysData, error } = await supabase
			.from('api_keys')
			.select('id, user_id, key_hash, is_active, last_used_at, name, permissions')
			.eq('is_active', true);

		const apiKeys = apiKeysData as ApiKeySelectResult[] | null;

		if (error || !apiKeys) {
			console.error('Error fetching API keys:', error);
			return { valid: false, error: 'Database error' };
		}

		// Check each key hash
		for (const apiKey of apiKeys) {
			const isMatch = await bcrypt.compare(key, apiKey.key_hash);
			if (isMatch) {
				// Update last used timestamp
				await supabase
					.from('api_keys')
					.update({ last_used_at: new Date().toISOString() })
					.eq('id', apiKey.id);

				return {
					valid: true,
					userId: apiKey.user_id ?? undefined,
					keyId: apiKey.id,
					keyName: apiKey.name,
					permissions: apiKey.permissions
				};
			}
		}

		return { valid: false, error: 'Invalid API key' };
	} catch (error) {
		console.error('API key validation error:', error);
		return { valid: false, error: 'Validation failed' };
	}
}
