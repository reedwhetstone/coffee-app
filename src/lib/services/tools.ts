/**
 * Re-export barrel — preserves all existing import paths.
 *
 * The implementation has been split into domain-scoped modules under
 * src/lib/services/tools/. This file exists solely so that existing
 * consumers (`import { createChatTools } from '$lib/services/tools'`)
 * continue to work without any changes.
 */
export {
	createChatTools,
	type ChatToolAccess,
	type ChatToolDeps,
	type InventoryRoastSummary
} from './tools/index';
