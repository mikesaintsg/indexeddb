/**
 * Index Operations Example
 *
 * Demonstrates:
 * - Accessing indexes via store.index()
 * - Index accessors (getName, getKeyPath, isUnique, isMultiEntry)
 * - Index queries (get, resolve, getKey, all, keys, count)
 * - Unique vs non-unique indexes
 * - Multi-entry indexes for arrays
 */

import type { DatabaseInterface } from '~/src/types.js'
import type { AppSchema, ExampleResult } from './types.js'

/**
 * Demonstrates index accessors
 */
export function demonstrateIndexAccessors(db: DatabaseInterface<AppSchema>): ExampleResult {
	const store = db.store('users')

	// Access different indexes
	const emailIndex = store.index('byEmail')
	const statusIndex = store.index('byStatus')
	const tagsIndex = store.index('byTags')

	return {
		success: true,
		message: 'Index accessor methods',
		data: {
			emailIndex: {
				name: emailIndex.getName(),
				keyPath: emailIndex.getKeyPath(),
				unique: emailIndex.isUnique(),
				multiEntry: emailIndex.isMultiEntry(),
			},
			statusIndex: {
				name: statusIndex.getName(),
				keyPath: statusIndex.getKeyPath(),
				unique: statusIndex.isUnique(),
				multiEntry: statusIndex.isMultiEntry(),
			},
			tagsIndex: {
				name: tagsIndex.getName(),
				keyPath: tagsIndex.getKeyPath(),
				unique: tagsIndex.isUnique(),
				multiEntry: tagsIndex.isMultiEntry(),
			},
		},
		code: `
const emailIndex = store.index('byEmail')

emailIndex.getName()      // 'byEmail'
emailIndex.getKeyPath()   // 'email'
emailIndex.isUnique()     // true
emailIndex.isMultiEntry() // false

// Multi-entry index for arrays
const tagsIndex = store.index('byTags')
tagsIndex.isMultiEntry()  // true
`.trim(),
	}
}

/**
 * Demonstrates index get/resolve operations
 */
export async function demonstrateIndexLookup(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	const emailIndex = store.index('byEmail')

	// Get by index key (returns first match)
	const userByEmail = await emailIndex.get('alice@example.com')

	// Get returns undefined for missing
	const missing = await emailIndex.get('nonexistent@example.com')

	// resolve throws for missing
	let resolveError = ''
	try {
		await emailIndex.resolve('nonexistent@example.com')
	} catch {
		resolveError = 'NotFoundError thrown as expected'
	}

	// Get primary key for an index key
	const primaryKey = await emailIndex.getKey('alice@example.com')

	return {
		success: true,
		message: 'Index lookup operations',
		data: {
			userByEmail: userByEmail?.name ?? 'not found',
			missing: missing === undefined ? 'undefined (correct)' : 'found',
			resolveError,
			primaryKey,
		},
		code: `
const emailIndex = store.index('byEmail')

// Get by index key (returns first match)
const user = await emailIndex.get('alice@example.com')

// Returns undefined for missing
const missing = await emailIndex.get('nonexistent@example.com')  // undefined

// resolve throws for missing
const user = await emailIndex.resolve('alice@example.com')  // Throws if not found

// Get primary key for an index key
const primaryKey = await emailIndex.getKey('alice@example.com')  // 'u1'
`.trim(),
	}
}

/**
 * Demonstrates non-unique index queries
 */
export async function demonstrateNonUniqueIndex(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	const statusIndex = store.index('byStatus')

	// Get all with specific status (non-unique index)
	const activeUsers = await statusIndex.all(IDBKeyRange.only('active'))
	const inactiveUsers = await statusIndex.all(IDBKeyRange.only('inactive'))

	// Count by status
	const activeCount = await statusIndex.count('active')
	const inactiveCount = await statusIndex.count('inactive')

	return {
		success: true,
		message: 'Non-unique index queries',
		data: {
			activeUsers: activeUsers.map(u => u.name),
			inactiveUsers: inactiveUsers.map(u => u.name),
			activeCount,
			inactiveCount,
		},
		code: `
const statusIndex = store.index('byStatus')

// Get all matching a specific value
const activeUsers = await statusIndex.all(IDBKeyRange.only('active'))

// Count records with specific index value
const activeCount = await statusIndex.count('active')
const inactiveCount = await statusIndex.count('inactive')
`.trim(),
	}
}

