/**
 * Database Setup Example
 *
 * Demonstrates:
 * - createDatabase with schema
 * - Store definitions with keyPath, autoIncrement, indexes
 * - Database accessors (getName, getVersion, getStoreNames, isOpen)
 * - Native access
 * - close() and drop()
 */

import { createDatabase } from '@mikesaintsg/indexeddb'
import type { AppSchema } from './types.js'

/**
 * Creates and returns the showcase database instance.
 *
 * @returns The database interface configured with the showcase schema
 *
 * @example
 * ```ts
 * const db = createShowcaseDatabase()
 *
 * // Database accessors
 * db.getName()        // 'showcase-db'
 * db.getVersion()     // 1
 * db.getStoreNames()  // ['users', 'posts', 'settings']
 * db.isOpen()         // true (after first operation)
 *
 * // Native access
 * const nativeDb = db.native
 * ```
 */
export function createShowcaseDatabase() {
	return createDatabase<AppSchema>({
		name: 'showcase-db',
		version: 1,
		stores: {
			users: {
				// Default keyPath: 'id'
				indexes: [
					{ name: 'byEmail', keyPath: 'email', unique: true },
					{ name: 'byStatus', keyPath: 'status' },
					{ name: 'byRole', keyPath: 'role' },
					{ name: 'byAge', keyPath: 'age' },
					{ name: 'byTags', keyPath: 'tags', multiEntry: true },
					{ name: 'byCreatedAt', keyPath: 'createdAt' },
				],
			},
			posts: {
				indexes: [
					{ name: 'byAuthor', keyPath: 'authorId' },
					{ name: 'byPublished', keyPath: 'published' },
					{ name: 'byViews', keyPath: 'views' },
					{ name: 'byCreatedAt', keyPath: 'createdAt' },
				],
			},
			settings: {
				indexes: [
					{ name: 'byKey', keyPath: 'key', unique: true },
					{ name: 'byUpdatedAt', keyPath: 'updatedAt' },
				],
			},
		},
		crossTabSync: true,
	})
}

/**
 * Demonstrates database accessor methods.
 */
export async function demonstrateDatabaseAccessors() {
	const db = createShowcaseDatabase()

	// Trigger lazy connection by accessing a store
	await db.store('users').count()

	const info = {
		name: db.getName(),
		version: db.getVersion(),
		storeNames: db.getStoreNames(),
		isOpen: db.isOpen(),
	}

	return {
		code: `
const db = createDatabase<AppSchema>({ name: 'showcase-db', version: 1, stores: {...} })

// Database accessors
db.getName()        // '${info.name}'
db.getVersion()     // ${info.version}
db.getStoreNames()  // ${JSON.stringify(info.storeNames)}
db.isOpen()         // ${info.isOpen}
`.trim(),
		data: info,
	}
}

/**
 * Demonstrates native access.
 */
export function demonstrateNativeAccess() {
	const db = createShowcaseDatabase()

	// Access native IDBDatabase
	const nativeDb = db.native

	return {
		code: `
// Access native IDBDatabase for advanced operations
const nativeDb = db.native

// Use native APIs when needed
const tx = nativeDb.transaction(['users'], 'readonly')
const objectStore = tx.objectStore('users')
const request = objectStore.count()
request.onsuccess = () => console.log(request.result)
`.trim(),
		data: {
			nativeName: nativeDb.name,
			nativeVersion: nativeDb.version,
			objectStoreNames: Array.from(nativeDb.objectStoreNames),
		},
	}
}
