/**
 * Tests for error classes and error handling
 *
 * @remarks
 * Comprehensive tests covering:
 * - Error class instantiation and properties
 * - Error inheritance chain
 * - Error message formatting
 * - Error wrapping from native DOMException
 * - Type guards
 * - Edge cases
 */

import { describe, it, expect } from 'vitest'
import {
	DatabaseError,
	NotFoundError,
	ConstraintError,
	QuotaExceededError,
	TransactionError,
	UpgradeError,
	OpenError,
	DataError,
	ReadOnlyError,
	VersionError,
	InvalidStateError,
	TimeoutError,
	wrapError,
	isDatabaseError,
	isNotFoundError,
	isConstraintError,
	isQuotaExceededError,
	isTransactionError,
	isUpgradeError,
	isOpenError,
	isDataError,
	hasErrorCode,
} from '../src/errors.js'

// ============================================================================
// DatabaseError (Base Class)
// ============================================================================

describe('DatabaseError', () => {
	describe('construction', () => {
		it('creates error with code and message', () => {
			const error = new DatabaseError('UNKNOWN_ERROR', 'Test message')

			expect(error).toBeInstanceOf(Error)
			expect(error).toBeInstanceOf(DatabaseError)
			expect(error.code).toBe('UNKNOWN_ERROR')
			expect(error.message).toBe('Test message')
			expect(error.name).toBe('DatabaseError')
		})

		it('stores cause when provided', () => {
			const cause = new Error('Original error')
			const error = new DatabaseError('UNKNOWN_ERROR', 'Wrapped', cause)

			expect(error.cause).toBe(cause)
		})

		it('allows undefined cause', () => {
			const error = new DatabaseError('UNKNOWN_ERROR', 'No cause')

			expect(error.cause).toBeUndefined()
		})

		it('supports all error codes', () => {
			const codes = [
				'OPEN_FAILED',
				'UPGRADE_FAILED',
				'UPGRADE_BLOCKED',
				'TRANSACTION_ABORTED',
				'TRANSACTION_INACTIVE',
				'CONSTRAINT_ERROR',
				'QUOTA_EXCEEDED',
				'NOT_FOUND',
				'DATA_ERROR',
				'READ_ONLY',
				'VERSION_ERROR',
				'INVALID_STATE',
				'TIMEOUT',
				'UNKNOWN_ERROR',
			] as const

			for (const code of codes) {
				const error = new DatabaseError(code, `Test ${code}`)
				expect(error.code).toBe(code)
			}
		})
	})

	describe('inheritance', () => {
		it('is instanceof Error', () => {
			const error = new DatabaseError('UNKNOWN_ERROR', 'Test')
			expect(error instanceof Error).toBe(true)
		})

		it('has correct prototype chain', () => {
			const error = new DatabaseError('UNKNOWN_ERROR', 'Test')
			expect(Object.getPrototypeOf(error)).toBe(DatabaseError.prototype)
			expect(Object.getPrototypeOf(DatabaseError.prototype)).toBe(Error.prototype)
		})

		it('can be caught as Error', () => {
			let caught: Error | null = null
			try {
				throw new DatabaseError('UNKNOWN_ERROR', 'Test')
			} catch (e) {
				if (e instanceof Error) {
					caught = e
				}
			}
			expect(caught).not.toBeNull()
			expect(caught).toBeInstanceOf(DatabaseError)
		})
	})
})

// ============================================================================
// NotFoundError
// ============================================================================