/**
 * Demonstrates multi-entry index for arrays
 */
export async function demonstrateMultiEntryIndex(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	const tagsIndex = store.index('byTags')

	// Multi-entry index allows querying by individual array elements
	const developers = await tagsIndex.all(IDBKeyRange.only('developer'))
	const designers = await tagsIndex.all(IDBKeyRange.only('designer'))

	return {
		success: true,
		message: 'Multi-entry index for arrays',
		data: {
			developersCount: developers.length,
			developers: developers.map(u => ({ name: u.name, tags: u.tags })),
			designersCount: designers.length,
			designers: designers.map(u => ({ name: u.name, tags: u.tags })),
		},
		code: `
// Multi-entry index indexes each array element separately
// User: { tags: ['developer', 'leader'] }
// Creates index entries for both 'developer' AND 'leader'

const tagsIndex = store.index('byTags')  // multiEntry: true

// Find all users with 'developer' tag
const developers = await tagsIndex.all(IDBKeyRange.only('developer'))

// Find all users with 'designer' tag
const designers = await tagsIndex.all(IDBKeyRange.only('designer'))
`.trim(),
	}
}

/**
 * Demonstrates index range queries
 */
export async function demonstrateIndexRangeQueries(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	const ageIndex = store.index('byAge')

	// Range queries on numeric index
	const over30 = await ageIndex.all(IDBKeyRange.lowerBound(30))
	const under30 = await ageIndex.all(IDBKeyRange.upperBound(30, true))
	const between25And35 = await ageIndex.all(IDBKeyRange.bound(25, 35))

	return {
		success: true,
		message: 'Index range queries',
		data: {
			over30: over30.map(u => ({ name: u.name, age: u.age })),
			under30: under30.map(u => ({ name: u.name, age: u.age })),
			between25And35: between25And35.map(u => ({ name: u.name, age: u.age })),
		},
		code: `
const ageIndex = store.index('byAge')

// Users over 30
const over30 = await ageIndex.all(IDBKeyRange.lowerBound(30))

// Users under 30 (exclusive)
const under30 = await ageIndex.all(IDBKeyRange.upperBound(30, true))

// Users between 25 and 35 (inclusive)
const between25And35 = await ageIndex.all(IDBKeyRange.bound(25, 35))
`.trim(),
	}
}

/**
 * Demonstrates Index.has() - Existence check by index key
 */
export async function demonstrateIndexHas(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	const emailIndex = store.index('byEmail')

	// Check if record exists by index key
	const exists = await emailIndex.has('alice@example.com')
	const missing = await emailIndex.has('nonexistent@example.com')

	// Batch check
	const checks = await emailIndex.has([
		'alice@example.com',
		'bob@example.com',
		'nonexistent@example.com',
	])

	return {
		success: true,
		message: 'Index has() checks existence by index key',
		data: {
			exists,
			missing,
			batchChecks: checks,
		},
		code: `
const emailIndex = store.index('byEmail')

// Check if record exists by index key
const exists = await emailIndex.has('alice@example.com')  // true
const missing = await emailIndex.has('nonexistent@example.com')  // false

// Batch check - returns array of booleans
const checks = await emailIndex.has([
  'alice@example.com',
  'bob@example.com',
  'nonexistent@example.com'
])
// [true, true, false]
`.trim(),
	}
}

/**
 * Demonstrates native index access
 */
export function demonstrateNativeIndexAccess(db: DatabaseInterface<AppSchema>): ExampleResult {
	const store = db.store('users')
	const emailIndex = store.index('byEmail')

	// Access native IDBIndex
	const nativeIndex = emailIndex.native

	return {
		success: true,
		message: 'Native IDBIndex access',
		data: {
			nativeName: nativeIndex.name,
			nativeKeyPath: nativeIndex.keyPath,
			nativeUnique: nativeIndex.unique,
			nativeMultiEntry: nativeIndex.multiEntry,
		},
		code: `
const emailIndex = store.index('byEmail')

// Access native IDBIndex for advanced operations
const nativeIndex = emailIndex.native

// Use native APIs
nativeIndex.name        // 'byEmail'
nativeIndex.keyPath     // 'email'
nativeIndex.unique      // true
nativeIndex.multiEntry  // false
`.trim(),
	}
}
