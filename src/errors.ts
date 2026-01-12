/**
 * Error classes for IndexedDB operations
 *
 * @remarks
 * Error hierarchy:
 * - DatabaseError (base) — all database errors
 *   - NotFoundError — resolve() when record missing
 *   - ConstraintError — add() when key exists
 *   - QuotaExceededError — storage quota exceeded
 *   - TransactionError — transaction aborted or inactive
 *   - UpgradeError — database upgrade failed or blocked
 *
 * @packageDocumentation
 */

import type { DatabaseErrorCode, ValidKey } from './types.js'

// ============================================================================
// Error Context
// ============================================================================

/** Context for error wrapping */
export interface ErrorContext {
	readonly storeName?: string
	readonly key?: ValidKey
	readonly indexName?: string
}

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all database operations.
 *
 * @remarks
 * All database errors extend this class and include:
 * - `code` — machine-readable error code
 * - `message` — human-readable description
 * - `cause` — original error if wrapped
 */
export class DatabaseError extends Error {
	readonly code: DatabaseErrorCode
	override readonly cause?: unknown

	constructor(code: DatabaseErrorCode, message: string, cause?: unknown) {
		super(message)
		this.name = 'DatabaseError'
		this.code = code
		this.cause = cause

		// Maintain proper prototype chain for instanceof checks
		Object.setPrototypeOf(this, new.target.prototype)
	}
}

// ============================================================================
// Specific Error Classes
// ============================================================================

/**
 * Error thrown when a record is not found.
 *
 * @remarks
 * Thrown by `resolve()` when the requested key doesn't exist.
 * Contains the store name and key for debugging.
 *
 * @example
 * ```ts
 * try {
 *   await store.resolve('nonexistent')
 * } catch (error) {
 *   if (error instanceof NotFoundError) {
 *     console.log(`Key ${error.key} not found in ${error.storeName}`)
 *   }
 * }
 * ```
 */
export class NotFoundError extends DatabaseError {
	readonly storeName: string
	readonly key: ValidKey

	constructor(storeName: string, key: ValidKey) {
		const keyStr = formatKey(key)
		super('NOT_FOUND', `Record not found in "${storeName}" with key: ${keyStr}`)
		this.name = 'NotFoundError'
		this.storeName = storeName
		this.key = key
	}
}

/**
 * Error thrown when a uniqueness constraint is violated.
 *
 * @remarks
 * Thrown by `add()` when attempting to insert a record with a key
 * that already exists, or when violating a unique index constraint.
 *
 * @example
 * ```ts
 * try {
 *   await store.add({ id: 'existing', name: 'Test' })
 * } catch (error) {
 *   if (error instanceof ConstraintError) {
 *     console.log(`Key ${error.key} already exists in ${error.storeName}`)
 *   }
 * }
 * ```
 */
export class ConstraintError extends DatabaseError {
	readonly storeName: string
	readonly key: ValidKey

	constructor(storeName: string, key: ValidKey, cause?: unknown) {
		const keyStr = formatKey(key)
		super('CONSTRAINT_ERROR', `Key already exists in "${storeName}": ${keyStr}`, cause)
		this.name = 'ConstraintError'
		this.storeName = storeName
		this.key = key
	}
}

/**
 * Error thrown when storage quota is exceeded.
 *
 * @remarks
 * Thrown when the browser's storage quota for IndexedDB is exceeded.
 * This is an infrastructure error that typically requires user action.
 *
 * @example
 * ```ts
 * try {
 *   await store.set(largeData)
 * } catch (error) {
 *   if (error instanceof QuotaExceededError) {
 *     showStorageFullMessage()
 *   }
 * }
 * ```
 */
export class QuotaExceededError extends DatabaseError {
	constructor(cause?: unknown) {
		super('QUOTA_EXCEEDED', 'Storage quota exceeded', cause)
		this.name = 'QuotaExceededError'
	}
}

