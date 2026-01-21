/**
 * Cursor Operations Example
 *
 * Demonstrates:
 * - iterate() - Async generator for memory-efficient iteration
 * - iterateKeys() - Key-only iteration
 * - openCursor() - Manual cursor for mutation
 * - Cursor navigation (continue, advance, continuePrimaryKey)
 * - Cursor mutation (update, delete during iteration)
 * - Cursor directions
 */

import type { DatabaseInterface } from '@mikesaintsg/indexeddb'
import type { AppSchema, ExampleResult } from './types.js'

/**
 * Demonstrates iterate() - Async generator
 */
export async function demonstrateCursorIterate(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Simple iteration
	const names: string[] = []
	for await (const user of store.iterate()) {
		names.push(user.name)
	}

	// With options (direction, query range)
	const reversedNames: string[] = []
	for await (const user of store.iterate({ direction: 'previous' })) {
		reversedNames.push(user.name)
	}

	return {
		success: true,
		message: 'iterate() - Memory-efficient async generator',
		data: {
			names,
			reversedNames,
		},
		code: `
// Simple iteration
for await (const user of store.iterate()) {
  console.log(user.name)
}

// With options
for await (const user of store.iterate({
  direction: 'previous',  // Reverse order
  query: IDBKeyRange.bound('a', 'm')  // Filter by key range
})) {
  console.log(user.name)
}

// Early termination is clean
for await (const user of store.iterate()) {
  if (found) break  // Resources properly cleaned up
}
`.trim(),
	}
}

/**
 * Demonstrates iterateKeys() - Key-only iteration
 */
export async function demonstrateIterateKeys(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Key-only iteration (more efficient)
	const keys: string[] = []
	for await (const key of store.iterateKeys()) {
		keys.push(JSON.stringify(key))
	}

	return {
		success: true,
		message: 'iterateKeys() - Efficient key-only iteration',
		data: {
			keys,
		},
		code: `
// Key-only iteration - more efficient than full records
for await (const key of store.iterateKeys()) {
  console.log(key)
}

// Use when you only need keys, not full records
// Doesn't load record data = less memory, faster
`.trim(),
	}
}

/**
 * Demonstrates manual cursor with openCursor()
 */
export async function demonstrateManualCursor(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Manual cursor iteration
	const records: { key: unknown; name: string }[] = []
	let cursor = await store.openCursor()

	while (cursor) {
		records.push({
			key: cursor.getKey(),
			name: cursor.getValue().name,
		})
		cursor = await cursor.continue()
	}

	return {
		success: true,
		message: 'openCursor() - Manual cursor control',
		data: {
			recordCount: records.length,
			records,
		},
		code: `
// Manual cursor for full control
let cursor = await store.openCursor()

while (cursor) {
  const key = cursor.getKey()
  const primaryKey = cursor.getPrimaryKey()
  const value = cursor.getValue()
  const direction = cursor.getDirection()

  console.log(\`\${key}: \${value.name}\`)

  cursor = await cursor.continue()
}
`.trim(),
	}
}

/**
 * Demonstrates cursor mutation (update/delete during iteration)
 */
export async function demonstrateCursorMutation(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	// Add test users
	await db.store('users').set({
		id: 'cursor-test-1',
		name: 'Cursor Test User 1',
		email: 'cursor1@test.com',
		age: 99,
		status: 'inactive',
		role: 'guest',
		tags: ['test'],
		createdAt: Date.now(),
	})
	await db.store('users').set({
		id: 'cursor-test-2',
		name: 'Cursor Test User 2',
		email: 'cursor2@test.com',
		age: 98,
		status: 'inactive',
		role: 'guest',
		tags: ['test'],
		createdAt: Date.now(),
	})

	let updated = 0
	let deleted = 0

	// Use write transaction for mutations
	await db.write(['users'], async(tx) => {
		let cursor = await tx.store('users').openCursor()

		while (cursor) {
			const user = cursor.getValue()

			if (user.id === 'cursor-test-1') {
				// Update during iteration
				await cursor.update({ ...user, name: 'Updated via Cursor' })
				updated++
			} else if (user.id === 'cursor-test-2') {
				// Delete during iteration
				await cursor.delete()
				deleted++
			}

			cursor = await cursor.continue()
		}
	})

	// Cleanup
	await db.store('users').remove('cursor-test-1')

	return {
		success: true,
		message: 'Cursor mutation - Update and delete during iteration',
		data: {
			updated,
			deleted,
		},
		code: `
// Use write transaction for cursor mutations
await db.write(['users'], async (tx) => {
  let cursor = await tx.store('users').openCursor()

  while (cursor) {
    const user = cursor.getValue()

    if (user.status === 'inactive') {
      // Delete during iteration
      await cursor.delete()
    } else if (user.needsUpdate) {
      // Update during iteration
      await cursor.update({ ...user, updatedAt: Date.now() })
    }

    cursor = await cursor.continue()
  }
})
`.trim(),
	}
}

