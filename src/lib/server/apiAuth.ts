import { createAdminClient } from '$lib/supabase-admin';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import type { Database } from '$lib/types/database.types';

const supabase = createAdminClient();

// Type aliases for database operations
type ApiKeyRow = Database['public']['Tables']['api_keys']['Row'];
//type ApiKeyInsert = Database['public']['Tables']['api_keys']['Insert'];
//type ApiKeyUpdate = Database['public']['Tables']['api_keys']['Update'];
//type ApiUsageInsert = Database['public']['Tables']['api_usage']['Insert'];

// API key configuration
const API_KEY_PREFIX = 'pk_live_';
const API_KEY_LENGTH = 32;
const HASH_ROUNDS = 12;

// Rate limiting configuration (requests per month based on APITIER.md)
const RATE_LIMITS = {
	viewer: 200, // Explorer (Free Tier) - basic API access
	'api-member': 10000, // Roaster+ (Pro Tier) - enhanced API access
	'api-enterprise': -1 // Integrate (Enterprise Tier) - unlimited API access
} as const;

// Row limits per API call by tier
const ROW_LIMITS = {
	viewer: 25, // Explorer (Free Tier) - limited rows per call
	'api-member': -1, // Roaster+ (Pro Tier) - unlimited rows
	'api-enterprise': -1 // Integrate (Enterprise Tier) - unlimited rows
} as const;

// Legacy mapping for backward compatibility
const LEGACY_TIER_MAPPING = {
	api_viewer: 'viewer',
	api_member: 'api-member',
	api_enterprise: 'api-enterprise',
	developer: 'api-member',
	growth: 'api-member',
	enterprise: 'api-enterprise',
	api: 'api-member' // Migrate old 'api' role to 'api-member'
} as const;

// Export rate limits and row limits for use in other modules
export const API_RATE_LIMITS = RATE_LIMITS;
export const API_ROW_LIMITS = ROW_LIMITS;

export interface ApiKeyValidationResult {
	valid: boolean;
	userId?: string;
	keyId?: string;
	error?: string;
}

export interface RateLimitResult {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetTime: Date;
	retryAfter?: number;
}

/**
 * Generate a secure API key with prefix
 */
export function generateApiKey(): string {
	const randomPart = randomBytes(API_KEY_LENGTH).toString('hex');
	return `${API_KEY_PREFIX}${randomPart}`;
}

/**
 * Hash an API key for secure storage
 */
export async function hashApiKey(key: string): Promise<string> {
	return bcrypt.hash(key, HASH_ROUNDS);
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
			'id' | 'user_id' | 'key_hash' | 'is_active' | 'last_used_at'
		>;

		// Get all active API keys (we need to check hashes)
		const { data: apiKeysData, error } = await supabase
			.from('api_keys')
			.select('id, user_id, key_hash, is_active, last_used_at')
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
					keyId: apiKey.id
				};
			}
		}

		return { valid: false, error: 'Invalid API key' };
	} catch (error) {
		console.error('API key validation error:', error);
		return { valid: false, error: 'Validation failed' };
	}
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
	userId: string,
	name: string
): Promise<{ success: boolean; apiKey?: string; error?: string }> {
	try {
		const apiKey = generateApiKey();
		const hashedKey = await hashApiKey(apiKey);

		const { error } = await supabase.from('api_keys').insert({
			user_id: userId,
			key_hash: hashedKey,
			name,
			is_active: true,
			permissions: {}
		});

		if (error) {
			console.error('Error creating API key:', error);
			return { success: false, error: 'Failed to create API key' };
		}

		return { success: true, apiKey };
	} catch (error) {
		console.error('API key creation error:', error);
		return { success: false, error: 'Creation failed' };
	}
}

/**
 * Get user's API keys (without revealing the actual keys)
 */
export async function getUserApiKeys(userId: string) {
	try {
		const { data, error } = await supabase
			.from('api_keys')
			.select('id, name, created_at, last_used_at, is_active')
			.eq('user_id', userId)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error fetching user API keys:', error);
			return { success: false, error: 'Failed to fetch API keys' };
		}

		return { success: true, data };
	} catch (error) {
		console.error('Get user API keys error:', error);
		return { success: false, error: 'Fetch failed' };
	}
}