/**
 * Error thrown when a transaction fails.
 *
 * @remarks
 * Thrown when a transaction is aborted or becomes inactive.
 * The `code` property indicates the specific failure mode:
 * - `TRANSACTION_ABORTED` — transaction was explicitly or implicitly aborted
 * - `TRANSACTION_INACTIVE` — operation attempted on inactive transaction
 *
 * @example
 * ```ts
 * try {
 *   await db.write(['users'], async (tx) => {
 *     // ... operations
 *   })
 * } catch (error) {
 *   if (error instanceof TransactionError) {
 *     console.log(`Transaction failed: ${error.code}`)
 *   }
 * }
 * ```
 */
export class TransactionError extends DatabaseError {
	constructor(
		code: 'TRANSACTION_ABORTED' | 'TRANSACTION_INACTIVE',
		message: string,
		cause?: unknown,
	) {
		super(code, message, cause)
		this.name = 'TransactionError'
	}
}

/**
 * Error thrown when database upgrade fails.
 *
 * @remarks
 * Thrown during database version upgrades when:
 * - `UPGRADE_FAILED` — migration or store creation failed
 * - `UPGRADE_BLOCKED` — other connections prevent upgrade
 *
 * @example
 * ```ts
 * try {
 *   const db = await createDatabase({ name: 'app', version: 2, ... })
 * } catch (error) {
 *   if (error instanceof UpgradeError) {
 *     if (error.code === 'UPGRADE_BLOCKED') {
 *       showCloseOtherTabsMessage()
 *     }
 *   }
 * }
 * ```
 */
export class UpgradeError extends DatabaseError {
	constructor(
		code: 'UPGRADE_FAILED' | 'UPGRADE_BLOCKED',
		message: string,
		cause?: unknown,
	) {
		super(code, message, cause)
		this.name = 'UpgradeError'
	}
}

/**
 * Error thrown when database connection fails to open.
 *
 * @remarks
 * Thrown when `indexedDB.open()` fails for any reason.
 */
export class OpenError extends DatabaseError {
	constructor(message: string, cause?: unknown) {
		super('OPEN_FAILED', message, cause)
		this.name = 'OpenError'
	}
}

/**
 * Error thrown for invalid data operations.
 *
 * @remarks
 * Thrown when data doesn't match expected format or constraints.
 */
export class DataError extends DatabaseError {
	constructor(message: string, cause?: unknown) {
		super('DATA_ERROR', message, cause)
		this.name = 'DataError'
	}
}

/**
 * Error thrown when attempting write on read-only transaction.
 */
export class ReadOnlyError extends DatabaseError {
	constructor(message: string, cause?: unknown) {
		super('READ_ONLY', message, cause)
		this.name = 'ReadOnlyError'
	}
}

/**
 * Error thrown for version conflicts.
 */
export class VersionError extends DatabaseError {
	constructor(message: string, cause?: unknown) {
		super('VERSION_ERROR', message, cause)
		this.name = 'VersionError'
	}
}

/**
 * Error thrown when database is in invalid state.
 */
export class InvalidStateError extends DatabaseError {
	constructor(message: string, cause?: unknown) {
		super('INVALID_STATE', message, cause)
		this.name = 'InvalidStateError'
	}
}

/**
 * Error thrown when operation times out.
 */
export class TimeoutError extends DatabaseError {
	constructor(message: string, cause?: unknown) {
		super('TIMEOUT', message, cause)
		this.name = 'TimeoutError'
	}
}

// ============================================================================
// Error Wrapping
// ============================================================================

/**
 * Wraps a native DOMException into a typed DatabaseError.
 *
 * @param error - The native error to wrap
 * @param context - Optional context about the operation
 * @returns Typed DatabaseError subclass
 *
 * @example
 * ```ts
 * request.onerror = () => {
 *   throw wrapError(request.error, { storeName: 'users', key: 'u1' })
 * }
 * ```
 */