describe('NotFoundError', () => {
	describe('construction', () => {
		it('creates error with store name and key', () => {
			const error = new NotFoundError('users', 'u1')

			expect(error).toBeInstanceOf(DatabaseError)
			expect(error).toBeInstanceOf(NotFoundError)
			expect(error.code).toBe('NOT_FOUND')
			expect(error.name).toBe('NotFoundError')
			expect(error.storeName).toBe('users')
			expect(error.key).toBe('u1')
		})

		it('formats string key in message', () => {
			const error = new NotFoundError('users', 'u1')
			expect(error.message).toContain('"u1"')
			expect(error.message).toContain('users')
		})

		it('formats number key in message', () => {
			const error = new NotFoundError('items', 42)
			expect(error.message).toContain('42')
		})

		it('formats Date key in message', () => {
			const date = new Date('2024-01-15T12:00:00Z')
			const error = new NotFoundError('events', date)
			expect(error.message).toContain('2024-01-15')
		})

		it('formats array key in message', () => {
			const error = new NotFoundError('composite', ['a', 'b'])
			expect(error.message).toContain('[')
			expect(error.message).toContain('"a"')
			expect(error.message).toContain('"b"')
		})

		it('handles binary key in message', () => {
			const buffer = new ArrayBuffer(8)
			const error = new NotFoundError('binary', buffer)
			expect(error.message).toContain('[Binary Data]')
		})
	})

	describe('inheritance', () => {
		it('extends DatabaseError', () => {
			const error = new NotFoundError('users', 'u1')
			expect(error instanceof DatabaseError).toBe(true)
		})

		it('can be caught as DatabaseError', () => {
			let caught: DatabaseError | null = null
			try {
				throw new NotFoundError('users', 'u1')
			} catch (e) {
				if (e instanceof DatabaseError) {
					caught = e
				}
			}
			expect(caught).not.toBeNull()
			expect(caught).toBeInstanceOf(NotFoundError)
		})
	})
})

// ============================================================================
// ConstraintError
// ============================================================================

describe('ConstraintError', () => {
	describe('construction', () => {
		it('creates error with store name and key', () => {
			const error = new ConstraintError('users', 'u1')

			expect(error).toBeInstanceOf(DatabaseError)
			expect(error).toBeInstanceOf(ConstraintError)
			expect(error.code).toBe('CONSTRAINT_ERROR')
			expect(error.name).toBe('ConstraintError')
			expect(error.storeName).toBe('users')
			expect(error.key).toBe('u1')
		})

		it('stores cause when provided', () => {
			const cause = new Error('Native error')
			const error = new ConstraintError('users', 'u1', cause)

			expect(error.cause).toBe(cause)
		})

		it('includes key in message', () => {
			const error = new ConstraintError('users', 'duplicate-id')
			expect(error.message).toContain('duplicate-id')
			expect(error.message).toContain('users')
		})
	})
})

// ============================================================================
// QuotaExceededError
// ============================================================================

describe('QuotaExceededError', () => {
	describe('construction', () => {
		it('creates error with standard message', () => {
			const error = new QuotaExceededError()

			expect(error).toBeInstanceOf(DatabaseError)
			expect(error).toBeInstanceOf(QuotaExceededError)
			expect(error.code).toBe('QUOTA_EXCEEDED')
			expect(error.name).toBe('QuotaExceededError')
			expect(error.message).toBe('Storage quota exceeded')
		})

		it('stores cause when provided', () => {
			const cause = new Error('Native quota error')
			const error = new QuotaExceededError(cause)

			expect(error.cause).toBe(cause)
		})
	})
})

// ============================================================================
// TransactionError
// ============================================================================

describe('TransactionError', () => {
	describe('construction', () => {
		it('creates error with TRANSACTION_ABORTED code', () => {
			const error = new TransactionError('TRANSACTION_ABORTED', 'Aborted by user')

			expect(error).toBeInstanceOf(DatabaseError)
			expect(error).toBeInstanceOf(TransactionError)
			expect(error.code).toBe('TRANSACTION_ABORTED')
			expect(error.name).toBe('TransactionError')
			expect(error.message).toBe('Aborted by user')
		})

		it('creates error with TRANSACTION_INACTIVE code', () => {
			const error = new TransactionError('TRANSACTION_INACTIVE', 'Transaction expired')

			expect(error.code).toBe('TRANSACTION_INACTIVE')
		})

		it('stores cause when provided', () => {
			const cause = new Error('Native error')
			const error = new TransactionError('TRANSACTION_ABORTED', 'Test', cause)

			expect(error.cause).toBe(cause)
		})
	})
})

// ============================================================================
// UpgradeError
// ============================================================================

