/**
 * Query Builder Example
 *
 * Demonstrates:
 * - where() - Indexed queries (fast)
 *   - equals(), greaterThan(), lessThan(), between()
 *   - startsWith(), anyOf()
 * - filter() - Post-cursor filtering (flexible)
 * - orderBy() - Result ordering
 * - limit(), offset() - Pagination
 * - Terminal operations: toArray(), first(), count(), keys(), iterate()
 */

import type { DatabaseInterface } from '~/src/types.js'
import type { AppSchema, ExampleResult } from './types.js'

/**
 * Demonstrates where().equals() - Indexed equality query
 */
export async function demonstrateWhereEquals(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Fast indexed query using where().equals()
	const activeUsers = await store.query()
		.where('byStatus').equals('active')
		.toArray()

	// Query by role
	const admins = await store.query()
		.where('byRole').equals('admin')
		.toArray()

	return {
		success: true,
		message: 'where().equals() - Fast indexed queries',
		data: {
			activeUsers: activeUsers.map(u => u.name),
			admins: admins.map(u => u.name),
		},
		code: `
// Fast indexed query using where().equals()
const activeUsers = await store.query()
  .where('byStatus').equals('active')
  .toArray()

// Query by role
const admins = await store.query()
  .where('byRole').equals('admin')
  .toArray()

// Note: Uses IDBKeyRange.only() internally for performance
`.trim(),
	}
}

/**
 * Demonstrates comparison queries
 */
export async function demonstrateComparisonQueries(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Greater than
	const over30 = await store.query()
		.where('byAge').greaterThan(30)
		.toArray()

	// Less than or equal
	const under30 = await store.query()
		.where('byAge').lessThanOrEqual(30)
		.toArray()

	// Between (inclusive by default)
	const between25And35 = await store.query()
		.where('byAge').between(25, 35)
		.toArray()

	// Between with exclusivity options
	const between25And35Exclusive = await store.query()
		.where('byAge').between(25, 35, { lowerOpen: true, upperOpen: true })
		.toArray()

	return {
		success: true,
		message: 'Comparison queries: greaterThan, lessThan, between',
		data: {
			over30: over30.map(u => ({ name: u.name, age: u.age })),
			under30: under30.map(u => ({ name: u.name, age: u.age })),
			between25And35: between25And35.map(u => ({ name: u.name, age: u.age })),
			between25And35Exclusive: between25And35Exclusive.map(u => ({ name: u.name, age: u.age })),
		},
		code: `
// Greater than (exclusive)
const over30 = await store.query()
  .where('byAge').greaterThan(30)
  .toArray()

// Less than or equal (inclusive)
const under30 = await store.query()
  .where('byAge').lessThanOrEqual(30)
  .toArray()

// Between (inclusive by default)
const between = await store.query()
  .where('byAge').between(25, 35)
  .toArray()

// With exclusivity options
const betweenExclusive = await store.query()
  .where('byAge').between(25, 35, { lowerOpen: true, upperOpen: true })
  .toArray()
`.trim(),
	}
}

/**
 * Demonstrates startsWith() query
 */
export async function demonstrateStartsWith(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Find emails starting with a prefix
	const aEmails = await store.query()
		.where('byEmail').startsWith('a')
		.toArray()

	return {
		success: true,
		message: 'startsWith() - String prefix queries',
		data: {
			aEmails: aEmails.map(u => ({ name: u.name, email: u.email })),
		},
		code: `
// String prefix query
const aEmails = await store.query()
  .where('byEmail').startsWith('a')  // 'alice@...', 'adam@...', etc.
  .toArray()

// Uses IDBKeyRange.bound(prefix, prefix + '\\uffff')
`.trim(),
	}
}

/**
 * Demonstrates anyOf() query
 */
export async function demonstrateAnyOf(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Find users with any of the specified roles
	const adminOrUser = await store.query()
		.where('byRole').anyOf(['admin', 'user'])
		.toArray()

	return {
		success: true,
		message: 'anyOf() - Multiple value queries',
		data: {
			adminOrUser: adminOrUser.map(u => ({ name: u.name, role: u.role })),
		},
		code: `
// Find records matching any of multiple values
const adminOrUser = await store.query()
  .where('byRole').anyOf(['admin', 'user'])
  .toArray()

// Executes parallel queries and merges results
// Results are deduplicated by primary key
`.trim(),
	}
}

/**
 * Demonstrates filter() - Post-cursor filtering
 */
export async function demonstrateFilter(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Filter for conditions that can't use indexes
	const gmailUsers = await store.query()
		.filter(u => u.email.endsWith('@example.com'))
		.toArray()

	// Complex filter conditions
	const activeAdults = await store.query()
		.filter(u => u.age >= 30 && u.status === 'active')
		.toArray()

	// Regex filter
	const namePattern = await store.query()
		.filter(u => /^[A-D]/.test(u.name))
		.toArray()

	return {
		success: true,
		message: 'filter() - Flexible post-cursor filtering',
		data: {
			gmailUsers: gmailUsers.map(u => u.email),
			activeAdults: activeAdults.map(u => ({ name: u.name, age: u.age })),
			namePattern: namePattern.map(u => u.name),
		},
		code: `
// Filter for conditions that can't use indexes
const gmailUsers = await store.query()
  .filter(u => u.email.endsWith('@gmail.com'))
  .toArray()

// Complex conditions
const activeAdults = await store.query()
  .filter(u => u.age >= 30 && u.status === 'active')
  .toArray()

// Regex matching
const pattern = await store.query()
  .filter(u => /^J.*n$/.test(u.name))
  .toArray()
`.trim(),
	}
}

