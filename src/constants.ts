/**
 * Shared constants for indexeddb package
 *
 * @remarks
 * Contains default values, configuration constants, and
 * magic strings used throughout the library.
 *
 * @packageDocumentation
 */

import type { StoreDefinition, TransactionDurability } from './types.js'

// ============================================================================
// Store Defaults
// ============================================================================

/**
 * Default store definition values.
 *
 * @remarks
 * Applied when creating stores without explicit configuration:
 * - `keyPath: 'id'` — Most common pattern for records with ID
 * - `autoIncrement: false` — Prefer explicit IDs (UUIDs)
 * - `indexes: []` — No indexes by default
 */
export const DEFAULT_STORE_DEFINITION: Omit<Required<StoreDefinition>, 'ttl'> = {
	keyPath: 'id',
	autoIncrement: false,
	indexes: [],
} as const

/**
 * Default key path for object stores.
 */
export const DEFAULT_KEY_PATH = 'id' as const

/**
 * Default auto-increment setting.
 */
export const DEFAULT_AUTO_INCREMENT = false as const

// ============================================================================
// Transaction Defaults
// ============================================================================

/**
 * Default transaction durability hint.
 */
export const DEFAULT_DURABILITY: TransactionDurability = 'default'

// ============================================================================
// Cross-Tab Sync
// ============================================================================

/**
 * BroadcastChannel name prefix for cross-tab sync.
 *
 * @remarks
 * Full channel name is `${BROADCAST_CHANNEL_PREFIX}${databaseName}`
 */
export const BROADCAST_CHANNEL_PREFIX = 'idb:' as const

/**
 * Default cross-tab sync enabled state.
 */
export const DEFAULT_CROSS_TAB_SYNC = true as const

// ============================================================================
// Cursor Defaults
// ============================================================================

/**
 * Default cursor direction.
 */
export const DEFAULT_CURSOR_DIRECTION = 'next' as const

// ============================================================================
// Query Builder Defaults
// ============================================================================

/**
 * Default order direction for queries.
 */
export const DEFAULT_ORDER_DIRECTION = 'ascending' as const

/**
 * Unicode character used for startsWith upper bound.
 *
 * @remarks
 * Used to create an upper bound for prefix searches:
 * `IDBKeyRange.bound(prefix, prefix + STARTS_WITH_UPPER_BOUND)`
 */
export const STARTS_WITH_UPPER_BOUND = '\uffff' as const

// ============================================================================
// Error Messages
// ============================================================================

/**
 * Common error message templates.
 */
export const ERROR_MESSAGES = {
	DATABASE_NOT_OPEN: 'Database connection is not open',
	DATABASE_CLOSED: 'Database connection has been closed',
	STORE_NOT_FOUND: (name: string) => `Object store "${name}" not found`,
	INDEX_NOT_FOUND: (name: string) => `Index "${name}" not found`,
	TRANSACTION_INACTIVE: 'Transaction is no longer active',
	TRANSACTION_MODE_MISMATCH: 'Operation requires readwrite transaction',
	INVALID_KEY: 'Invalid key type for this operation',
	NATIVE_ACCESS_NO_TRANSACTION: 'Native store access requires active transaction',
	UPGRADE_BLOCKED: 'Database upgrade blocked by other connections',
	UPGRADE_FAILED: 'Database upgrade failed',
	OPEN_FAILED: 'Failed to open database',
} as const

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Minimum database version number.
 */
export const MIN_DATABASE_VERSION = 1 as const

/**
 * Maximum reasonable database version (for validation).
 *
 * @remarks
 * This is a sanity check, not a hard limit.
 */
export const MAX_DATABASE_VERSION = 2147483647 as const // 2^31 - 1

// ============================================================================
// Performance Tuning
// ============================================================================

/**
 * Default batch size for bulk operations.
 *
 * @remarks
 * When processing very large arrays, operations may be chunked
 * to avoid blocking the main thread.
 */
export const DEFAULT_BATCH_SIZE = 1000 as const
