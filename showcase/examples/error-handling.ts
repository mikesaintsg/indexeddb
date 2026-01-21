/**
 * Error Handling Example
 *
 * Demonstrates:
 * - Error classes (DatabaseError, NotFoundError, ConstraintError, etc.)
 * - Error codes and properties
 * - Type guards (isDatabaseError, isNotFoundError, etc.)
 * - Error wrapping and native error handling
 */

import type { DatabaseInterface } from '@mikesaintsg/indexeddb'
import {
	NotFoundError,
	ConstraintError,
	isDatabaseError,
	isNotFoundError,
	isConstraintError,
	hasErrorCode,
} from '@mikesaintsg/indexeddb'
import type { AppSchema, ExampleResult } from './types.js'

/**
 * Demonstrates NotFoundError handling
 */
export async function demonstrateNotFoundError(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	let errorDetails: { name: string; code: string; key: string; storeName: string } | null = null

	try {
		// resolve() throws NotFoundError if record doesn't exist
		await store.resolve('nonexistent-user')
	} catch (error) {
		if (error instanceof NotFoundError) {
			errorDetails = {
				name: error.name,
				code: error.code,
				key: JSON.stringify(error.key),
				storeName: error.storeName,
			}
		}
	}

	return {
		success: true,
		message: 'NotFoundError - Thrown by resolve() for missing records',
		data: {
			errorDetails,
		},
		code: `
try {
  const user = await store.resolve('nonexistent')
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log(\`Key: \${error.key}\`)
    console.log(\`Store: \${error.storeName}\`)
    console.log(\`Code: \${error.code}\`)  // 'NOT_FOUND'
  }
}

// NotFoundError properties:
// - code: 'NOT_FOUND'
// - key: ValidKey - The missing key
// - storeName: string - The store name
`.trim(),
	}
}

/**
 * Demonstrates ConstraintError handling
 */
export async function demonstrateConstraintError(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	let errorDetails: { name: string; code: string; key: string } | null = null

	// First add a user
	await store.set({
		id: 'constraint-test',
		name: 'Constraint Test',
		email: 'constraint@test.com',
		age: 30,
		status: 'active',
		role: 'user',
		tags: [],
		createdAt: Date.now(),
	})

	try {
		// add() throws ConstraintError if key already exists
		await store.add({
			id: 'constraint-test',
			name: 'Duplicate',
			email: 'dupe@test.com',
			age: 25,
			status: 'active',
			role: 'user',
			tags: [],
			createdAt: Date.now(),
		})
	} catch (error) {
		if (error instanceof ConstraintError) {
			errorDetails = {
				name: error.name,
				code: error.code,
				key: JSON.stringify(error.key),
			}
		}
	}

	// Cleanup
	await store.remove('constraint-test')

	return {
		success: true,
		message: 'ConstraintError - Thrown by add() for duplicate keys',
		data: {
			errorDetails,
		},
		code: `
try {
  await store.add({ id: 'existing', name: 'Duplicate' })
} catch (error) {
  if (error instanceof ConstraintError) {
    console.log('Key already exists:', error.key)

    // Common pattern: fallback to set() for upsert
    await store.set({ id: 'existing', name: 'Updated' })
  }
}

// ConstraintError properties:
// - code: 'CONSTRAINT_ERROR'
// - key: ValidKey - The conflicting key
// - storeName: string - The store name
`.trim(),
	}
}

/**
 * Demonstrates error code enumeration
 */
export function demonstrateErrorCodes(): ExampleResult {
	return {
		success: true,
		message: 'Error codes for different failure modes',
		data: {
			errorCodes: [
				'NOT_FOUND',
				'CONSTRAINT_ERROR',
				'QUOTA_EXCEEDED',
				'TRANSACTION_ABORTED',
				'TRANSACTION_INACTIVE',
				'OPEN_FAILED',
				'UPGRADE_FAILED',
				'UPGRADE_BLOCKED',
				'DATA_ERROR',
				'READ_ONLY',
				'VERSION_ERROR',
				'INVALID_STATE',
				'TIMEOUT',
				'UNKNOWN_ERROR',
			],
		},
		code: `
// All database errors have a code property
type DatabaseErrorCode =
  | 'OPEN_FAILED'           // Database failed to open
  | 'UPGRADE_FAILED'        // Migration or store creation failed
  | 'UPGRADE_BLOCKED'       // Other connections prevent upgrade
  | 'TRANSACTION_ABORTED'   // Transaction was aborted
  | 'TRANSACTION_INACTIVE'  // Operation on inactive transaction
  | 'CONSTRAINT_ERROR'      // Key/uniqueness constraint violated
  | 'QUOTA_EXCEEDED'        // Storage quota exceeded
  | 'NOT_FOUND'             // Record not found (resolve())
  | 'DATA_ERROR'            // Invalid data format
  | 'READ_ONLY'             // Write attempted on readonly transaction
  | 'VERSION_ERROR'         // Version conflict
  | 'INVALID_STATE'         // Database in invalid state
  | 'TIMEOUT'               // Operation timed out
  | 'UNKNOWN_ERROR'         // Unrecognized error
`.trim(),
	}
}

/**
 * Demonstrates type guards
 */