/**
 * Demonstrates combining where() and filter()
 */
export async function demonstrateCombinedQuery(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Best practice: narrow with index first, then filter
	const activeWithE = await store.query()
		.where('byStatus').equals('active')  // Fast: uses index
		.filter(u => u.name.includes('a'))   // Then: post-filter
		.toArray()

	return {
		success: true,
		message: 'Combining where() and filter() for optimal performance',
		data: {
			activeWithE: activeWithE.map(u => u.name),
		},
		code: `
// Best practice: narrow with index first, then filter
const results = await store.query()
  .where('byStatus').equals('active')  // Fast: uses index
  .filter(u => u.email.endsWith('@gmail.com'))  // Then: post-filter
  .toArray()

// This is more efficient than filtering all records
`.trim(),
	}
}

/**
 * Demonstrates ascending(), descending() and pagination
 */
export async function demonstrateOrderingAndPagination(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Ascending order (default)
	const ascending = await store.query()
		.where('byAge').greaterThanOrEqual(0)
		.ascending()
		.toArray()

	// Descending order
	const descending = await store.query()
		.where('byAge').greaterThanOrEqual(0)
		.descending()
		.toArray()

	// Pagination
	const page1 = await store.query()
		.limit(2)
		.offset(0)
		.toArray()

	const page2 = await store.query()
		.limit(2)
		.offset(2)
		.toArray()

	return {
		success: true,
		message: 'ascending(), descending() and limit/offset pagination',
		data: {
			ascending: ascending.map((u: { name: string; age: number }) => ({ name: u.name, age: u.age })),
			descending: descending.map((u: { name: string; age: number }) => ({ name: u.name, age: u.age })),
			page1: page1.map(u => u.name),
			page2: page2.map(u => u.name),
		},
		code: `
// Ascending order (default)
const ascending = await store.query()
  .where('byAge').greaterThanOrEqual(0)
  .ascending()
  .toArray()

// Descending order
const descending = await store.query()
  .descending()
  .toArray()

// Pagination
const page1 = await store.query().limit(10).offset(0).toArray()
const page2 = await store.query().limit(10).offset(10).toArray()
`.trim(),
	}
}

/**
 * Demonstrates terminal operations
 */
export async function demonstrateTerminalOperations(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// toArray() - Get all matching records
	const all = await store.query()
		.where('byStatus').equals('active')
		.toArray()

	// first() - Get first match only
	const first = await store.query()
		.where('byStatus').equals('active')
		.first()

	// count() - Count matches
	const count = await store.query()
		.where('byStatus').equals('active')
		.count()

	// keys() - Get keys only
	const keys = await store.query()
		.where('byStatus').equals('active')
		.keys()

	return {
		success: true,
		message: 'Terminal operations: toArray, first, count, keys',
		data: {
			allCount: all.length,
			first: first?.name ?? 'none',
			count,
			keys,
		},
		code: `
// Get all matching records
const records = await query.toArray()

// Get first match only (more efficient)
const first = await query.first()

// Count matches (without loading data)
const count = await query.count()

// Get keys only (more efficient than full records)
const keys = await query.keys()

// Memory-efficient iteration
for await (const record of query.iterate()) {
  processRecord(record)
  if (done) break  // Early termination supported
}
`.trim(),
	}
}

/**
 * Demonstrates iterate() - Memory-efficient iteration
 */
export async function demonstrateQueryIterate(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Memory-efficient iteration
	const names: string[] = []
	for await (const user of store.query().where('byStatus').equals('active').iterate()) {
		names.push(user.name)
	}

	// Early termination
	let firstActive: string | undefined
	for await (const user of store.query().iterate()) {
		if (user.status === 'active') {
			firstActive = user.name
			break  // Clean early termination
		}
	}

	return {
		success: true,
		message: 'iterate() - Memory-efficient async generator',
		data: {
			iteratedNames: names,
			firstActive,
		},
		code: `
// Memory-efficient iteration
for await (const user of store.query().iterate()) {
  processUser(user)
  if (done) break  // Clean early termination
}

// Only one record in memory at a time
// Great for large datasets
`.trim(),
	}
}

/**
 * Demonstrates boolean field queries (automatic fallback)
 */
export async function demonstrateBooleanQueries(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('posts')

	// Boolean values are NOT valid IndexedDB keys
	// The library automatically falls back to post-cursor filtering
	const publishedPosts = await store.query()
		.where('byPublished').equals(true)
		.toArray()

	const draftPosts = await store.query()
		.where('byPublished').equals(false)
		.toArray()

	return {
		success: true,
		message: 'Boolean queries - Automatic fallback to filter',
		data: {
			publishedPosts: publishedPosts.map(p => p.title),
			draftPosts: draftPosts.map(p => p.title),
		},
		code: `
// Boolean values are NOT valid IndexedDB keys
// The library automatically handles this

const published = await store.query()
  .where('byPublished').equals(true)  // Works! Falls back to filter
  .toArray()

// This is equivalent to:
const published = await store.query()
  .filter(post => post.published === true)
  .toArray()

// For better performance, consider storing as 0/1 instead
`.trim(),
	}
}