describe('UpgradeError', () => {
	describe('construction', () => {
		it('creates error with UPGRADE_FAILED code', () => {
			const error = new UpgradeError('UPGRADE_FAILED', 'Migration failed')

			expect(error).toBeInstanceOf(DatabaseError)
			expect(error).toBeInstanceOf(UpgradeError)
			expect(error.code).toBe('UPGRADE_FAILED')
			expect(error.name).toBe('UpgradeError')
		})

		it('creates error with UPGRADE_BLOCKED code', () => {
			const error = new UpgradeError('UPGRADE_BLOCKED', 'Other tabs open')

			expect(error.code).toBe('UPGRADE_BLOCKED')
		})
	})
})

// ============================================================================
// Other Error Classes
// ============================================================================

describe('OpenError', () => {
	it('creates error with correct properties', () => {
		const error = new OpenError('Failed to open database')

		expect(error).toBeInstanceOf(DatabaseError)
		expect(error).toBeInstanceOf(OpenError)
		expect(error.code).toBe('OPEN_FAILED')
		expect(error.name).toBe('OpenError')
	})
})

describe('DataError', () => {
	it('creates error with correct properties', () => {
		const error = new DataError('Invalid data format')

		expect(error).toBeInstanceOf(DatabaseError)
		expect(error).toBeInstanceOf(DataError)
		expect(error.code).toBe('DATA_ERROR')
		expect(error.name).toBe('DataError')
	})
})

describe('ReadOnlyError', () => {
	it('creates error with correct properties', () => {
		const error = new ReadOnlyError('Cannot write in readonly transaction')

		expect(error).toBeInstanceOf(DatabaseError)
		expect(error.code).toBe('READ_ONLY')
		expect(error.name).toBe('ReadOnlyError')
	})
})

describe('VersionError', () => {
	it('creates error with correct properties', () => {
		const error = new VersionError('Version mismatch')

		expect(error).toBeInstanceOf(DatabaseError)
		expect(error.code).toBe('VERSION_ERROR')
		expect(error.name).toBe('VersionError')
	})
})

describe('InvalidStateError', () => {
	it('creates error with correct properties', () => {
		const error = new InvalidStateError('Database is closed')

		expect(error).toBeInstanceOf(DatabaseError)
		expect(error.code).toBe('INVALID_STATE')
		expect(error.name).toBe('InvalidStateError')
	})
})

describe('TimeoutError', () => {
	it('creates error with correct properties', () => {
		const error = new TimeoutError('Operation timed out')

		expect(error).toBeInstanceOf(DatabaseError)
		expect(error.code).toBe('TIMEOUT')
		expect(error.name).toBe('TimeoutError')
	})
})

// ============================================================================
// wrapError
// ============================================================================

