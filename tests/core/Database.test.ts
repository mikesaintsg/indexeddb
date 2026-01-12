/**
 * Tests for Database class
 *
 * @remarks
 * Comprehensive tests for:
 * - Database creation and connection
 * - Store access
 * - Subscriptions
 * - Lifecycle (close, drop)
 * - Error handling
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, Database, InvalidStateError } from '../../src/index.js'
import type { DatabaseSchema } from '../../src/types.js'

// ============================================================================
// Test Schema
// ============================================================================

interface User {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly age?: number
}

interface Post {
	readonly id: string
	readonly title: string
	readonly authorId: string
}

interface TestSchema extends DatabaseSchema {
	readonly users: User
	readonly posts: Post
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-db-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function deleteDatabase(name: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name)
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error ?? new Error('Failed to delete database'))
	})
}

// ============================================================================
// Tests
// ============================================================================

describe('Database', () => {
	let dbName: string
	let db: ReturnType<typeof createDatabase<TestSchema>> | null = null

	beforeEach(() => {
		dbName = createTestDbName()
	})

	afterEach(async() => {
		if (db) {
			db.close()
			db = null
		}
		await deleteDatabase(dbName)
	})

	// ─── Creation ────────────────────────────────────────────

	describe('createDatabase', () => {
		it('creates a database with basic options', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: {
					users: {},
					posts: {},
				},
			})

			expect(db).toBeInstanceOf(Database)
			expect(db.getName()).toBe(dbName)
			expect(db.getVersion()).toBe(1)
		})

		it('returns store names from schema before connection', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: {
					users: {},
					posts: {},
				},
			})

			const storeNames = db.getStoreNames()
			expect(storeNames).toContain('users')
			expect(storeNames).toContain('posts')
		})

		it('throws for empty database name', () => {
			expect(() => createDatabase<TestSchema>({
				name: '',
				version: 1,
				stores: { users: {}, posts: {} },
			})).toThrow()
		})

		it('throws for invalid version (zero)', () => {
			expect(() => createDatabase<TestSchema>({
				name: dbName,
				version: 0,
				stores: { users: {}, posts: {} },
			})).toThrow()
		})

		it('throws for invalid version (negative)', () => {
			expect(() => createDatabase<TestSchema>({
				name: dbName,
				version: -1,
				stores: { users: {}, posts: {} },
			})).toThrow()
		})

		it('throws for invalid version (float)', () => {
			expect(() => createDatabase<TestSchema>({
				name: dbName,
				version: 1.5,
				stores: { users: {}, posts: {} },
			})).toThrow()
		})
	})

	// ─── Lazy Connection ─────────────────────────────────────

	describe('lazy connection', () => {
		it('isOpen returns false before any operation', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			expect(db.isOpen()).toBe(false)
		})

		it('opens connection on first store operation', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			// Trigger connection
			await db.store('users').all()

			expect(db.isOpen()).toBe(true)
		})

		it('native throws when not connected', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			expect(() => db!.native).toThrow(InvalidStateError)
		})

		it('native returns IDBDatabase when connected', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			await db.store('users').all()

			expect(db.native).toBeInstanceOf(IDBDatabase)
			expect(db.native.name).toBe(dbName)
		})
	})

	// ─── Store Access ────────────────────────────────────────

	describe('store access', () => {
		it('returns a store interface', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			const store = db.store('users')
			expect(store.getName()).toBe('users')
		})

		it('returns same store instance on repeated calls', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			const store1 = db.store('users')
			const store2 = db.store('users')

			expect(store1).toBe(store2)
		})

		it('throws for non-existent store', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(() => db!.store('nonexistent' as any)).toThrow(InvalidStateError)
		})
	})

	// ─── Store Creation ──────────────────────────────────────

	describe('store creation on upgrade', () => {
		it('creates stores with default keyPath "id"', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			await db.store('users').all()

			const store = db.native.transaction('users').objectStore('users')
			expect(store.keyPath).toBe('id')
		})

		it('creates stores with custom keyPath', async() => {
			interface CustomSchema extends DatabaseSchema {
				items: { key: string; value: number }
			}

			const customDb = createDatabase<CustomSchema>({
				name: dbName,
				version: 1,
				stores: {
					items: { keyPath: 'key' },
				},
			})

			try {
				await customDb.store('items').all()
				const store = customDb.native.transaction('items').objectStore('items')
				expect(store.keyPath).toBe('key')
			} finally {
				customDb.close()
			}
		})

		it('creates stores with autoIncrement', async() => {
			interface AutoIncSchema extends DatabaseSchema {
				logs: { id?: number; message: string }
			}

			const autoDb = createDatabase<AutoIncSchema>({
				name: dbName,
				version: 1,
				stores: {
					logs: { autoIncrement: true },
				},
			})

			try {
				await autoDb.store('logs').all()
				const store = autoDb.native.transaction('logs').objectStore('logs')
				expect(store.autoIncrement).toBe(true)
			} finally {
				autoDb.close()
			}
		})

		it('creates stores with indexes', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: {
					users: {
						indexes: [
							{ name: 'byEmail', keyPath: 'email', unique: true },
							{ name: 'byAge', keyPath: 'age' },
						],
					},
					posts: {},
				},
			})

			await db.store('users').all()

			const store = db.native.transaction('users').objectStore('users')
			expect(store.indexNames.contains('byEmail')).toBe(true)
			expect(store.indexNames.contains('byAge')).toBe(true)

			const emailIndex = store.index('byEmail')
			expect(emailIndex.unique).toBe(true)

			const ageIndex = store.index('byAge')
			expect(ageIndex.unique).toBe(false)
		})

		it('creates index with multiEntry', async() => {
			interface TagSchema extends DatabaseSchema {
				articles: { id: string; tags: string[] }
			}

			const tagDb = createDatabase<TagSchema>({
				name: dbName,
				version: 1,
				stores: {
					articles: {
						indexes: [
							{ name: 'byTag', keyPath: 'tags', multiEntry: true },
						],
					},
				},
			})

			try {
				await tagDb.store('articles').all()
				const store = tagDb.native.transaction('articles').objectStore('articles')
				const index = store.index('byTag')
				expect(index.multiEntry).toBe(true)
			} finally {
				tagDb.close()
			}
		})
	})

	// ─── Subscriptions ───────────────────────────────────────

	describe('subscriptions', () => {
		it('onChange returns unsubscribe function', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			const unsubscribe = db.onChange(() => {})
			expect(typeof unsubscribe).toBe('function')
			unsubscribe()
		})

		it('onChange receives change events from store operations', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			const events: unknown[] = []
			db.onChange(event => events.push(event))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			expect(events).toHaveLength(1)
			expect(events[0]).toMatchObject({
				storeName: 'users',
				type: 'set',
				source: 'local',
			})
		})

		it('onError returns unsubscribe function', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			const unsubscribe = db.onError(() => {})
			expect(typeof unsubscribe).toBe('function')
			unsubscribe()
		})

		it('onVersionChange returns unsubscribe function', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			const unsubscribe = db.onVersionChange(() => {})
			expect(typeof unsubscribe).toBe('function')
			unsubscribe()
		})

		it('onClose returns unsubscribe function', () => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			const unsubscribe = db.onClose(() => {})
			expect(typeof unsubscribe).toBe('function')
			unsubscribe()
		})

		it('onClose is called when database closes', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			let closeCalled = false
			db.onClose(() => {
				closeCalled = true
			})

			// Open the database first
			await db.store('users').all()

			// Now close it
			db.close()

			expect(closeCalled).toBe(true)
		})

		it('unsubscribe stops receiving events', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			const events: unknown[] = []
			const unsubscribe = db.onChange(event => events.push(event))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			expect(events).toHaveLength(1)

			unsubscribe()

			await db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' })
			expect(events).toHaveLength(1) // No new events
		})

		it('supports hooks in constructor options', async() => {
			let changeCount = 0
			let closeCount = 0

			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
				onChange: () => { changeCount++ },
				onClose: () => { closeCount++ },
			})

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			expect(changeCount).toBe(1)

			db.close()
			expect(closeCount).toBe(1)
		})
	})

	// ─── Lifecycle ───────────────────────────────────────────

	describe('lifecycle', () => {
		it('close() marks database as closed', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			await db.store('users').all()
			expect(db.isOpen()).toBe(true)

			db.close()
			expect(db.isOpen()).toBe(false)
		})

		it('operations fail after close()', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			await db.store('users').all()
			db.close()

			await expect(db.store('users').all()).rejects.toThrow()
		})

		it('drop() closes and deletes the database', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.drop()

			expect(db.isOpen()).toBe(false)

			// Verify database was deleted by opening fresh
			const newDb = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			try {
				const users = await newDb.store('users').all()
				expect(users).toHaveLength(0)
			} finally {
				newDb.close()
			}
		})
	})

	// ─── Transaction Stubs ───────────────────────────────────

	describe('transaction stubs', () => {
		it('read() throws not implemented error', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			await expect(db.read('users', async() => {
			})).rejects.toThrow(/not yet implemented/i)
		})

		it('write() throws not implemented error', async() => {
			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			await expect(db.write('users', async() => {
			})).rejects.toThrow(/not yet implemented/i)
		})
	})

	// ─── Multiple Connections ────────────────────────────────

	describe('multiple connections', () => {
		it('can open multiple databases with different names', async() => {
			const name2 = createTestDbName()

			db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			const db2 = createDatabase<TestSchema>({
				name: name2,
				version: 1,
				stores: { users: {}, posts: {} },
			})

			try {
				await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
				await db2.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' })

				const users1 = await db.store('users').all()
				const users2 = await db2.store('users').all()

				expect(users1).toHaveLength(1)
				expect(users2).toHaveLength(1)
				expect(users1[0]?.id).toBe('u1')
				expect(users2[0]?.id).toBe('u2')
			} finally {
				db2.close()
				await deleteDatabase(name2)
			}
		})
	})
})
