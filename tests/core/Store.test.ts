/**
 * Tests for Store class
 *
 * @remarks
 * Comprehensive tests for:
 * - CRUD operations (get, resolve, set, add, remove)
 * - Batch operations
 * - Existence checks (has)
 * - Bulk operations (all, keys, clear, count)
 * - Subscriptions
 * - Error handling
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
	createDatabase,
	NotFoundError,
	ConstraintError,
	isNotFoundError,
	isConstraintError,
} from '../../src/index.js'
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

interface TestSchema extends DatabaseSchema {
	readonly users: User
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-store-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ============================================================================
// Tests
// ============================================================================

describe('Store', () => {
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
					],
				},
			},
		})
	})

	afterEach(async() => {
		await db.drop()
	})

	// ─── Accessors ───────────────────────────────────────────

	describe('accessors', () => {
		it('getName() returns store name', () => {
			expect(db.store('users').getName()).toBe('users')
		})

		it('getKeyPath() returns default "id"', () => {
			expect(db.store('users').getKeyPath()).toBe('id')
		})

		it('getIndexNames() returns index names', () => {
			expect(db.store('users').getIndexNames()).toEqual(['byEmail'])
		})

		it('hasAutoIncrement() returns false by default', () => {
			expect(db.store('users').hasAutoIncrement()).toBe(false)
		})

		it('native throws outside transaction', () => {
			expect(() => db.store('users').native).toThrow()
		})
	})

	// ─── Get ─────────────────────────────────────────────────

	describe('get', () => {
		it('returns undefined for non-existent key', async() => {
			const result = await db.store('users').get('nonexistent')
			expect(result).toBeUndefined()
		})

		it('returns record for existing key', async() => {
			const user: User = { id: 'u1', name: 'Alice', email: 'alice@test.com' }
			await db.store('users').set(user)

			const result = await db.store('users').get('u1')
			expect(result).toEqual(user)
		})

		it('batch get returns array of results', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' })

			const results = await db.store('users').get(['u1', 'u2', 'u3'])

			// Results is an array when called with array input
			if (!Array.isArray(results)) {
				expect.fail('Expected array result')
				return
			}

			expect(results).toHaveLength(3)
			expect(results[0]).toBeDefined()
			expect(results[0]?.name).toBe('Alice')
			expect(results[1]).toBeDefined()
			expect(results[1]?.name).toBe('Bob')
			expect(results[2]).toBeUndefined()
		})

		it('batch get with empty array returns empty array', async() => {
			const results = await db.store('users').get([])
			expect(results).toEqual([])
		})
	})

	// ─── Resolve ─────────────────────────────────────────────

	describe('resolve', () => {
		it('throws NotFoundError for non-existent key', async() => {
			await expect(db.store('users').resolve('nonexistent')).rejects.toThrow(NotFoundError)
		})

		it('throws NotFoundError with correct properties', async() => {
			try {
				await db.store('users').resolve('missing-key')
				expect.fail('Should have thrown')
			} catch (error) {
				expect(isNotFoundError(error)).toBe(true)
				if (isNotFoundError(error)) {
					expect(error.storeName).toBe('users')
					expect(error.key).toBe('missing-key')
				}
			}
		})

		it('returns record for existing key', async() => {
			const user: User = { id: 'u1', name: 'Alice', email: 'alice@test.com' }
			await db.store('users').set(user)

			const result = await db.store('users').resolve('u1')
			expect(result).toEqual(user)
		})

		it('batch resolve returns array of records', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' })

			const results = await db.store('users').resolve(['u1', 'u2'])

			expect(Array.isArray(results)).toBe(true)
			expect(results).toHaveLength(2)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const arr = results as unknown as any[]
			expect(arr[0]?.name).toBe('Alice')
			expect(arr[1]?.name).toBe('Bob')
		})

		it('batch resolve throws if any key missing', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			await expect(db.store('users').resolve(['u1', 'u2'])).rejects.toThrow(NotFoundError)
		})
	})

	// ─── Has ─────────────────────────────────────────────────

	describe('has', () => {
		it('returns false for non-existent key', async() => {
			const exists = await db.store('users').has('nonexistent')
			expect(exists).toBe(false)
		})

		it('returns true for existing key', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const exists = await db.store('users').has('u1')
			expect(exists).toBe(true)
		})

		it('batch has returns array of booleans', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const results = await db.store('users').has(['u1', 'u2', 'u3'])

			expect(results).toEqual([true, false, false])
		})
	})

	// ─── Set ─────────────────────────────────────────────────

	describe('set', () => {
		it('inserts new record', async() => {
			const user: User = { id: 'u1', name: 'Alice', email: 'alice@test.com' }
			const key = await db.store('users').set(user)

			expect(key).toBe('u1')

			const stored = await db.store('users').get('u1')
			expect(stored).toEqual(user)
		})

		it('updates existing record', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.store('users').set({ id: 'u1', name: 'Alice Updated', email: 'alice@test.com' })

			const stored = await db.store('users').get('u1')
			expect(stored?.name).toBe('Alice Updated')
		})

		it('returns the key', async() => {
			const key = await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			expect(key).toBe('u1')
		})

		it('batch set inserts multiple records', async() => {
			const users: User[] = [
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			]

			const keys = await db.store('users').set(users)

			expect(keys).toEqual(['u1', 'u2', 'u3'])

			const allUsers = await db.store('users').all()
			expect(allUsers).toHaveLength(3)
		})

		it('batch set is atomic (all or nothing)', async() => {
			// First add a user with unique email
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			// Try to batch set with a duplicate email (unique index violation)
			// Note: set() uses put() which doesn't fail on primary key conflicts
			// but unique index violations will still fail
			const users: User[] = [
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'alice@test.com' }, // Duplicate email
			]

			await expect(db.store('users').set(users)).rejects.toThrow()

			// Verify only original user exists (batch was rolled back)
			const allUsers = await db.store('users').all()
			expect(allUsers).toHaveLength(1)
			expect(allUsers[0]?.id).toBe('u1')
		})
	})

	// ─── Add ─────────────────────────────────────────────────

	describe('add', () => {
		it('inserts new record', async() => {
			const user: User = { id: 'u1', name: 'Alice', email: 'alice@test.com' }
			const key = await db.store('users').add(user)

			expect(key).toBe('u1')
		})

		it('throws ConstraintError for duplicate key', async() => {
			await db.store('users').add({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			await expect(
				db.store('users').add({ id: 'u1', name: 'Bob', email: 'bob@test.com' }),
			).rejects.toThrow(ConstraintError)
		})

		it('throws ConstraintError with correct code', async() => {
			await db.store('users').add({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			try {
				await db.store('users').add({ id: 'u1', name: 'Bob', email: 'bob@test.com' })
				expect.fail('Should have thrown')
			} catch (error) {
				expect(isConstraintError(error)).toBe(true)
			}
		})

		it('batch add inserts multiple records', async() => {
			const users: User[] = [
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			]

			const keys = await db.store('users').add(users)

			expect(keys).toEqual(['u1', 'u2'])
		})

		it('batch add fails if any key exists', async() => {
			await db.store('users').add({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const users: User[] = [
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u1', name: 'Charlie', email: 'charlie@test.com' }, // Duplicate
			]

			await expect(db.store('users').add(users)).rejects.toThrow()
		})
	})

	// ─── Remove ──────────────────────────────────────────────

	describe('remove', () => {
		it('removes existing record', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			await db.store('users').remove('u1')

			const result = await db.store('users').get('u1')
			expect(result).toBeUndefined()
		})

		it('silently succeeds for non-existent key', async() => {
			// Should not throw
			await db.store('users').remove('nonexistent')
		})

		it('batch remove deletes multiple records', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			])

			await db.store('users').remove(['u1', 'u3'])

			const remaining = await db.store('users').all()
			expect(remaining).toHaveLength(1)
			expect(remaining[0]?.id).toBe('u2')
		})
	})

	// ─── Bulk Operations ─────────────────────────────────────

	describe('all', () => {
		it('returns empty array for empty store', async() => {
			const results = await db.store('users').all()
			expect(results).toEqual([])
		})

		it('returns all records', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			const results = await db.store('users').all()
			expect(results).toHaveLength(2)
		})

		it('respects count parameter', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			])

			const results = await db.store('users').all(null, 2)
			expect(results).toHaveLength(2)
		})

		it('filters by key range', async() => {
			await db.store('users').set([
				{ id: 'a1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'b1', name: 'Bob', email: 'bob@test.com' },
				{ id: 'c1', name: 'Charlie', email: 'charlie@test.com' },
			])

			const range = IDBKeyRange.bound('a', 'b\uffff')
			const results = await db.store('users').all(range)

			expect(results).toHaveLength(2)
			expect(results.map(u => u.id)).toEqual(['a1', 'b1'])
		})
	})

	describe('keys', () => {
		it('returns empty array for empty store', async() => {
			const results = await db.store('users').keys()
			expect(results).toEqual([])
		})

		it('returns all keys', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			const results = await db.store('users').keys()
			expect(results).toEqual(['u1', 'u2'])
		})

		it('respects count parameter', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			])

			const results = await db.store('users').keys(null, 2)
			expect(results).toHaveLength(2)
		})
	})

	describe('clear', () => {
		it('removes all records', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			await db.store('users').clear()

			const results = await db.store('users').all()
			expect(results).toEqual([])
		})

		it('works on empty store', async() => {
			await db.store('users').clear() // Should not throw
			const results = await db.store('users').all()
			expect(results).toEqual([])
		})
	})

	describe('count', () => {
		it('returns 0 for empty store', async() => {
			const count = await db.store('users').count()
			expect(count).toBe(0)
		})

		it('returns total count', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			])

			const count = await db.store('users').count()
			expect(count).toBe(3)
		})

		it('counts specific key', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			expect(await db.store('users').count('u1')).toBe(1)
			expect(await db.store('users').count('u2')).toBe(0)
		})

		it('counts within key range', async() => {
			await db.store('users').set([
				{ id: 'a1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'b1', name: 'Bob', email: 'bob@test.com' },
				{ id: 'c1', name: 'Charlie', email: 'charlie@test.com' },
			])

			const range = IDBKeyRange.bound('a', 'b\uffff')
			const count = await db.store('users').count(range)
			expect(count).toBe(2)
		})
	})

	// ─── Subscriptions ───────────────────────────────────────

	describe('subscriptions', () => {
		it('onChange returns unsubscribe function', () => {
			const unsubscribe = db.store('users').onChange(() => {})
			expect(typeof unsubscribe).toBe('function')
			unsubscribe()
		})

		it('onChange receives set events', async() => {
			const events: unknown[] = []
			db.store('users').onChange(event => events.push(event))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			expect(events).toHaveLength(1)
			expect(events[0]).toMatchObject({
				storeName: 'users',
				type: 'set',
				keys: ['u1'],
				source: 'local',
			})
		})

		it('onChange receives add events', async() => {
			const events: unknown[] = []
			db.store('users').onChange(event => events.push(event))

			await db.store('users').add({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			expect(events).toHaveLength(1)
			expect(events[0]).toMatchObject({ type: 'add' })
		})

		it('onChange receives remove events', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const events: unknown[] = []
			db.store('users').onChange(event => events.push(event))

			await db.store('users').remove('u1')

			expect(events).toHaveLength(1)
			expect(events[0]).toMatchObject({
				type: 'remove',
				keys: ['u1'],
			})
		})

		it('onChange receives clear events', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const events: unknown[] = []
			db.store('users').onChange(event => events.push(event))

			await db.store('users').clear()

			expect(events).toHaveLength(1)
			expect(events[0]).toMatchObject({ type: 'clear' })
		})

		it('unsubscribe stops receiving events', async() => {
			const events: unknown[] = []
			const unsubscribe = db.store('users').onChange(event => events.push(event))

			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			expect(events).toHaveLength(1)

			unsubscribe()

			await db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' })
			expect(events).toHaveLength(1) // No new events
		})
	})

	// ─── Query Builder Access ────────────────────────────────

	describe('query()', () => {
		it('returns a QueryBuilder', () => {
			const query = db.store('users').query()
			expect(query).toBeDefined()
			expect(typeof query.where).toBe('function')
			expect(typeof query.filter).toBe('function')
			expect(typeof query.ascending).toBe('function')
			expect(typeof query.descending).toBe('function')
			expect(typeof query.getRange).toBe('function')
			expect(typeof query.limit).toBe('function')
			expect(typeof query.offset).toBe('function')
			expect(typeof query.toArray).toBe('function')
			expect(typeof query.first).toBe('function')
			expect(typeof query.count).toBe('function')
			expect(typeof query.keys).toBe('function')
			expect(typeof query.iterate).toBe('function')
		})
	})

	// ─── Edge Cases ──────────────────────────────────────────

	describe('edge cases', () => {
		it('handles empty string key', async() => {
			interface EmptyKeySchema extends DatabaseSchema {
				items: { id: string; value: number }
			}

			const emptyKeyDb = createDatabase<EmptyKeySchema>({
				name: createTestDbName(),
				version: 1,
				stores: { items: {} },
			})

			try {
				await emptyKeyDb.store('items').set({ id: '', value: 42 })
				const result = await emptyKeyDb.store('items').get('')
				expect(result?.value).toBe(42)
			} finally {
				await emptyKeyDb.drop()
			}
		})

		it('handles numeric keys', async() => {
			interface NumericSchema extends DatabaseSchema {
				counters: { id: number; count: number }
			}

			const numDb = createDatabase<NumericSchema>({
				name: createTestDbName(),
				version: 1,
				stores: { counters: {} },
			})

			try {
				await numDb.store('counters').set({ id: 1, count: 100 })
				await numDb.store('counters').set({ id: 2, count: 200 })

				const result = await numDb.store('counters').get(1)
				expect(result?.count).toBe(100)
			} finally {
				await numDb.drop()
			}
		})

		it('handles records with optional fields', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30 })

			const u1 = await db.store('users').get('u1')
			const u2 = await db.store('users').get('u2')

			expect(u1?.age).toBeUndefined()
			expect(u2?.age).toBe(30)
		})

		it('handles concurrent operations', async() => {
			// Start multiple operations concurrently
			const promises = [
				db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' }),
				db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' }),
				db.store('users').set({ id: 'u3', name: 'Charlie', email: 'charlie@test.com' }),
			]

			await Promise.all(promises)

			const count = await db.store('users').count()
			expect(count).toBe(3)
		})

		it('handles large batch operations', async() => {
			const users: User[] = Array.from({ length: 100 }, (_, i) => ({
				id: `u${i}`,
				name: `User ${i}`,
				email: `user${i}@test.com`,
			}))

			await db.store('users').set(users)

			const count = await db.store('users').count()
			expect(count).toBe(100)
		})
	})

	// ─── TTL Filtering ───────────────────────────────────────

	describe('TTL filtering', () => {
		interface CacheRecord {
			readonly id: string
			readonly data: string
			readonly _expiresAt?: number
		}

		interface CacheSchema extends DatabaseSchema {
			readonly cache: CacheRecord
		}

		it('get() filters expired records', async() => {
			const cacheDbName = createTestDbName()
			const cacheDb = createDatabase<CacheSchema>({
				name: cacheDbName,
				version: 1,
				stores: {
					cache: {
						ttl: { defaultMs: 1000 },
					},
				},
			})

			try {
				const store = cacheDb.store('cache')

				// Set a record that expires immediately
				await store.set({
					id: 'expired',
					data: 'old data',
					_expiresAt: Date.now() - 1000, // Already expired
				})

				// Set a record that won't expire
				await store.set({
					id: 'valid',
					data: 'new data',
					_expiresAt: Date.now() + 60000, // 1 minute from now
				})

				// Get should filter expired record
				const expired = await store.get('expired')
				const valid = await store.get('valid')

				expect(expired).toBeUndefined()
				expect(valid?.data).toBe('new data')
			} finally {
				await cacheDb.drop()
			}
		})

		it('all() filters expired records', async() => {
			const cacheDbName = createTestDbName()
			const cacheDb = createDatabase<CacheSchema>({
				name: cacheDbName,
				version: 1,
				stores: {
					cache: {
						ttl: { defaultMs: 1000 },
					},
				},
			})

			try {
				const store = cacheDb.store('cache')

				// Set mixed records
				await store.set([
					{ id: 'expired1', data: 'old', _expiresAt: Date.now() - 1000 },
					{ id: 'valid1', data: 'new', _expiresAt: Date.now() + 60000 },
					{ id: 'expired2', data: 'old', _expiresAt: Date.now() - 2000 },
					{ id: 'valid2', data: 'new', _expiresAt: Date.now() + 120000 },
				])

				// All should only return non-expired
				const all = await store.all()
				expect(all.length).toBe(2)
				expect(all.map(r => r.id).sort()).toEqual(['valid1', 'valid2'])
			} finally {
				await cacheDb.drop()
			}
		})

		it('isExpired() returns correct status', async() => {
			const cacheDbName = createTestDbName()
			const cacheDb = createDatabase<CacheSchema>({
				name: cacheDbName,
				version: 1,
				stores: {
					cache: {
						ttl: { defaultMs: 1000 },
					},
				},
			})

			try {
				const store = cacheDb.store('cache')

				await store.set([
					{ id: 'expired', data: 'old', _expiresAt: Date.now() - 1000 },
					{ id: 'valid', data: 'new', _expiresAt: Date.now() + 60000 },
				])

				expect(await store.isExpired('expired')).toBe(true)
				expect(await store.isExpired('valid')).toBe(false)
				expect(await store.isExpired('nonexistent')).toBe(false)
			} finally {
				await cacheDb.drop()
			}
		})

		it('prune() removes expired records', async() => {
			const cacheDbName = createTestDbName()
			const cacheDb = createDatabase<CacheSchema>({
				name: cacheDbName,
				version: 1,
				stores: {
					cache: {
						ttl: { defaultMs: 1000 },
					},
				},
			})

			try {
				const store = cacheDb.store('cache')

				await store.set([
					{ id: 'expired1', data: 'old', _expiresAt: Date.now() - 1000 },
					{ id: 'valid', data: 'new', _expiresAt: Date.now() + 60000 },
					{ id: 'expired2', data: 'old', _expiresAt: Date.now() - 2000 },
				])

				const result = await store.prune()
				expect(result.prunedCount).toBe(2)
				expect(result.remainingCount).toBe(1)

				// Verify only valid record remains
				const remaining = await store.all()
				expect(remaining.length).toBe(1)
				expect(remaining[0]?.id).toBe('valid')
			} finally {
				await cacheDb.drop()
			}
		})

		it('hasTTL() returns correct status', async() => {
			expect(db.store('users').hasTTL()).toBe(false)

			const cacheDbName = createTestDbName()
			const cacheDb = createDatabase<CacheSchema>({
				name: cacheDbName,
				version: 1,
				stores: {
					cache: {
						ttl: { defaultMs: 1000 },
					},
				},
			})

			try {
				expect(cacheDb.store('cache').hasTTL()).toBe(true)
			} finally {
				await cacheDb.drop()
			}
		})
	})
})
