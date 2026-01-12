/**
 * Store Operations Example - Basic CRUD
 *
 * Demonstrates:
 * - get() - Optional lookup (returns undefined for missing)
 * - resolve() - Required lookup (throws NotFoundError)
 * - set() - Upsert (insert or update)
 * - add() - Insert only (throws ConstraintError if exists)
 * - remove() - Delete (silently succeeds if missing)
 * - has() - Existence check
 * - all(), keys(), count(), clear()
 */

import type { DatabaseInterface } from '~/src/types.js'
import { isNotFoundError, isConstraintError } from '~/src/index.js'
import type { AppSchema, User, ExampleResult } from './types.js'
import { SAMPLE_USERS } from './types.js'

/**
 * Demonstrates get() - Optional lookup
 */
export async function demonstrateGet(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Single key - returns T | undefined
	const user = await store.get('u1')
	const missing = await store.get('nonexistent')

	// Multiple keys - returns readonly (T | undefined)[]
	const userKeys: readonly string[] = ['u1', 'u2', 'nonexistent']
	const users = await store.get(userKeys)

	return {
		success: true,
		message: 'get() returns undefined for missing records',
		data: {
			single: user?.name ?? 'undefined',
			missing: missing === undefined ? 'undefined (as expected)' : 'found',
			batch: users.map((u) => u?.name ?? 'undefined'),
		},
		code: `
// Single key lookup - returns T | undefined
const user = await store.get('u1')
if (user) {
  console.log(user.name)  // Safe to access
}

// Missing key returns undefined (no error)
const missing = await store.get('nonexistent')  // undefined

// Batch lookup - some may be undefined
const users = await store.get(['u1', 'u2', 'nonexistent'])
// users[2] is undefined
`.trim(),
	}
}

/**
 * Demonstrates resolve() - Required lookup that throws
 */
export async function demonstrateResolve(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	let errorMessage = ''

	// Successful resolve
	const user = await store.resolve('u1')

	// Attempt to resolve missing record
	try {
		await store.resolve('nonexistent')
	} catch (error) {
		if (isNotFoundError(error)) {
			errorMessage = `NotFoundError: Key "${JSON.stringify(error.key)}" not found in "${error.storeName}"`
		}
	}

	return {
		success: true,
		message: 'resolve() throws NotFoundError for missing records',
		data: {
			found: user.name,
			error: errorMessage,
		},
		code: `
// resolve() throws if record doesn't exist
try {
  const user = await store.resolve('u1')
  console.log(user.name)  // Guaranteed to exist
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log(\`Key \${error.key} not found in \${error.storeName}\`)
  }
}

// Batch resolve - throws if ANY is missing
const users = await store.resolve(['u1', 'u2', 'u3'])
`.trim(),
	}
}

/**
 * Demonstrates set() - Upsert operation
 */
export async function demonstrateSet(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Single record set (insert or update)
	const key = await store.set({
		id: 'demo-user',
		name: 'Demo User',
		email: 'demo@example.com',
		age: 30,
		status: 'active',
		role: 'user',
		tags: ['demo'],
		createdAt: Date.now(),
	})

	// Update the same record
	await store.set({
		id: 'demo-user',
		name: 'Demo User (Updated)',
		email: 'demo@example.com',
		age: 31,
		status: 'active',
		role: 'user',
		tags: ['demo', 'updated'],
		createdAt: Date.now(),
	})

	// Batch set (single transaction, atomic)
	const keys = await store.set([...SAMPLE_USERS])

	// Cleanup demo user
	await store.remove('demo-user')

	return {
		success: true,
		message: 'set() upserts records (insert or update)',
		data: {
			singleKey: key,
			batchKeys: keys,
		},
		code: `
// Single record - insert or update (upsert)
const key = await store.set({ id: 'u1', name: 'Alice', ... })

// Update existing record (same key)
await store.set({ id: 'u1', name: 'Alice (Updated)', ... })

// Batch set - single transaction, atomic
const keys = await store.set([user1, user2, user3])
`.trim(),
	}
}

/**
 * Demonstrates add() - Insert only operation
 */