/**
 * Deactivate an API key
 */
export async function deactivateApiKey(userId: string, keyId: string): Promise<boolean> {
	try {
		const { error } = await supabase
			.from('api_keys')
			.update({ is_active: false })
			.eq('id', keyId)
			.eq('user_id', userId); // Ensure user owns the key

		if (error) {
			console.error('Error deactivating API key:', error);
			return false;
		}

		return true;
	} catch (error) {
		console.error('API key deactivation error:', error);
		return false;
	}
}

/**
 * Log API usage
 */
export async function logApiUsage(
	apiKeyId: string,
	endpoint: string,
	statusCode: number,
	responseTimeMs: number,
	userAgent?: string,
	ipAddress?: string
): Promise<void> {
	try {
		await supabase.from('api_usage').insert({
			api_key_id: apiKeyId,
			endpoint,
			status_code: statusCode,
			response_time_ms: responseTimeMs,
			user_agent: userAgent,
			ip_address: ipAddress as unknown
		});
	} catch (error) {
		// Don't throw on logging errors, just log them
		console.error('Error logging API usage:', error);
	}
}

/**
 * Check rate limit for an API key (monthly sliding window)
 */
export async function checkRateLimit(
	apiKeyId: string,
	tier:
		| 'api_viewer'
		| 'api_member'
		| 'api_enterprise'
		| 'developer'
		| 'growth'
		| 'enterprise' = 'api_member'
): Promise<RateLimitResult> {
	try {
		// Handle legacy tier mapping
		const actualTier =
			tier in LEGACY_TIER_MAPPING
				? LEGACY_TIER_MAPPING[tier as keyof typeof LEGACY_TIER_MAPPING]
				: (tier as keyof typeof RATE_LIMITS);

		const limit = RATE_LIMITS[actualTier];

		// Enterprise tier has unlimited requests
		if (limit === -1) {
			return {
				allowed: true,
				limit: -1,
				remaining: -1,
				resetTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next month
			};
		}

		// Count requests in the current month
		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

		const { error, count } = await supabase
			.from('api_usage')
			.select('*', { count: 'exact', head: true })
			.eq('api_key_id', apiKeyId)
			.gte('timestamp', startOfMonth.toISOString());

		if (error) {
			console.error('Error checking rate limit:', error);
			// On error, allow the request but log it
			return {
				allowed: true,
				limit,
				remaining: limit,
				resetTime: new Date(now.getFullYear(), now.getMonth() + 1, 1) // Start of next month
			};
		}

		const requestCount = count || 0;
		const remaining = Math.max(0, limit - requestCount);
		const allowed = requestCount < limit;

		// Calculate seconds until start of next month for retryAfter
		const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
		const retryAfterSeconds = allowed
			? undefined
			: Math.ceil((nextMonth.getTime() - now.getTime()) / 1000);

		return {
			allowed,
			limit,
			remaining,
			resetTime: nextMonth,
			retryAfter: retryAfterSeconds
		};
	} catch (error) {
		console.error('Rate limit check error:', error);
		// On error, allow the request
		// Handle legacy tier mapping for error fallback
		const actualTier =
			tier in LEGACY_TIER_MAPPING
				? LEGACY_TIER_MAPPING[tier as keyof typeof LEGACY_TIER_MAPPING]
				: (tier as keyof typeof RATE_LIMITS);
		const fallbackLimit = RATE_LIMITS[actualTier] === -1 ? -1 : RATE_LIMITS[actualTier];
		return {
			allowed: true,
			limit: fallbackLimit,
			remaining: fallbackLimit,
			resetTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
		};
	}
}

/**
 * Get usage statistics for an API key
 */