describe('wrapError', () => {
	describe('null handling', () => {
		it('returns UNKNOWN_ERROR for null', () => {
			const error = wrapError(null)

			expect(error).toBeInstanceOf(DatabaseError)
			expect(error.code).toBe('UNKNOWN_ERROR')
		})
	})

	describe('ConstraintError mapping', () => {
		it('wraps native ConstraintError', () => {
			const native = new DOMException('Key exists', 'ConstraintError')
			const error = wrapError(native, { storeName: 'users', key: 'u1' })

			expect(error).toBeInstanceOf(ConstraintError)
			expect((error as ConstraintError).storeName).toBe('users')
			expect((error as ConstraintError).key).toBe('u1')
			expect(error.cause).toBe(native)
		})
	})

	describe('QuotaExceededError mapping', () => {
		it('wraps native QuotaExceededError', () => {
			const native = new DOMException('Quota exceeded', 'QuotaExceededError')
			const error = wrapError(native)

			expect(error).toBeInstanceOf(QuotaExceededError)
			expect(error.cause).toBe(native)
		})
	})

	describe('TransactionError mapping', () => {
		it('wraps TransactionInactiveError', () => {
			const native = new DOMException('Inactive', 'TransactionInactiveError')
			const error = wrapError(native)

			expect(error).toBeInstanceOf(TransactionError)
			expect(error.code).toBe('TRANSACTION_INACTIVE')
		})

		it('wraps AbortError', () => {
			const native = new DOMException('Aborted', 'AbortError')
			const error = wrapError(native)

			expect(error).toBeInstanceOf(TransactionError)
			expect(error.code).toBe('TRANSACTION_ABORTED')
		})
	})

	describe('other error mappings', () => {
		it('wraps VersionError', () => {
			const native = new DOMException('Version conflict', 'VersionError')
			const error = wrapError(native)

			expect(error).toBeInstanceOf(VersionError)
		})

		it('wraps DataError', () => {
			const native = new DOMException('Bad data', 'DataError')
			const error = wrapError(native)

			expect(error).toBeInstanceOf(DataError)
		})

		it('wraps InvalidStateError', () => {
			const native = new DOMException('Invalid state', 'InvalidStateError')
			const error = wrapError(native)

			expect(error).toBeInstanceOf(InvalidStateError)
		})

		it('wraps ReadOnlyError', () => {
			const native = new DOMException('Read only', 'ReadOnlyError')
			const error = wrapError(native)

			expect(error.code).toBe('READ_ONLY')
		})

		it('wraps TimeoutError', () => {
			const native = new DOMException('Timed out', 'TimeoutError')
			const error = wrapError(native)

			expect(error).toBeInstanceOf(TimeoutError)
		})

		it('wraps NotFoundError (store/index not found)', () => {
			const native = new DOMException('Store not found', 'NotFoundError')
			const error = wrapError(native)

			// Native NotFoundError is for stores/indexes, not records
			expect(error.code).toBe('NOT_FOUND')
			expect(error).toBeInstanceOf(DatabaseError)
			expect(error).not.toBeInstanceOf(NotFoundError)
		})
	})

	describe('unknown errors', () => {
		it('wraps unknown error names', () => {
			const native = new DOMException('Something', 'SomethingError')
			const error = wrapError(native)

			expect(error).toBeInstanceOf(DatabaseError)
			expect(error.code).toBe('UNKNOWN_ERROR')
			expect(error.message).toContain('Something')
		})
	})

	describe('context handling', () => {
		it('uses empty strings when context missing', () => {
			const native = new DOMException('Key exists', 'ConstraintError')
			const error = wrapError(native)

			expect(error).toBeInstanceOf(ConstraintError)
			expect((error as ConstraintError).storeName).toBe('')
			expect((error as ConstraintError).key).toBe('')
		})

		it('preserves context in error', () => {
			const native = new DOMException('Key exists', 'ConstraintError')
			const error = wrapError(native, {
				storeName: 'products',
				key: 'prod-123',
			})

			expect((error as ConstraintError).storeName).toBe('products')
			expect((error as ConstraintError).key).toBe('prod-123')
		})
	})
})

// ============================================================================
// Type Guards
// ============================================================================

describe('isDatabaseError', () => {
	it('returns true for DatabaseError', () => {
		expect(isDatabaseError(new DatabaseError('UNKNOWN_ERROR', 'Test'))).toBe(true)
	})

	it('returns true for subclasses', () => {
		expect(isDatabaseError(new NotFoundError('users', 'u1'))).toBe(true)
		expect(isDatabaseError(new ConstraintError('users', 'u1'))).toBe(true)
		expect(isDatabaseError(new QuotaExceededError())).toBe(true)
	})

	it('returns false for regular Error', () => {
		expect(isDatabaseError(new Error('Test'))).toBe(false)
	})

	it('returns false for non-errors', () => {
		expect(isDatabaseError(null)).toBe(false)
		expect(isDatabaseError(undefined)).toBe(false)
		expect(isDatabaseError('error')).toBe(false)
		expect(isDatabaseError({ code: 'NOT_FOUND' })).toBe(false)
	})
})

describe('isNotFoundError', () => {
	it('returns true for NotFoundError', () => {
		expect(isNotFoundError(new NotFoundError('users', 'u1'))).toBe(true)
	})

	it('returns false for other DatabaseErrors', () => {
		expect(isNotFoundError(new DatabaseError('NOT_FOUND', 'Test'))).toBe(false)
		expect(isNotFoundError(new ConstraintError('users', 'u1'))).toBe(false)
	})

	it('returns false for non-errors', () => {
		expect(isNotFoundError(null)).toBe(false)
		expect(isNotFoundError({ storeName: 'users', key: 'u1' })).toBe(false)
	})
})

describe('isConstraintError', () => {
	it('returns true for ConstraintError', () => {
		expect(isConstraintError(new ConstraintError('users', 'u1'))).toBe(true)
	})

	it('returns false for other errors', () => {
		expect(isConstraintError(new NotFoundError('users', 'u1'))).toBe(false)
	})
})