/**
 * Demonstrates cursor navigation methods
 */
export async function demonstrateCursorNavigation(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Continue to specific key
	const continued: string[] = []
	let cursor = await store.openCursor()
	if (cursor) {
		continued.push(cursor.getValue().name)
		// Continue to next
		cursor = await cursor.continue()
		if (cursor) {
			continued.push(cursor.getValue().name)
		}
	}

	// Advance by count
	const advanced: string[] = []
	cursor = await store.openCursor()
	if (cursor) {
		advanced.push(cursor.getValue().name)
		// Skip 2 records
		cursor = await cursor.advance(2)
		if (cursor) {
			advanced.push(`(after skip 2) ${cursor.getValue().name}`)
		}
	}

	return {
		success: true,
		message: 'Cursor navigation methods',
		data: {
			continued,
			advanced,
		},
		code: `
let cursor = await store.openCursor()

// Continue to next record
cursor = await cursor.continue()

// Continue to specific key
cursor = await cursor.continue('u5')

// Skip N records
cursor = await cursor.advance(5)

// For index cursors: continue to specific primary key
// cursor = await cursor.continuePrimaryKey(indexKey, primaryKey)
`.trim(),
	}
}

/**
 * Demonstrates cursor directions
 */
export async function demonstrateCursorDirections(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Forward (default)
	const forward: string[] = []
	for await (const user of store.iterate({ direction: 'next' })) {
		forward.push(user.name)
	}

	// Backward
	const backward: string[] = []
	for await (const user of store.iterate({ direction: 'previous' })) {
		backward.push(user.name)
	}

	return {
		success: true,
		message: 'Cursor directions',
		data: {
			forward,
			backward,
			directions: ['next', 'nextunique', 'previous', 'previousunique'],
		},
		code: `
// Direction options:
// 'next'           - Ascending, include duplicates (default)
// 'nextunique'     - Ascending, skip duplicates
// 'previous'       - Descending, include duplicates
// 'previousunique' - Descending, skip duplicates

for await (const user of store.iterate({ direction: 'previous' })) {
  console.log(user.name)  // Reverse order
}
`.trim(),
	}
}

/**
 * Demonstrates key cursor
 */
export async function demonstrateKeyCursor(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')

	// Key cursor - no values loaded
	const keys: string[] = []
	let keyCursor = await store.openKeyCursor()

	while (keyCursor) {
		keys.push(JSON.stringify(keyCursor.getKey()))
		keyCursor = await keyCursor.continue()
	}

	return {
		success: true,
		message: 'Key cursor - Efficient key-only access',
		data: {
			keys,
		},
		code: `
// Key cursor doesn't load record values
// More efficient when you only need keys

let keyCursor = await store.openKeyCursor()

while (keyCursor) {
  const key = keyCursor.getKey()
  const primaryKey = keyCursor.getPrimaryKey()
  const direction = keyCursor.getDirection()

  console.log(key)

  keyCursor = await keyCursor.continue()
}
`.trim(),
	}
}

/**
 * Demonstrates index cursors
 */
export async function demonstrateIndexCursor(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const store = db.store('users')
	const statusIndex = store.index('byStatus')

	// Iterate through index
	const activeUsers: { indexKey: unknown; primaryKey: unknown; name: string }[] = []
	for await (const user of statusIndex.iterate({ query: IDBKeyRange.only('active') })) {
		activeUsers.push({
			indexKey: 'active',
			primaryKey: user.id,
			name: user.name,
		})
	}

	return {
		success: true,
		message: 'Index cursors - Iterate through index',
		data: {
			activeUsers,
		},
		code: `
const statusIndex = store.index('byStatus')

// Iterate through index
for await (const user of statusIndex.iterate({
  query: IDBKeyRange.only('active')
})) {
  console.log(user.name)
}

// Manual index cursor
let cursor = await statusIndex.openCursor()
while (cursor) {
  // cursor.getKey() returns index key
  // cursor.getPrimaryKey() returns primary key
  // cursor.getValue() returns full record
  cursor = await cursor.continue()
}
`.trim(),
	}
}
