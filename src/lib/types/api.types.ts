import type { Database } from './database.types';
import type { CoffeeWithInventory, InventoryWithCatalog, RoastWithLogs } from './component.types';

// Re-export for convenience
export type { CoffeeWithInventory } from './component.types';

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
	data?: T;
	error?: string;
	message?: string;
	success: boolean;
}

// Paginated response
export interface PaginatedResponse<T = unknown> extends Omit<ApiResponse<T>, 'data'> {
	data: T[];
	pagination: {
		page: number;
		pageSize: number;
		total: number;
		totalPages: number;
	};
}

// Error response structure
export interface ApiError {
	error: string;
	details?: string;
	code?: string;
	statusCode?: number;
}

// Authentication types
export interface AuthUser {
	id: string;
	email: string;
	name?: string;
	role: 'viewer' | 'member';
	created_at: string;
	updated_at: string;
}

export interface SessionData {
	user: AuthUser;
	session: {
		access_token: string;
		refresh_token: string;
		expires_at: number;
	};
}

// RAG Service types
export interface RAGQuery {
	query: string;
	limit?: number;
	threshold?: number;
	filters?: {
		stocked?: boolean;
		source?: string;
		continent?: string;
		processing?: string;
	};
}

export interface RAGResult {
	coffee: CoffeeWithInventory;
	similarity: number;
	chunk_content?: string;
	chunk_type?: string;
}

export interface RAGResponse extends ApiResponse {
	data: {
		results: RAGResult[];
		query: string;
		total_results: number;
		processing_time_ms: number;
	};
}

// OpenAI API types
export interface OpenAIEmbeddingRequest {
	input: string | string[];
	model: string;
}

export interface OpenAIEmbeddingResponse {
	object: string;
	data: Array<{
		object: string;
		embedding: number[];
		index: number;
	}>;
	model: string;
	usage: {
		prompt_tokens: number;
		total_tokens: number;
	};
}

// Coffee catalog API types
export interface CoffeeSearchParams {
	query?: string;
	stocked?: boolean;
	source?: string;
	continent?: string;
	processing?: string;
	limit?: number;
	offset?: number;
}

export interface CoffeeSearchResponse extends PaginatedResponse<CoffeeWithInventory> {}

// Inventory API types
export interface InventoryCreateRequest {
	catalog_id: number;
	rank?: number;
	notes?: string;
	purchase_date?: string;
	purchased_qty_lbs?: number;
	bean_cost?: number;
	tax_ship_cost?: number;
	cupping_notes?: Record<string, unknown>;
}

export interface InventoryUpdateRequest extends Partial<InventoryCreateRequest> {
	id: number;
}

export interface InventoryResponse extends ApiResponse<InventoryWithCatalog> {}
export interface InventoryListResponse extends ApiResponse<InventoryWithCatalog[]> {}

// Roast profile API types
export interface RoastProfileCreateRequest {
	batch_name: string;
	coffee_id: number;
	coffee_name: string;
	roast_date: string;
	oz_in?: number;
	oz_out?: number;
	roast_notes?: string;
	roast_targets?: string;
	roaster_type?: string;
	roaster_size?: number;
}

export interface RoastProfileUpdateRequest extends Partial<RoastProfileCreateRequest> {
	roast_id: number;
}

export interface RoastProfileResponse extends ApiResponse<RoastWithLogs> {}
export interface RoastProfileListResponse extends ApiResponse<RoastWithLogs[]> {}

// Profile log (temperature data) types
export interface ProfileLogEntry {
	roast_id: number;
	time_seconds: number;
	bean_temp?: number;
	environmental_temp?: number;
	fan_setting?: number;
	heat_setting?: number;
	start?: boolean;
	maillard?: boolean;
	fc_start?: boolean;
	fc_rolling?: boolean;
	fc_end?: boolean;
	sc_start?: boolean;
	drop?: boolean;
	end?: boolean;
}

export interface ProfileLogBatch {
	roast_id: number;
	entries: ProfileLogEntry[];
}

export interface ProfileLogResponse extends ApiResponse {
	data: {
		entries: ProfileLogEntry[];
		roast_id: number;
	};
}

// Sales API types
export interface SalesCreateRequest {
	green_coffee_inv_id: number;
	oz_sold: number;
	price: number;
	buyer: string;
	batch_name: string;
	sell_date: string;
}