export function wrapError(error: DOMException | null, context?: ErrorContext): DatabaseError {
	if (!error) {
		return new DatabaseError('UNKNOWN_ERROR', 'Unknown error occurred')
	}

	const storeName = context?.storeName ?? ''
	const key = context?.key ?? ''

	switch (error.name) {
		case 'ConstraintError':
			return new ConstraintError(storeName, key, error)

		case 'QuotaExceededError':
			return new QuotaExceededError(error)

		case 'TransactionInactiveError':
			return new TransactionError(
				'TRANSACTION_INACTIVE',
				error.message || 'Transaction is not active',
				error,
			)

		case 'AbortError':
			return new TransactionError(
				'TRANSACTION_ABORTED',
				error.message || 'Transaction was aborted',
				error,
			)

		case 'VersionError':
			return new VersionError(error.message || 'Version error', error)

		case 'DataError':
			return new DataError(error.message || 'Data error', error)

		case 'InvalidStateError':
			return new InvalidStateError(error.message || 'Invalid state', error)

		case 'ReadOnlyError':
			return new ReadOnlyError(
				error.message || 'Attempted write in read-only transaction',
				error,
			)

		case 'NotFoundError':
			// Native NotFoundError is for missing stores/indexes, not records
			return new DatabaseError(
				'NOT_FOUND',
				error.message || 'Object store or index not found',
				error,
			)

		case 'TimeoutError':
			return new TimeoutError(error.message || 'Operation timed out', error)

		default:
			return new DatabaseError(
				'UNKNOWN_ERROR',
				error.message || `Unknown error: ${error.name}`,
				error,
			)
	}
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for DatabaseError.
 *
 * @param error - Value to check
 * @returns true if error is a DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
	return error instanceof DatabaseError
}

/**
 * Type guard for NotFoundError.
 *
 * @param error - Value to check
 * @returns true if error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
	return error instanceof NotFoundError
}

/**
 * Type guard for ConstraintError.
 *
 * @param error - Value to check
 * @returns true if error is a ConstraintError
 */
export function isConstraintError(error: unknown): error is ConstraintError {
	return error instanceof ConstraintError
}

/**
 * Type guard for QuotaExceededError.
 *
 * @param error - Value to check
 * @returns true if error is a QuotaExceededError
 */
export function isQuotaExceededError(error: unknown): error is QuotaExceededError {
	return error instanceof QuotaExceededError
}

/**
 * Type guard for TransactionError.
 *
 * @param error - Value to check
 * @returns true if error is a TransactionError
 */
export function isTransactionError(error: unknown): error is TransactionError {
	return error instanceof TransactionError
}

/**
 * Type guard for UpgradeError.
 *
 * @param error - Value to check
 * @returns true if error is an UpgradeError
 */
export function isUpgradeError(error: unknown): error is UpgradeError {
	return error instanceof UpgradeError
}

/**
 * Type guard for OpenError.
 *
 * @param error - Value to check
 * @returns true if error is an OpenError
 */
export function isOpenError(error: unknown): error is OpenError {
	return error instanceof OpenError
}

/**
 * Type guard for DataError.
 *
 * @param error - Value to check
 * @returns true if error is a DataError
 */
export function isDataError(error: unknown): error is DataError {
	return error instanceof DataError
}

/**
 * Type guard for checking specific error code.
 *
 * @param error - Value to check
 * @param code - Error code to match
 * @returns true if error is a DatabaseError with matching code
 */
export function hasErrorCode(
	error: unknown,
	code: DatabaseErrorCode,
): error is DatabaseError {
	return error instanceof DatabaseError && error.code === code
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Formats a key for display in error messages.
 */
function formatKey(key: ValidKey): string {
	if (typeof key === 'string') {
		return `"${key}"`
	}
	if (typeof key === 'number') {
		return String(key)
	}
	if (key instanceof Date) {
		return key.toISOString()
	}
	if (Array.isArray(key)) {
		return `[${key.map(formatKey).join(', ')}]`
	}
	if (key instanceof ArrayBuffer || ArrayBuffer.isView(key)) {
		return '[Binary Data]'
	}
	return String(key)
}
