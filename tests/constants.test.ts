/**
 * Tests for constants
 *
 * @remarks
 * Verifies that all constants are properly defined and have correct values.
 */

import { describe, it, expect } from 'vitest'
import {
	DEFAULT_STORE_DEFINITION,
	DEFAULT_KEY_PATH,
	DEFAULT_AUTO_INCREMENT,
	DEFAULT_DURABILITY,
	BROADCAST_CHANNEL_PREFIX,
	DEFAULT_CROSS_TAB_SYNC,
	DEFAULT_CURSOR_DIRECTION,
	DEFAULT_ORDER_DIRECTION,
	STARTS_WITH_UPPER_BOUND,
	ERROR_MESSAGES,
	MIN_DATABASE_VERSION,
	MAX_DATABASE_VERSION,
	DEFAULT_BATCH_SIZE,
} from '../src/constants.js'

// ============================================================================
// Store Defaults
// ============================================================================

describe('DEFAULT_STORE_DEFINITION', () => {
	it('has keyPath of "id"', () => {
		expect(DEFAULT_STORE_DEFINITION.keyPath).toBe('id')
	})

	it('has autoIncrement false', () => {
		expect(DEFAULT_STORE_DEFINITION.autoIncrement).toBe(false)
	})

	it('has empty indexes array', () => {
		expect(DEFAULT_STORE_DEFINITION.indexes).toEqual([])
	})
})

describe('DEFAULT_KEY_PATH', () => {
	it('is "id"', () => {
		expect(DEFAULT_KEY_PATH).toBe('id')
	})
})

describe('DEFAULT_AUTO_INCREMENT', () => {
	it('is false', () => {
		expect(DEFAULT_AUTO_INCREMENT).toBe(false)
	})
})

// ============================================================================
// Transaction Defaults
// ============================================================================

describe('DEFAULT_DURABILITY', () => {
	it('is "default"', () => {
		expect(DEFAULT_DURABILITY).toBe('default')
	})
})

// ============================================================================
// Cross-Tab Sync
// ============================================================================

describe('BROADCAST_CHANNEL_PREFIX', () => {
	it('is "idb:"', () => {
		expect(BROADCAST_CHANNEL_PREFIX).toBe('idb:')
	})

	it('can be used to create channel names', () => {
		const dbName = 'myDatabase'
		const channelName = `${BROADCAST_CHANNEL_PREFIX}${dbName}`
		expect(channelName).toBe('idb:myDatabase')
	})
})

describe('DEFAULT_CROSS_TAB_SYNC', () => {
	it('is true', () => {
		expect(DEFAULT_CROSS_TAB_SYNC).toBe(true)
	})
})

// ============================================================================
// Cursor Defaults
// ============================================================================

describe('DEFAULT_CURSOR_DIRECTION', () => {
	it('is "next"', () => {
		expect(DEFAULT_CURSOR_DIRECTION).toBe('next')
	})
})

// ============================================================================
// Query Builder Defaults
// ============================================================================

describe('DEFAULT_ORDER_DIRECTION', () => {
	it('is "ascending"', () => {
		expect(DEFAULT_ORDER_DIRECTION).toBe('ascending')
	})
})

describe('STARTS_WITH_UPPER_BOUND', () => {
	it('is high Unicode character', () => {
		expect(STARTS_WITH_UPPER_BOUND).toBe('\uffff')
	})

	it('is greater than all normal characters', () => {
		expect('z' < STARTS_WITH_UPPER_BOUND).toBe(true)
		expect('zzz' < `zzz${STARTS_WITH_UPPER_BOUND}`).toBe(true)
	})
})

// ============================================================================
// Error Messages
// ============================================================================