export async function demonstrateAdd(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	let errorMessage = ''

	// Successful add
	const newUser: User = {
		id: 'new-user',
		name: 'New User',
		email: 'new@example.com',
		age: 25,
		status: 'active',
		role: 'guest',
		tags: ['new'],
		createdAt: Date.now(),
	}
	const key = await store.add(newUser)

	// Attempt to add duplicate key
	try {
		await store.add(newUser)  // Same key - will throw
	} catch (error) {
		if (isConstraintError(error)) {
			errorMessage = `ConstraintError: Key "${JSON.stringify(error.key)}" already exists`
		}
	}

	// Cleanup
	await store.remove('new-user')

	return {
		success: true,
		message: 'add() throws ConstraintError if key exists',
		data: {
			addedKey: key,
			duplicateError: errorMessage,
		},
		code: `
// add() inserts only - throws if key exists
try {
  await store.add({ id: 'u1', name: 'Alice' })
} catch (error) {
  if (error instanceof ConstraintError) {
    console.log('User already exists, updating instead')
    await store.set({ id: 'u1', name: 'Alice' })
  }
}

// Batch add - fails if ANY key exists
await store.add([user1, user2, user3])
`.trim(),
	}
}

/**
 * Demonstrates remove() - Delete operation
 */
export async function demonstrateRemove(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Add a test user
	await store.set({
		id: 'to-delete',
		name: 'To Delete',
		email: 'delete@example.com',
		age: 0,
		status: 'inactive',
		role: 'guest',
		tags: [],
		createdAt: Date.now(),
	})

	const beforeCount = await store.count()

	// Single key remove
	await store.remove('to-delete')

	// Remove nonexistent key - silently succeeds
	await store.remove('nonexistent')

	const afterCount = await store.count()

	return {
		success: true,
		message: 'remove() silently succeeds for missing keys',
		data: {
			beforeCount,
			afterCount,
			difference: beforeCount - afterCount,
		},
		code: `
// Single key remove
await store.remove('u1')

// Removing nonexistent key - no error
await store.remove('nonexistent')  // Silently succeeds

// Batch remove
await store.remove(['u1', 'u2', 'u3'])
`.trim(),
	}
}

/**
 * Demonstrates has() - Existence check
 */
export async function demonstrateHas(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Single key check
	const exists = await store.has('u1')
	const missing = await store.has('nonexistent')

	// Batch check
	const checks = await store.has(['u1', 'u2', 'nonexistent'])

	return {
		success: true,
		message: 'has() checks if records exist',
		data: {
			exists,
			missing,
			batchChecks: checks,
		},
		code: `
// Single key existence check
const exists = await store.has('u1')  // true

// Missing key
const missing = await store.has('nonexistent')  // false

// Batch check
const checks = await store.has(['u1', 'u2', 'nonexistent'])
// [true, true, false]
`.trim(),
	}
}

/**
 * Demonstrates bulk operations: all(), keys(), count(), clear()
 */
export async function demonstrateBulkOperations(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Get all records
	const allUsers = await store.all()

	// Get all with limit
	const first3 = await store.all(null, 3)

	// Get all keys
	const allKeys = await store.keys()

	// Count records
	const count = await store.count()

	return {
		success: true,
		message: 'Bulk operations: all(), keys(), count()',
		data: {
			allCount: allUsers.length,
			first3Names: first3.map(u => u.name),
			allKeys,
			count,
		},
		code: `
// Get all records
const allUsers = await store.all()

// Get all with limit
const first3 = await store.all(null, 3)

// With key range
const range = IDBKeyRange.bound('a', 'z')
const subset = await store.all(range)

// Get all keys
const allKeys = await store.keys()

// Count records
const count = await store.count()

// Clear all records (dangerous!)
// await store.clear()
`.trim(),
	}
}

/**
 * Demonstrates store accessors
 */
export function demonstrateStoreAccessors(db: DatabaseInterface<AppSchema>): ExampleResult {
	const store = db.store('users')

	return {
		success: true,
		message: 'Store accessor methods',
		data: {
			name: store.getName(),
			keyPath: store.getKeyPath(),
			indexNames: store.getIndexNames(),
			autoIncrement: store.hasAutoIncrement(),
		},
		code: `
const store = db.store('users')

store.getName()           // 'users'
store.getKeyPath()        // 'id'
store.getIndexNames()     // ['byEmail', 'byStatus', ...]
store.hasAutoIncrement()  // false
`.trim(),
	}
}