export async function getApiKeyUsage(apiKeyId: string, startDate?: Date, endDate?: Date) {
	try {
		let query = supabase
			.from('api_usage')
			.select('endpoint, timestamp, status_code, response_time_ms')
			.eq('api_key_id', apiKeyId)
			.order('timestamp', { ascending: false });

		if (startDate) {
			query = query.gte('timestamp', startDate.toISOString());
		}

		if (endDate) {
			query = query.lte('timestamp', endDate.toISOString());
		}

		const { data, error } = await query.limit(1000); // Limit for performance

		if (error) {
			console.error('Error fetching API key usage:', error);
			return { success: false, error: 'Failed to fetch usage data' };
		}

		return { success: true, data };
	} catch (error) {
		console.error('Get API key usage error:', error);
		return { success: false, error: 'Fetch failed' };
	}
}

/**
 * Get usage summary by day for charts
 */
export async function getUsageSummary(apiKeyId: string, days: number = 30) {
	try {
		const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

		const { data, error } = await supabase.rpc('get_api_usage_summary', {
			key_id: apiKeyId,
			start_date: startDate.toISOString()
		});

		if (error) {
			console.error('Error fetching usage summary:', error);
			return { success: false, error: 'Failed to fetch usage summary' };
		}

		return { success: true, data };
	} catch (error) {
		console.error('Get usage summary error:', error);
		return { success: false, error: 'Fetch failed' };
	}
}

/**
 * Middleware function to validate API requests with rate limiting
 */
export async function validateApiRequest(request: Request): Promise<{
	valid: boolean;
	userId?: string;
	keyId?: string;
	error?: string;
	rateLimitExceeded?: boolean;
	retryAfter?: number;
}> {
	const authHeader = request.headers.get('Authorization');

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return { valid: false, error: 'Missing or invalid Authorization header' };
	}

	const apiKey = authHeader.replace('Bearer ', '');
	const validation = await validateApiKey(apiKey);

	if (!validation.valid) {
		return validation;
	}

	// Check rate limits (default to member tier)
	const rateLimit = await checkRateLimit(validation.keyId!, 'api_member');

	if (!rateLimit.allowed) {
		return {
			valid: false,
			error: 'Rate limit exceeded',
			rateLimitExceeded: true,
			retryAfter: rateLimit.retryAfter
		};
	}

	return validation;
}

/**
 * Get user's API subscription tier from their role
 */
export function getUserApiTier(role: string | null): 'viewer' | 'api-member' | 'api-enterprise' {
	if (!role) return 'viewer';

	// Parse role (could be array or single role)
	const roles = Array.isArray(role) ? role : role.split(',').map((r) => r.trim());

	// Check for enterprise/admin roles (highest priority)
	if (roles.some((r) => r.includes('admin') || r === 'api-enterprise')) {
		return 'api-enterprise';
	}

	// Check for enhanced API access
	if (roles.some((r) => r === 'api-member')) {
		return 'api-member';
	}

	// Legacy API role mapping
	if (roles.some((r) => r === 'api')) {
		return 'api-member';
	}

	// Default to viewer (free) tier - includes basic API access
	return 'viewer';
}

/**
 * Get row limit for user's API tier
 */
export function getApiRowLimit(tier: 'viewer' | 'api-member' | 'api-enterprise'): number {
	return ROW_LIMITS[tier];
}

/**
 * Enhanced API middleware with automatic usage logging and rate limiting
 */
export async function validateAndLogApiRequest(
	request: Request,
	endpoint: string
): Promise<{
	valid: boolean;
	userId?: string;
	keyId?: string;
	error?: string;
	rateLimitExceeded?: boolean;
	retryAfter?: number;
	logUsage: (statusCode: number, responseTimeMs: number) => Promise<void>;
}> {
	const validation = await validateApiRequest(request);

	const logUsage = async (statusCode: number, responseTimeMs: number) => {
		if (validation.keyId) {
			const userAgent = request.headers.get('User-Agent') || undefined;
			const ipAddress =
				request.headers.get('CF-Connecting-IP') ||
				request.headers.get('X-Forwarded-For') ||
				undefined;

			await logApiUsage(
				validation.keyId,
				endpoint,
				statusCode,
				responseTimeMs,
				userAgent,
				ipAddress
			);
		}
	};

	return {
		...validation,
		logUsage
	};
}
