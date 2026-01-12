/**
 * Showcase Examples Barrel Export
 *
 * Re-exports all example modules for use in main.ts
 */

// Types and sample data
export * from './types.js'

// Database setup
export * from './database-setup.js'

// Store operations (CRUD)
export * from './store-operations.js'

// Index operations
export * from './index-operations.js'

// Query builder (renamed to avoid conflict)
export {
	demonstrateWhereEquals,
	demonstrateComparisonQueries,
	demonstrateStartsWith,
	demonstrateAnyOf,
	demonstrateFilter,
	demonstrateCombinedQuery,
	demonstrateOrderingAndPagination,
	demonstrateTerminalOperations,
	demonstrateIterate as demonstrateQueryIterate,
	demonstrateBooleanQueries,
} from './query-builder.js'

// Transactions
export * from './transactions.js'

// Cursors (renamed to avoid conflict)
export {
	demonstrateIterate as demonstrateCursorIterate,
	demonstrateIterateKeys,
	demonstrateManualCursor,
	demonstrateCursorMutation,
	demonstrateCursorNavigation,
	demonstrateCursorDirections,
	demonstrateKeyCursor,
	demonstrateIndexCursor,
} from './cursors.js'

// Events and reactivity
export * from './events.js'

// Error handling
export * from './error-handling.js'