describe('ERROR_MESSAGES', () => {
	it('has static error messages', () => {
		expect(ERROR_MESSAGES.DATABASE_NOT_OPEN).toBe('Database connection is not open')
		expect(ERROR_MESSAGES.DATABASE_CLOSED).toBe('Database connection has been closed')
		expect(ERROR_MESSAGES.TRANSACTION_INACTIVE).toBe('Transaction is no longer active')
		expect(ERROR_MESSAGES.TRANSACTION_MODE_MISMATCH).toBe('Operation requires readwrite transaction')
		expect(ERROR_MESSAGES.INVALID_KEY).toBe('Invalid key type for this operation')
		expect(ERROR_MESSAGES.NATIVE_ACCESS_NO_TRANSACTION).toBe('Native store access requires active transaction')
		expect(ERROR_MESSAGES.UPGRADE_BLOCKED).toBe('Database upgrade blocked by other connections')
		expect(ERROR_MESSAGES.UPGRADE_FAILED).toBe('Database upgrade failed')
		expect(ERROR_MESSAGES.OPEN_FAILED).toBe('Failed to open database')
	})

	it('has function error messages', () => {
		expect(ERROR_MESSAGES.STORE_NOT_FOUND('users')).toBe('Object store "users" not found')
		expect(ERROR_MESSAGES.INDEX_NOT_FOUND('byEmail')).toBe('Index "byEmail" not found')
	})

	it('STORE_NOT_FOUND formats correctly', () => {
		expect(ERROR_MESSAGES.STORE_NOT_FOUND('')).toBe('Object store "" not found')
		expect(ERROR_MESSAGES.STORE_NOT_FOUND('my-store')).toBe('Object store "my-store" not found')
	})

	it('INDEX_NOT_FOUND formats correctly', () => {
		expect(ERROR_MESSAGES.INDEX_NOT_FOUND('')).toBe('Index "" not found')
		expect(ERROR_MESSAGES.INDEX_NOT_FOUND('byStatus')).toBe('Index "byStatus" not found')
	})
})

// ============================================================================
// Validation Constants
// ============================================================================

describe('MIN_DATABASE_VERSION', () => {
	it('is 1', () => {
		expect(MIN_DATABASE_VERSION).toBe(1)
	})
})

describe('MAX_DATABASE_VERSION', () => {
	it('is max 32-bit signed integer', () => {
		expect(MAX_DATABASE_VERSION).toBe(2147483647)
	})

	it('equals 2^31 - 1', () => {
		expect(MAX_DATABASE_VERSION).toBe(Math.pow(2, 31) - 1)
	})
})

// ============================================================================
// Performance Tuning
// ============================================================================

describe('DEFAULT_BATCH_SIZE', () => {
	it('is 1000', () => {
		expect(DEFAULT_BATCH_SIZE).toBe(1000)
	})

	it('is a reasonable batch size', () => {
		expect(DEFAULT_BATCH_SIZE).toBeGreaterThan(0)
		expect(DEFAULT_BATCH_SIZE).toBeLessThan(100000)
	})
})

// ============================================================================
// All Constants Exported
// ============================================================================

describe('exports', () => {
	it('all constants are defined', () => {
		expect(DEFAULT_STORE_DEFINITION).toBeDefined()
		expect(DEFAULT_KEY_PATH).toBeDefined()
		expect(DEFAULT_AUTO_INCREMENT).toBeDefined()
		expect(DEFAULT_DURABILITY).toBeDefined()
		expect(BROADCAST_CHANNEL_PREFIX).toBeDefined()
		expect(DEFAULT_CROSS_TAB_SYNC).toBeDefined()
		expect(DEFAULT_CURSOR_DIRECTION).toBeDefined()
		expect(DEFAULT_ORDER_DIRECTION).toBeDefined()
		expect(STARTS_WITH_UPPER_BOUND).toBeDefined()
		expect(ERROR_MESSAGES).toBeDefined()
		expect(MIN_DATABASE_VERSION).toBeDefined()
		expect(MAX_DATABASE_VERSION).toBeDefined()
		expect(DEFAULT_BATCH_SIZE).toBeDefined()
	})
})