describe('isQuotaExceededError', () => {
	it('returns true for QuotaExceededError', () => {
		expect(isQuotaExceededError(new QuotaExceededError())).toBe(true)
	})

	it('returns false for other errors', () => {
		expect(isQuotaExceededError(new DatabaseError('QUOTA_EXCEEDED', 'Test'))).toBe(false)
	})
})

describe('isTransactionError', () => {
	it('returns true for TransactionError', () => {
		expect(isTransactionError(new TransactionError('TRANSACTION_ABORTED', 'Test'))).toBe(true)
	})

	it('returns false for other errors', () => {
		expect(isTransactionError(new DatabaseError('TRANSACTION_ABORTED', 'Test'))).toBe(false)
	})
})

describe('isUpgradeError', () => {
	it('returns true for UpgradeError', () => {
		expect(isUpgradeError(new UpgradeError('UPGRADE_FAILED', 'Test'))).toBe(true)
	})

	it('returns false for other errors', () => {
		expect(isUpgradeError(new DatabaseError('UPGRADE_FAILED', 'Test'))).toBe(false)
	})
})

describe('isOpenError', () => {
	it('returns true for OpenError', () => {
		expect(isOpenError(new OpenError('Test'))).toBe(true)
	})

	it('returns false for other errors', () => {
		expect(isOpenError(new DatabaseError('OPEN_FAILED', 'Test'))).toBe(false)
	})
})

describe('isDataError', () => {
	it('returns true for DataError', () => {
		expect(isDataError(new DataError('Test'))).toBe(true)
	})

	it('returns false for other errors', () => {
		expect(isDataError(new DatabaseError('DATA_ERROR', 'Test'))).toBe(false)
	})
})

describe('hasErrorCode', () => {
	it('returns true when code matches', () => {
		expect(hasErrorCode(new DatabaseError('NOT_FOUND', 'Test'), 'NOT_FOUND')).toBe(true)
		expect(hasErrorCode(new NotFoundError('users', 'u1'), 'NOT_FOUND')).toBe(true)
	})

	it('returns false when code differs', () => {
		expect(hasErrorCode(new DatabaseError('NOT_FOUND', 'Test'), 'CONSTRAINT_ERROR')).toBe(false)
	})

	it('returns false for non-DatabaseError', () => {
		expect(hasErrorCode(new Error('Test'), 'NOT_FOUND')).toBe(false)
		expect(hasErrorCode(null, 'NOT_FOUND')).toBe(false)
	})
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
	describe('error serialization', () => {
		it('errors can be JSON stringified (partially)', () => {
			const error = new NotFoundError('users', 'u1')
			const json = JSON.stringify(error)
			const parsed = JSON.parse(json) as Record<string, unknown>

			// Standard Error properties don't serialize
			expect(parsed.message).toBeUndefined()
			// But custom properties do
			expect(parsed.code).toBe('NOT_FOUND')
			expect(parsed.storeName).toBe('users')
			expect(parsed.key).toBe('u1')
		})
	})

	describe('error stack traces', () => {
		it('has stack trace', () => {
			const error = new NotFoundError('users', 'u1')
			expect(error.stack).toBeDefined()
			expect(error.stack).toContain('NotFoundError')
		})
	})

	describe('special key values', () => {
		it('handles empty string key', () => {
			const error = new NotFoundError('users', '')
			expect(error.key).toBe('')
			expect(error.message).toContain('""')
		})

		it('handles zero key', () => {
			const error = new NotFoundError('users', 0)
			expect(error.key).toBe(0)
		})

		it('handles negative number key', () => {
			const error = new NotFoundError('users', -1)
			expect(error.key).toBe(-1)
		})

		it('handles very large number key', () => {
			const bigKey = Number.MAX_SAFE_INTEGER
			const error = new NotFoundError('users', bigKey)
			expect(error.key).toBe(bigKey)
		})

		it('handles nested array key', () => {
			const key = ['a', ['b', 'c']]
			const error = new NotFoundError('composite', key)
			expect(error.key).toEqual(key)
		})
	})

	describe('empty store name', () => {
		it('handles empty store name', () => {
			const error = new NotFoundError('', 'u1')
			expect(error.storeName).toBe('')
		})
	})
})
