/**
 * Integration Tests: Showcase Examples
 *
 * @remarks
 * Tests based on each showcase example to ensure all demonstrated features work correctly.
 * Covers: Store Operations, Index Operations, Query Builder, Transactions, Cursors, Events, Error Handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
	createDatabase,
	NotFoundError,
	ConstraintError,
	isDatabaseError,
	isNotFoundError,
	isConstraintError,
	hasErrorCode,
} from '../../src/index.js'
import type { DatabaseSchema, ChangeEvent } from '../../src/types.js'

// ============================================================================
// Test Schema (mirrors showcase schema)
// ============================================================================

interface User {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly age: number
	readonly status: 'active' | 'inactive' | 'pending'
	readonly role: 'admin' | 'user' | 'moderator'
	readonly tags: readonly string[]
	readonly createdAt: number
}

interface Post {
	readonly id: string
	readonly title: string
	readonly content: string
	readonly authorId: string
	readonly published: boolean
	readonly views: number
	readonly createdAt: number
}

interface Setting {
	readonly id: string
	readonly key: string
	readonly value: string
	readonly category: string
}

interface TestSchema extends DatabaseSchema {
	readonly users: User
	readonly posts: Post
	readonly settings: Setting
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-showcase-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createUser(overrides: Partial<User> = {}): User {
	const uniqueId = Math.random().toString(36).slice(2)
	return {
		id: `u-${uniqueId}`,
		name: 'Test User',
		email: `test-${uniqueId}@example.com`,
		age: 30,
		status: 'active',
		role: 'user',
		tags: ['developer'],
		createdAt: Date.now(),
		...overrides,
	}
}

function createPost(overrides: Partial<Post> = {}): Post {
	return {
		id: `p-${Math.random().toString(36).slice(2)}`,
		title: 'Test Post',
		content: 'Test content',
		authorId: 'u1',
		published: false,
		views: 0,
		createdAt: Date.now(),
		...overrides,
	}
}

const SAMPLE_USERS: readonly User[] = [
	{ id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', age: 32, status: 'active', role: 'admin', tags: ['developer', 'leader'], createdAt: Date.now() - 86400000 * 5 },
	{ id: 'u2', name: 'Bob Smith', email: 'bob@example.com', age: 28, status: 'active', role: 'user', tags: ['developer'], createdAt: Date.now() - 86400000 * 4 },
	{ id: 'u3', name: 'Carol White', email: 'carol@example.com', age: 35, status: 'inactive', role: 'moderator', tags: ['designer'], createdAt: Date.now() - 86400000 * 3 },
	{ id: 'u4', name: 'David Brown', email: 'david@example.com', age: 42, status: 'active', role: 'user', tags: ['manager'], createdAt: Date.now() - 86400000 * 2 },
	{ id: 'u5', name: 'Eva Green', email: 'eva@example.com', age: 26, status: 'active', role: 'user', tags: ['developer', 'tester'], createdAt: Date.now() - 86400000 },
]

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration: Showcase Examples', () => {
	let dbName: string
	let db: ReturnType<typeof createDatabase<TestSchema>>

	beforeEach(() => {
		dbName = createTestDbName()
		db = createDatabase<TestSchema>({
			name: dbName,
			version: 1,
			stores: {
				users: {
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
					],
				},
				settings: {
					indexes: [
						{ name: 'byCategory', keyPath: 'category' },
					],
				},
			},
		})
	})

	afterEach(async() => {
		await db.drop()
	})

	// ─── Store Operations Examples ───────────────────────────

	describe('Store Operations', () => {
		beforeEach(async() => {
			await db.store('users').set([...SAMPLE_USERS])
		})

		describe('get() - Optional Lookup', () => {
			it('returns value for existing key', async() => {
				const user = await db.store('users').get('u1')
				expect(user?.name).toBe('Alice Johnson')
			})

			it('returns undefined for missing key', async() => {
				const missing = await db.store('users').get('nonexistent')
				expect(missing).toBeUndefined()
			})

			it('batch get returns array with undefined for missing', async() => {
				const keys: readonly string[] = ['u1', 'u2', 'nonexistent']
				const results = await db.store('users').get(keys)
				expect(results).toHaveLength(3)
				expect(results[0]?.name).toBe('Alice Johnson')
				expect(results[1]?.name).toBe('Bob Smith')
				expect(results[2]).toBeUndefined()
			})
		})

		describe('resolve() - Required Lookup', () => {
			it('returns value for existing key', async() => {
				const user = await db.store('users').resolve('u1')
				expect(user.name).toBe('Alice Johnson')
			})

			it('throws NotFoundError for missing key', async() => {
				await expect(db.store('users').resolve('nonexistent')).rejects.toThrow(NotFoundError)
			})

			it('NotFoundError contains correct metadata', async() => {
				try {
					await db.store('users').resolve('nonexistent')
					expect.fail('Should throw')
				} catch (error) {
					expect(error).toBeInstanceOf(NotFoundError)
					if (error instanceof NotFoundError) {
						expect(error.code).toBe('NOT_FOUND')
						expect(error.key).toBe('nonexistent')
						expect(error.storeName).toBe('users')
					}
				}
			})
		})

		describe('set() - Upsert', () => {
			it('inserts new record', async() => {
				const newUser = createUser({ id: 'new-user', name: 'New User' })
				await db.store('users').set(newUser)
				const retrieved = await db.store('users').get('new-user')
				expect(retrieved?.name).toBe('New User')
			})

			it('updates existing record', async() => {
				const existing = await db.store('users').resolve('u1')
				await db.store('users').set({ ...existing, name: 'Updated Name' })
				const updated = await db.store('users').get('u1')
				expect(updated?.name).toBe('Updated Name')
			})

			it('batch set inserts multiple records', async() => {
				const newUsers = [
					createUser({ id: 'batch1', name: 'Batch 1' }),
					createUser({ id: 'batch2', name: 'Batch 2' }),
				]
				const keys = await db.store('users').set(newUsers)
				expect(keys).toHaveLength(2)
			})
		})

		describe('add() - Insert Only', () => {
			it('inserts new record', async() => {
				const newUser = createUser({ id: 'add-user', name: 'Add User' })
				const key = await db.store('users').add(newUser)
				expect(key).toBe('add-user')
			})

			it('throws ConstraintError for duplicate key', async() => {
				await expect(
					db.store('users').add(createUser({ id: 'u1' })),
				).rejects.toThrow(ConstraintError)
			})

			it('ConstraintError contains correct metadata', async() => {
				try {
					await db.store('users').add(createUser({ id: 'u1' }))
					expect.fail('Should throw')
				} catch (error) {
					expect(error).toBeInstanceOf(ConstraintError)
					if (error instanceof ConstraintError) {
						expect(error.code).toBe('CONSTRAINT_ERROR')
						// Key may be empty string for primary key constraint
						expect(error.storeName).toBe('users')
					}
				}
			})
		})

		describe('remove() - Delete', () => {
			it('removes existing record', async() => {
				await db.store('users').remove('u1')
				expect(await db.store('users').has('u1')).toBe(false)
			})

			it('silently succeeds for missing key', async() => {
				await expect(db.store('users').remove('nonexistent')).resolves.not.toThrow()
			})

			it('batch remove deletes multiple', async() => {
				await db.store('users').remove(['u1', 'u2'])
				expect(await db.store('users').has('u1')).toBe(false)
				expect(await db.store('users').has('u2')).toBe(false)
			})
		})

		describe('has() - Existence Check', () => {
			it('returns true for existing key', async() => {
				expect(await db.store('users').has('u1')).toBe(true)
			})

			it('returns false for missing key', async() => {
				expect(await db.store('users').has('nonexistent')).toBe(false)
			})
		})

		describe('Bulk Operations', () => {
			it('all() returns all records', async() => {
				const all = await db.store('users').all()
				expect(all).toHaveLength(5)
			})

			it('keys() returns all keys', async() => {
				const keys = await db.store('users').keys()
				expect(keys).toHaveLength(5)
				expect(keys).toContain('u1')
			})

			it('count() returns record count', async() => {
				const count = await db.store('users').count()
				expect(count).toBe(5)
			})

			it('clear() removes all records', async() => {
				await db.store('users').clear()
				expect(await db.store('users').count()).toBe(0)
			})
		})

		describe('Store Accessors', () => {
			it('getName() returns store name', () => {
				expect(db.store('users').getName()).toBe('users')
			})

			it('getKeyPath() returns key path', () => {
				expect(db.store('users').getKeyPath()).toBe('id')
			})

			it('getIndexNames() returns index names', () => {
				const indexNames = db.store('users').getIndexNames()
				expect(indexNames).toContain('byEmail')
				expect(indexNames).toContain('byStatus')
				expect(indexNames).toContain('byTags')
			})
		})
	})

	// ─── Index Operations Examples ───────────────────────────

	describe('Index Operations', () => {
		beforeEach(async() => {
			await db.store('users').set([...SAMPLE_USERS])
		})

		describe('Index Accessors', () => {
			it('getName() returns index name', () => {
				expect(db.store('users').index('byEmail').getName()).toBe('byEmail')
			})

			it('getKeyPath() returns index key path', () => {
				expect(db.store('users').index('byEmail').getKeyPath()).toBe('email')
			})

			it('isUnique() returns unique status', () => {
				expect(db.store('users').index('byEmail').isUnique()).toBe(true)
				expect(db.store('users').index('byStatus').isUnique()).toBe(false)
			})

			it('isMultiEntry() returns multi-entry status', () => {
				expect(db.store('users').index('byTags').isMultiEntry()).toBe(true)
				expect(db.store('users').index('byEmail').isMultiEntry()).toBe(false)
			})
		})

		describe('Index Lookup', () => {
			it('get() by unique index', async() => {
				const user = await db.store('users').index('byEmail').get('alice@example.com')
				expect(user?.id).toBe('u1')
			})

			it('resolve() by index throws for missing', async() => {
				await expect(
					db.store('users').index('byEmail').resolve('nonexistent@example.com'),
				).rejects.toThrow(NotFoundError)
			})

			it('getKey() returns primary key', async() => {
				const key = await db.store('users').index('byEmail').getKey('alice@example.com')
				expect(key).toBe('u1')
			})
		})

		describe('Non-Unique Index', () => {
			it('queries by non-unique index value', async() => {
				const activeUsers = await db.store('users').index('byStatus').all(IDBKeyRange.only('active'))
				expect(activeUsers.length).toBeGreaterThan(1)
				activeUsers.forEach((u) => expect(u.status).toBe('active'))
			})

			it('count() by non-unique index', async() => {
				const count = await db.store('users').index('byStatus').count(IDBKeyRange.only('active'))
				expect(count).toBe(4)
			})
		})

		describe('Multi-Entry Index', () => {
			it('indexes array elements separately', async() => {
				const developers = await db.store('users').index('byTags').all(IDBKeyRange.only('developer'))
				expect(developers.length).toBe(3) // Alice, Bob, Eva
			})

			it('finds different tags', async() => {
				const designers = await db.store('users').index('byTags').all(IDBKeyRange.only('designer'))
				expect(designers.length).toBe(1) // Carol
			})
		})

		describe('Range Queries', () => {
			it('queries age range', async() => {
				const ageRange = IDBKeyRange.bound(25, 35)
				const usersInRange = await db.store('users').index('byAge').all(ageRange)
				usersInRange.forEach((u) => {
					expect(u.age).toBeGreaterThanOrEqual(25)
					expect(u.age).toBeLessThanOrEqual(35)
				})
			})

			it('queries with lowerBound', async() => {
				const olderThan30 = await db.store('users').index('byAge').all(IDBKeyRange.lowerBound(30, true))
				olderThan30.forEach((u) => expect(u.age).toBeGreaterThan(30))
			})
		})
	})

	// ─── Query Builder Examples ──────────────────────────────

	describe('Query Builder', () => {
		beforeEach(async() => {
			await db.store('users').set([...SAMPLE_USERS])
		})

		describe('where().equals()', () => {
			it('filters by indexed field', async() => {
				const activeUsers = await db.store('users').query()
					.where('byStatus').equals('active')
					.toArray()
				expect(activeUsers.length).toBe(4)
				activeUsers.forEach((u) => expect(u.status).toBe('active'))
			})

			it('filters by role', async() => {
				const admins = await db.store('users').query()
					.where('byRole').equals('admin')
					.toArray()
				expect(admins.length).toBe(1)
				expect(admins[0]?.name).toBe('Alice Johnson')
			})
		})

		describe('Comparison Queries', () => {
			it('greaterThan()', async() => {
				const olderThan30 = await db.store('users').query()
					.where('byAge').greaterThan(30)
					.toArray()
				olderThan30.forEach((u) => expect(u.age).toBeGreaterThan(30))
			})

			it('lessThan()', async() => {
				const youngerThan30 = await db.store('users').query()
					.where('byAge').lessThan(30)
					.toArray()
				youngerThan30.forEach((u) => expect(u.age).toBeLessThan(30))
			})

			it('between()', async() => {
				const between25And35 = await db.store('users').query()
					.where('byAge').between(25, 35)
					.toArray()
				between25And35.forEach((u) => {
					expect(u.age).toBeGreaterThanOrEqual(25)
					expect(u.age).toBeLessThanOrEqual(35)
				})
			})
		})

		describe('startsWith()', () => {
			it('filters by prefix', async() => {
				const aliceEmails = await db.store('users').query()
					.where('byEmail').startsWith('alice')
					.toArray()
				aliceEmails.forEach((u) => expect(u.email.startsWith('alice')).toBe(true))
			})
		})

		describe('filter()', () => {
			it('applies post-cursor predicate', async() => {
				const gmailUsers = await db.store('users').query()
					.filter((u) => u.email.endsWith('@example.com'))
					.toArray()
				gmailUsers.forEach((u) => expect(u.email).toContain('@example.com'))
			})

			it('complex filter conditions', async() => {
				const activeAdults = await db.store('users').query()
					.filter((u) => u.age >= 30 && u.status === 'active')
					.toArray()
				activeAdults.forEach((u) => {
					expect(u.age).toBeGreaterThanOrEqual(30)
					expect(u.status).toBe('active')
				})
			})
		})

		describe('Combined Query', () => {
			it('where() + filter() for optimal performance', async() => {
				const results = await db.store('users').query()
					.where('byStatus').equals('active')
					.filter((u) => u.age >= 30)
					.toArray()
				results.forEach((u) => {
					expect(u.status).toBe('active')
					expect(u.age).toBeGreaterThanOrEqual(30)
				})
			})
		})

		describe('Ordering & Pagination', () => {
			it('limit() restricts results', async() => {
				const limited = await db.store('users').query().limit(3).toArray()
				expect(limited).toHaveLength(3)
			})

			it('offset() skips records', async() => {
				const all = await db.store('users').query().toArray()
				const offset = await db.store('users').query().offset(2).toArray()
				expect(offset).toHaveLength(3)
				expect(offset[0]?.id).toBe(all[2]?.id)
			})

			it('pagination pattern', async() => {
				const page1 = await db.store('users').query().limit(2).offset(0).toArray()
				const page2 = await db.store('users').query().limit(2).offset(2).toArray()
				const page3 = await db.store('users').query().limit(2).offset(4).toArray()

				expect(page1).toHaveLength(2)
				expect(page2).toHaveLength(2)
				expect(page3).toHaveLength(1)
			})
		})

		describe('Terminal Operations', () => {
			it('toArray() returns all matching', async() => {
				const results = await db.store('users').query().toArray()
				expect(Array.isArray(results)).toBe(true)
			})

			it('first() returns single result', async() => {
				const first = await db.store('users').query().first()
				expect(first).toBeDefined()
			})

			it('count() returns count', async() => {
				const count = await db.store('users').query()
					.where('byStatus').equals('active')
					.count()
				expect(count).toBe(4)
			})

			it('keys() returns only keys', async() => {
				const keys = await db.store('users').query().keys()
				expect(keys).toHaveLength(5)
				keys.forEach((k) => expect(typeof k).toBe('string'))
			})
		})

		describe('iterate()', () => {
			it('memory-efficient async generator', async() => {
				const names: string[] = []
				for await (const user of db.store('users').query().iterate()) {
					names.push(user.name)
				}
				expect(names).toHaveLength(5)
			})

			it('early break from iteration', async() => {
				const names: string[] = []
				for await (const user of db.store('users').query().iterate()) {
					names.push(user.name)
					if (names.length === 2) break
				}
				expect(names).toHaveLength(2)
			})
		})
	})

	// ─── Transaction Examples ────────────────────────────────

	describe('Transactions', () => {
		describe('Read Transaction', () => {
			it('provides consistent reads across stores', async() => {
				await db.store('users').set(createUser({ id: 'tx-user' }))
				await db.store('posts').set(createPost({ id: 'tx-post', authorId: 'tx-user' }))

				await db.read(['users', 'posts'], async(tx) => {
					const user = await tx.store('users').get('tx-user')
					const post = await tx.store('posts').get('tx-post')

					expect(user?.id).toBe('tx-user')
					expect(post?.authorId).toBe('tx-user')
				})
			})
		})

		describe('Write Transaction', () => {
			it('atomic multi-store modifications', async() => {
				const user = createUser({ id: 'atomic-user' })
				const post = createPost({ id: 'atomic-post', authorId: 'atomic-user' })

				await db.write(['users', 'posts'], async(tx) => {
					await tx.store('users').set(user)
					await tx.store('posts').set(post)
				})

				expect(await db.store('users').has('atomic-user')).toBe(true)
				expect(await db.store('posts').has('atomic-post')).toBe(true)
			})

			it('rollback on error', async() => {
				await db.store('users').set(createUser({ id: 'rollback-test', name: 'Original' }))

				await expect(db.write('users', async(tx) => {
					await tx.store('users').set(createUser({ id: 'rollback-test', name: 'Changed' }))
					throw new Error('Abort transaction')
				})).rejects.toThrow('Abort transaction')

				const user = await db.store('users').get('rollback-test')
				expect(user?.name).toBe('Original')
			})
		})

		describe('Transaction Accessors', () => {
			it('getMode() returns transaction mode', async() => {
				await db.read('users', (tx) => {
					expect(tx.getMode()).toBe('readonly')
				})

				await db.write('users', (tx) => {
					expect(tx.getMode()).toBe('readwrite')
				})
			})

			it('getStoreNames() returns store names', async() => {
				await db.read(['users', 'posts'], (tx) => {
					const names = tx.getStoreNames()
					expect(names).toContain('users')
					expect(names).toContain('posts')
				})
			})

			it('isActive() returns active state', async() => {
				await db.read('users', (tx) => {
					expect(tx.isActive()).toBe(true)
				})
			})
		})

		describe('Transaction Abort', () => {
			it('abort() rolls back all changes', async() => {
				await db.store('users').set(createUser({ id: 'abort-test' }))

				try {
					await db.write('users', async(tx) => {
						await tx.store('users').remove('abort-test')
						tx.abort()
					})
				} catch {
					// Expected
				}

				expect(await db.store('users').has('abort-test')).toBe(true)
			})
		})
	})

	// ─── Cursor Examples ─────────────────────────────────────

	describe('Cursors', () => {
		beforeEach(async() => {
			await db.store('users').set([...SAMPLE_USERS])
		})

		describe('iterate()', () => {
			it('yields all records', async() => {
				const names: string[] = []
				for await (const user of db.store('users').iterate()) {
					names.push(user.name)
				}
				expect(names).toHaveLength(5)
			})

			it('with range', async() => {
				const range = IDBKeyRange.bound('u1', 'u3')
				const ids: string[] = []
				for await (const user of db.store('users').iterate({ query: range })) {
					ids.push(user.id)
				}
				expect(ids).toContain('u1')
				expect(ids).toContain('u2')
				expect(ids).toContain('u3')
			})
		})

		describe('iterateKeys()', () => {
			it('yields only keys', async() => {
				const keys: string[] = []
				for await (const key of db.store('users').iterateKeys()) {
					keys.push(key as string)
				}
				expect(keys).toHaveLength(5)
				expect(keys).toContain('u1')
			})
		})

		describe('Manual Cursor', () => {
			it('openCursor() for full control', async() => {
				const names: string[] = []
				let cursor = await db.store('users').openCursor()

				while (cursor) {
					names.push(cursor.getValue().name)
					cursor = await cursor.continue()
				}

				expect(names).toHaveLength(5)
			})
		})

		describe('Cursor Mutation', () => {
			it('update() during iteration', async() => {
				await db.write('users', async(tx) => {
					let cursor = await tx.store('users').openCursor()

					while (cursor) {
						const user = cursor.getValue()
						if (user.id === 'u1') {
							await cursor.update({ ...user, name: 'Updated Alice' })
						}
						cursor = await cursor.continue()
					}
				})

				const updated = await db.store('users').get('u1')
				expect(updated?.name).toBe('Updated Alice')
			})

			it('delete() during iteration', async() => {
				const initialCount = await db.store('users').count()

				await db.write('users', async(tx) => {
					let cursor = await tx.store('users').openCursor()

					while (cursor) {
						if (cursor.getValue().id === 'u1') {
							await cursor.delete()
						}
						cursor = await cursor.continue()
					}
				})

				expect(await db.store('users').count()).toBe(initialCount - 1)
				expect(await db.store('users').has('u1')).toBe(false)
			})
		})

		describe('Cursor Directions', () => {
			it('previous direction', async() => {
				const ids: string[] = []
				for await (const user of db.store('users').iterate({ direction: 'previous' })) {
					ids.push(user.id)
				}
				expect(ids[0]).toBe('u5')
				expect(ids[ids.length - 1]).toBe('u1')
			})
		})

		describe('Index Cursor', () => {
			it('iterate through index', async() => {
				const emails: string[] = []
				for await (const user of db.store('users').index('byEmail').iterate()) {
					emails.push(user.email)
				}
				expect(emails).toHaveLength(5)
			})
		})
	})

	// ─── Events Examples ─────────────────────────────────────

	describe('Events', () => {
		describe('Database onChange', () => {
			it('receives all store changes', async() => {
				const events: ChangeEvent[] = []
				db.onChange((e) => events.push(e))

				await db.store('users').set(createUser({ id: 'change-test' }))
				await db.store('posts').set(createPost({ id: 'change-post' }))

				expect(events).toHaveLength(2)
			})
		})

		describe('Store onChange', () => {
			it('receives only specific store changes', async() => {
				const userEvents: ChangeEvent[] = []
				db.store('users').onChange((e) => userEvents.push(e))

				await db.store('posts').set(createPost({ id: 'p1' }))
				await db.store('users').set(createUser({ id: 'u-test' }))

				expect(userEvents).toHaveLength(1)
				expect(userEvents[0]?.storeName).toBe('users')
			})
		})

		describe('Unsubscribe', () => {
			it('stops receiving events after unsubscribe', async() => {
				const events: ChangeEvent[] = []
				const unsubscribe = db.onChange((e) => events.push(e))

				await db.store('users').set(createUser({ id: 'u-before' }))
				unsubscribe()
				await db.store('users').set(createUser({ id: 'u-after' }))

				expect(events).toHaveLength(1)
			})
		})

		describe('Change Event Properties', () => {
			it('contains correct event data', async() => {
				let capturedEvent: ChangeEvent | undefined
				db.onChange((e) => { capturedEvent = e })

				await db.store('users').set(createUser({ id: 'event-test' }))

				expect(capturedEvent).toBeDefined()
				expect(capturedEvent?.storeName).toBe('users')
				expect(capturedEvent?.type).toBe('set')
				expect(capturedEvent?.keys).toContain('event-test')
				expect(capturedEvent?.source).toBe('local')
			})
		})
	})

	// ─── Error Handling Examples ─────────────────────────────

	describe('Error Handling', () => {
		beforeEach(async() => {
			await db.store('users').set([...SAMPLE_USERS])
		})

		describe('NotFoundError', () => {
			it('thrown by resolve() for missing records', async() => {
				await expect(db.store('users').resolve('nonexistent')).rejects.toThrow(NotFoundError)
			})

			it('contains error metadata', async() => {
				try {
					await db.store('users').resolve('missing-user')
				} catch (error) {
					expect(error).toBeInstanceOf(NotFoundError)
					if (error instanceof NotFoundError) {
						expect(error.name).toBe('NotFoundError')
						expect(error.code).toBe('NOT_FOUND')
						expect(error.key).toBe('missing-user')
						expect(error.storeName).toBe('users')
					}
				}
			})
		})

		describe('ConstraintError', () => {
			it('thrown by add() for duplicate keys', async() => {
				await expect(db.store('users').add(createUser({ id: 'u1' }))).rejects.toThrow(ConstraintError)
			})

			it('thrown for unique index violation', async() => {
				await expect(
					db.store('users').add(createUser({ id: 'new-id', email: 'alice@example.com' })),
				).rejects.toThrow(ConstraintError)
			})
		})

		describe('Type Guards', () => {
			it('isDatabaseError() checks base type', async() => {
				try {
					await db.store('users').resolve('nonexistent')
				} catch (error) {
					expect(isDatabaseError(error)).toBe(true)
				}
			})

			it('isNotFoundError() checks specific type', async() => {
				try {
					await db.store('users').resolve('nonexistent')
				} catch (error) {
					expect(isNotFoundError(error)).toBe(true)
					expect(isConstraintError(error)).toBe(false)
				}
			})

			it('isConstraintError() checks specific type', async() => {
				try {
					await db.store('users').add(createUser({ id: 'u1' }))
				} catch (error) {
					expect(isConstraintError(error)).toBe(true)
					expect(isNotFoundError(error)).toBe(false)
				}
			})

			it('hasErrorCode() checks error code', async() => {
				try {
					await db.store('users').resolve('nonexistent')
				} catch (error) {
					expect(hasErrorCode(error, 'NOT_FOUND')).toBe(true)
					expect(hasErrorCode(error, 'CONSTRAINT_ERROR')).toBe(false)
				}
			})
		})

		describe('Comprehensive Error Handling', () => {
			it('handles errors with pattern matching', async() => {
				let errorType = ''

				try {
					await db.store('users').resolve('nonexistent')
				} catch (error) {
					if (isNotFoundError(error)) {
						errorType = 'not_found'
					} else if (isConstraintError(error)) {
						errorType = 'constraint'
					} else if (isDatabaseError(error)) {
						errorType = 'database'
					} else {
						errorType = 'unknown'
					}
				}

				expect(errorType).toBe('not_found')
			})
		})
	})

	// ─── Edge Cases and Advanced Scenarios ───────────────────

	describe('Edge Cases', () => {
		beforeEach(async() => {
			await db.store('users').set([...SAMPLE_USERS])
		})

		describe('Empty Operations', () => {
			it('get() with empty array returns empty array', async() => {
				const emptyKeys: readonly string[] = []
				const results = await db.store('users').get(emptyKeys)
				expect(results).toHaveLength(0)
			})

			it('set() with empty array returns empty array', async() => {
				const keys = await db.store('users').set([])
				expect(keys).toHaveLength(0)
			})

			it('remove() with empty array succeeds silently', async() => {
				const emptyKeys: readonly string[] = []
				await expect(db.store('users').remove(emptyKeys)).resolves.not.toThrow()
			})

			it('has() with empty array returns empty array', async() => {
				const emptyKeys: readonly string[] = []
				const results = await db.store('users').has(emptyKeys)
				expect(results).toHaveLength(0)
			})

			it('query with no matches returns empty array', async() => {
				const results = await db.store('users').query()
					.where('byStatus').equals('pending')
					.toArray()
				expect(results).toHaveLength(0)
			})
		})

		describe('Special Characters in Data', () => {
			it('handles unicode characters in string fields', async() => {
				const unicodeUser = createUser({
					id: 'unicode-user',
					name: '日本語 🎉 Émojis & Spëcial',
					email: 'unicode@example.com',
				})
				await db.store('users').set(unicodeUser)
				const retrieved = await db.store('users').get('unicode-user')
				expect(retrieved?.name).toBe('日本語 🎉 Émojis & Spëcial')
			})

			it('handles empty string keys', async() => {
				const emptyKeyUser = createUser({ id: 'empty-string-test' })
				await db.store('users').set(emptyKeyUser)
				const retrieved = await db.store('users').get('empty-string-test')
				expect(retrieved?.id).toBe('empty-string-test')
			})

			it('handles very long string values', async() => {
				const longString = 'x'.repeat(10000)
				const longUser = createUser({
					id: 'long-user',
					name: longString,
				})
				await db.store('users').set(longUser)
				const retrieved = await db.store('users').get('long-user')
				expect(retrieved?.name.length).toBe(10000)
			})
		})

		describe('Numeric Edge Cases', () => {
			it('handles zero age', async() => {
				const zeroAgeUser = createUser({ id: 'zero-age', age: 0 })
				await db.store('users').set(zeroAgeUser)
				const results = await db.store('users').query()
					.where('byAge').equals(0)
					.toArray()
				expect(results.some(u => u.id === 'zero-age')).toBe(true)
			})

			it('handles negative numbers', async() => {
				const negativeAgeUser = createUser({ id: 'negative-age', age: -1 })
				await db.store('users').set(negativeAgeUser)
				const results = await db.store('users').query()
					.where('byAge').lessThan(0)
					.toArray()
				expect(results.some(u => u.id === 'negative-age')).toBe(true)
			})

			it('handles large numbers', async() => {
				const largeAgeUser = createUser({ id: 'large-age', age: Number.MAX_SAFE_INTEGER })
				await db.store('users').set(largeAgeUser)
				const retrieved = await db.store('users').get('large-age')
				expect(retrieved?.age).toBe(Number.MAX_SAFE_INTEGER)
			})

			it('handles decimal numbers', async() => {
				const decimalUser = createUser({ id: 'decimal-age', age: 30.5 })
				await db.store('users').set(decimalUser)
				const retrieved = await db.store('users').get('decimal-age')
				expect(retrieved?.age).toBe(30.5)
			})
		})

		describe('Array Field Edge Cases', () => {
			it('handles empty tags array', async() => {
				const noTagsUser = createUser({ id: 'no-tags', tags: [] })
				await db.store('users').set(noTagsUser)
				const retrieved = await db.store('users').get('no-tags')
				expect(retrieved?.tags).toHaveLength(0)
			})

			it('handles many tags with multi-entry index', async() => {
				const manyTagsUser = createUser({
					id: 'many-tags',
					tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
				})
				await db.store('users').set(manyTagsUser)

				// Each tag should be queryable
				const tag3Results = await db.store('users').index('byTags')
					.all(IDBKeyRange.only('tag3'))
				expect(tag3Results.some(u => u.id === 'many-tags')).toBe(true)
			})

			it('handles duplicate tags in array', async() => {
				const dupTagsUser = createUser({
					id: 'dup-tags',
					tags: ['same', 'same', 'different'],
				})
				await db.store('users').set(dupTagsUser)
				const retrieved = await db.store('users').get('dup-tags')
				expect(retrieved?.tags).toHaveLength(3)
			})
		})

		describe('Query Builder Edge Cases', () => {
			it('startsWith with empty string matches all', async() => {
				const results = await db.store('users').query()
					.where('byEmail').startsWith('')
					.toArray()
				expect(results.length).toBeGreaterThan(0)
			})

			it('between with same lower and upper bound', async() => {
				const results = await db.store('users').query()
					.where('byAge').between(32, 32)
					.toArray()
				expect(results.every(u => u.age === 32)).toBe(true)
			})

			it('filter with always-true predicate returns all', async() => {
				const all = await db.store('users').all()
				const filtered = await db.store('users').query()
					.filter(() => true)
					.toArray()
				expect(filtered.length).toBe(all.length)
			})

			it('filter with always-false predicate returns empty', async() => {
				const filtered = await db.store('users').query()
					.filter(() => false)
					.toArray()
				expect(filtered).toHaveLength(0)
			})

			it('limit(0) returns empty array', async() => {
				const results = await db.store('users').query().limit(0).toArray()
				expect(results).toHaveLength(0)
			})

			it('offset larger than total returns empty array', async() => {
				const results = await db.store('users').query().offset(1000).toArray()
				expect(results).toHaveLength(0)
			})

			it('first() returns undefined for empty result', async() => {
				const first = await db.store('users').query()
					.where('byStatus').equals('pending')
					.first()
				expect(first).toBeUndefined()
			})

			it('count() returns 0 for empty result', async() => {
				const count = await db.store('users').query()
					.where('byStatus').equals('pending')
					.count()
				expect(count).toBe(0)
			})
		})

		describe('Transaction Edge Cases', () => {
			it('nested reads in same transaction', async() => {
				let user1Name = ''
				let user2Name = ''

				await db.read('users', async(tx) => {
					const user1 = await tx.store('users').get('u1')
					const user2 = await tx.store('users').get('u2')
					user1Name = user1?.name ?? ''
					user2Name = user2?.name ?? ''
				})

				expect(user1Name).toBe('Alice Johnson')
				expect(user2Name).toBe('Bob Smith')
			})

			it('multiple writes in same transaction are atomic', async() => {
				await db.write('users', async(tx) => {
					await tx.store('users').set(createUser({ id: 'atomic-1' }))
					await tx.store('users').set(createUser({ id: 'atomic-2' }))
					await tx.store('users').set(createUser({ id: 'atomic-3' }))
				})

				expect(await db.store('users').has('atomic-1')).toBe(true)
				expect(await db.store('users').has('atomic-2')).toBe(true)
				expect(await db.store('users').has('atomic-3')).toBe(true)
			})

			it('transaction with error rolls back all changes', async() => {
				const initialCount = await db.store('users').count()

				try {
					await db.write('users', async(tx) => {
						await tx.store('users').set(createUser({ id: 'rollback-1' }))
						await tx.store('users').set(createUser({ id: 'rollback-2' }))
						throw new Error('Intentional failure')
					})
				} catch {
					// Expected
				}

				const finalCount = await db.store('users').count()
				expect(finalCount).toBe(initialCount)
			})
		})

		describe('Cursor Edge Cases', () => {
			it('iterate over empty store', async() => {
				await db.store('settings').clear()
				const items: Setting[] = []
				for await (const item of db.store('settings').iterate()) {
					items.push(item)
				}
				expect(items).toHaveLength(0)
			})

			it('early break from iteration', async() => {
				let count = 0
				for await (const _ of db.store('users').iterate()) {
					count++
					if (count === 2) break
				}
				expect(count).toBe(2)
			})

			it('openCursor on empty store returns null', async() => {
				await db.store('settings').clear()
				const cursor = await db.store('settings').openCursor()
				expect(cursor).toBeNull()
			})
		})

		describe('Index Edge Cases', () => {
			it('unique index prevents duplicate values', async() => {
				await expect(
					db.store('users').add(createUser({ id: 'unique-test', email: 'alice@example.com' })),
				).rejects.toThrow(ConstraintError)
			})

			it('non-unique index allows duplicate values', async() => {
				const user1 = createUser({ id: 'nonunique-1', status: 'active' })
				const user2 = createUser({ id: 'nonunique-2', status: 'active' })
				await db.store('users').set(user1)
				await db.store('users').set(user2)

				const activeUsers = await db.store('users').index('byStatus')
					.all(IDBKeyRange.only('active'))
				expect(activeUsers.length).toBeGreaterThanOrEqual(2)
			})

			it('index get on non-existent value returns undefined', async() => {
				const result = await db.store('users').index('byEmail').get('nonexistent@example.com')
				expect(result).toBeUndefined()
			})

			it('index count returns correct count', async() => {
				const activeCount = await db.store('users').index('byStatus').count('active')
				expect(activeCount).toBe(4)
			})
		})

		describe('Event Edge Cases', () => {
			it('unsubscribe before any events is safe', async() => {
				const unsubscribe = db.onChange(() => { /* empty */ })
				unsubscribe()
				// Should not throw
				await db.store('users').set(createUser({ id: 'after-unsubscribe' }))
			})

			it('multiple subscribers receive same event', async() => {
				let count1 = 0
				let count2 = 0

				const unsub1 = db.onChange(() => { count1++ })
				const unsub2 = db.onChange(() => { count2++ })

				await db.store('users').set(createUser({ id: 'multi-sub' }))
				await new Promise(r => setTimeout(r, 50))

				unsub1()
				unsub2()

				expect(count1).toBe(1)
				expect(count2).toBe(1)
			})

			it('event contains correct keys for batch operations', async() => {
				let capturedKeys: readonly unknown[] = []
				const unsub = db.onChange((e) => {
					if (e.storeName === 'users' && e.type === 'set') {
						capturedKeys = e.keys
					}
				})

				await db.store('users').set([
					createUser({ id: 'batch-event-1' }),
					createUser({ id: 'batch-event-2' }),
				])
				await new Promise(r => setTimeout(r, 50))

				unsub()

				expect(capturedKeys).toContain('batch-event-1')
				expect(capturedKeys).toContain('batch-event-2')
			})
		})

		describe('Concurrent Operations', () => {
			it('parallel get operations', async() => {
				const [user1, user2, user3] = await Promise.all([
					db.store('users').get('u1'),
					db.store('users').get('u2'),
					db.store('users').get('u3'),
				])

				expect(user1?.name).toBe('Alice Johnson')
				expect(user2?.name).toBe('Bob Smith')
				expect(user3?.name).toBe('Carol White')
			})

			it('parallel count operations', async() => {
				const [usersCount, postsCount, settingsCount] = await Promise.all([
					db.store('users').count(),
					db.store('posts').count(),
					db.store('settings').count(),
				])

				expect(usersCount).toBe(5)
				expect(postsCount).toBe(0)
				expect(settingsCount).toBe(0)
			})
		})
	})
})