export async function demonstrateTypeGuards(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Capture different errors for testing
	let notFoundGuard = false
	let constraintGuard = false
	let databaseGuard = false
	let hasCodeGuard = false

	try {
		await store.resolve('nonexistent')
	} catch (error) {
		notFoundGuard = isNotFoundError(error)
		databaseGuard = isDatabaseError(error)
		hasCodeGuard = hasErrorCode(error, 'NOT_FOUND')
	}

	// Create and test constraint error
	await store.set({
		id: 'guard-test',
		name: 'Guard Test',
		email: 'guard@test.com',
		age: 30,
		status: 'active',
		role: 'user',
		tags: [],
		createdAt: Date.now(),
	})

	try {
		await store.add({
			id: 'guard-test',
			name: 'Duplicate',
			email: 'dupe@test.com',
			age: 25,
			status: 'active',
			role: 'user',
			tags: [],
			createdAt: Date.now(),
		})
	} catch (error) {
		constraintGuard = isConstraintError(error)
	}

	// Cleanup
	await store.remove('guard-test')

	return {
		success: true,
		message: 'Type guards for safe error handling',
		data: {
			isNotFoundError: notFoundGuard,
			isConstraintError: constraintGuard,
			isDatabaseError: databaseGuard,
			hasErrorCode: hasCodeGuard,
		},
		code: `
import {
  isDatabaseError,
  isNotFoundError,
  isConstraintError,
  isQuotaExceededError,
  isTransactionError,
  hasErrorCode
} from '@mikesaintsg/indexeddb'

try {
  await store.resolve('u1')
} catch (error) {
  if (isNotFoundError(error)) {
    // error is typed as NotFoundError
    console.log(error.key, error.storeName)
  } else if (isConstraintError(error)) {
    // error is typed as ConstraintError
    console.log(error.key)
  } else if (isDatabaseError(error)) {
    // error is typed as DatabaseError
    console.log(error.code, error.message)
  }

  // Check for specific error code
  if (hasErrorCode(error, 'QUOTA_EXCEEDED')) {
    showStorageFullMessage()
  }
}
`.trim(),
	}
}

/**
 * Demonstrates error hierarchy
 */
export function demonstrateErrorHierarchy(): ExampleResult {
	return {
		success: true,
		message: 'Error class hierarchy',
		data: {
			hierarchy: [
				'DatabaseError (base)',
				'  └─ NotFoundError',
				'  └─ ConstraintError',
				'  └─ QuotaExceededError',
				'  └─ TransactionError',
				'  └─ UpgradeError',
				'  └─ OpenError',
				'  └─ DataError',
				'  └─ ReadOnlyError',
				'  └─ VersionError',
				'  └─ InvalidStateError',
				'  └─ TimeoutError',
			],
		},
		code: `
// Error class hierarchy:
// DatabaseError (base) — all database errors
//   └─ NotFoundError — resolve() when record missing
//   └─ ConstraintError — add() when key exists
//   └─ QuotaExceededError — storage quota exceeded
//   └─ TransactionError — transaction aborted or inactive
//   └─ UpgradeError — database upgrade failed or blocked
//   └─ OpenError — database failed to open
//   └─ DataError — invalid data format
//   └─ ReadOnlyError — write on readonly transaction
//   └─ VersionError — version conflict
//   └─ InvalidStateError — invalid database state
//   └─ TimeoutError — operation timed out

// All errors extend DatabaseError
if (error instanceof DatabaseError) {
  console.log(error.code)     // Error code
  console.log(error.message)  // Error message
  console.log(error.cause)    // Original error (if wrapped)
}
`.trim(),
	}
}

/**
 * Demonstrates comprehensive error handling pattern
 */
export async function demonstrateComprehensiveErrorHandling(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Try various operations that might fail
	const results: string[] = []

	// 1. Handle get() - no error, returns undefined
	const user = await store.get('nonexistent')
	results.push(`get() returns: ${user === undefined ? 'undefined' : 'value'}`)

	// 2. Handle resolve() - throws NotFoundError
	try {
		await store.resolve('nonexistent')
	} catch (error) {
		if (isNotFoundError(error)) {
			results.push('resolve() throws NotFoundError')
		}
	}

	// 3. Handle add() - throws ConstraintError
	await store.set({
		id: 'error-demo',
		name: 'Demo',
		email: 'demo@test.com',
		age: 30,
		status: 'active',
		role: 'user',
		tags: [],
		createdAt: Date.now(),
	})
	try {
		await store.add({
			id: 'error-demo',
			name: 'Duplicate',
			email: 'dupe@test.com',
			age: 25,
			status: 'active',
			role: 'user',
			tags: [],
			createdAt: Date.now(),
		})
	} catch (error) {
		if (isConstraintError(error)) {
			results.push('add() throws ConstraintError')
		}
	}

	// Cleanup
	await store.remove('error-demo')

	return {
		success: true,
		message: 'Comprehensive error handling patterns',
		data: {
			results,
		},
		code: `
// Comprehensive error handling pattern
async function safeOperation() {
  try {
    const user = await store.resolve('u1')
    await store.add(newRecord)
  } catch (error) {
    if (isNotFoundError(error)) {
      // Handle missing record
      return createDefault()
    }

    if (isConstraintError(error)) {
      // Handle duplicate key
      return store.set(record)  // Fallback to upsert
    }

    if (isQuotaExceededError(error)) {
      // Handle storage full
      await clearOldData()
      return retry()
    }

    if (isTransactionError(error)) {
      // Handle transaction failure
      await retry()
    }

    // Unknown error - rethrow
    throw error
  }
}
`.trim(),
	}
}