export interface SalesUpdateRequest extends Partial<SalesCreateRequest> {
	id: number;
}

export interface SalesWithDetails {
	id: number;
	green_coffee_inv_id: number;
	oz_sold: number;
	price: number;
	buyer: string;
	batch_name: string;
	sell_date: string;
	purchase_date: string;
	green_coffee_inv?: InventoryWithCatalog;
}

export interface SalesResponse extends ApiResponse<SalesWithDetails> {}
export interface SalesListResponse extends ApiResponse<SalesWithDetails[]> {}

// Analytics and reporting types
export interface ProfitAnalysis {
	totalProfit: number;
	totalRevenue: number;
	totalCosts: number;
	profitMargin: number;
	averageMarkup: number;
	topPerformingCoffees: Array<{
		coffee_name: string;
		total_profit: number;
		total_sold_oz: number;
		avg_price_per_oz: number;
	}>;
}

export interface ProfitAnalysisResponse extends ApiResponse<ProfitAnalysis> {}

export interface PerformanceMetrics {
	date: string;
	profit: number;
	volume: number;
	avgPrice: number;
	roastCount: number;
	salesCount: number;
}

export interface PerformanceResponse extends ApiResponse<PerformanceMetrics[]> {}

// Stripe integration types
export interface StripeSessionRequest {
	priceId: string;
	successUrl: string;
	cancelUrl: string;
}

export interface StripeSessionResponse extends ApiResponse {
	data: {
		sessionId: string;
		url: string;
	};
}

export interface StripeCustomer {
	id: string;
	user_id: string;
	customer_id: string;
	email?: string;
	created_at: string;
	updated_at: string;
}

// File upload types
export interface FileUploadRequest {
	file: File;
	type: 'artisan_profile' | 'csv_import' | 'image';
	metadata?: Record<string, unknown>;
}

export interface FileUploadResponse extends ApiResponse {
	data: {
		filename: string;
		size: number;
		url?: string;
		processing_status?: string;
	};
}

// Artisan import types
export interface ArtisanImportData {
	roast_id?: number;
	filename: string;
	artisan_version?: string;
	temperature_data: ProfileLogEntry[];
	events?: Array<{
		time_seconds: number;
		event_type: string;
		event_value?: string;
	}>;
	metadata?: Record<string, unknown>;
}

export interface ArtisanImportResponse extends ApiResponse {
	data: {
		import_id: number;
		roast_id: number;
		total_data_points: number;
		processing_status: string;
		processing_messages?: string[];
	};
}

// Chat/AI assistance types
export interface ChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: string;
	metadata?: Record<string, unknown>;
}

export interface ChatRequest {
	messages: ChatMessage[];
	context?: {
		current_coffee?: string;
		current_roast?: string;
		user_inventory?: string[];
	};
}

export interface ChatResponse extends ApiResponse {
	data: {
		message: ChatMessage;
		suggestions?: string[];
		related_coffees?: CoffeeWithInventory[];
	};
}

// Batch operation types
export interface BatchOperation<T = unknown> {
	operation: 'create' | 'update' | 'delete';
	data: T;
	id?: string | number;
}

export interface BatchRequest<T = unknown> {
	operations: BatchOperation<T>[];
}

export interface BatchResponse<T = unknown> extends ApiResponse {
	data: {
		successful: Array<{
			operation: BatchOperation<T>;
			result: T;
		}>;
		failed: Array<{
			operation: BatchOperation<T>;
			error: string;
		}>;
	};
}

// Export utility types for API operations
export type RequestHandler<TRequest = unknown, TResponse = unknown> = (
	request: TRequest
) => Promise<TResponse>;

export type ApiEndpoint<TRequest = unknown, TResponse = unknown> = {
	url: string;
	method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
	handler: RequestHandler<TRequest, TResponse>;
};

// Common API operation patterns
export interface CrudOperations<TEntity, TCreateRequest, TUpdateRequest> {
	list: () => Promise<ApiResponse<TEntity[]>>;
	get: (id: string | number) => Promise<ApiResponse<TEntity>>;
	create: (data: TCreateRequest) => Promise<ApiResponse<TEntity>>;
	update: (id: string | number, data: TUpdateRequest) => Promise<ApiResponse<TEntity>>;
	delete: (id: string | number) => Promise<ApiResponse<void>>;
}
