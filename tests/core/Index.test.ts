/**
 * Tests for Index class
 *
 * @remarks
 * Comprehensive tests for:
 * - Index accessors (getName, getKeyPath, isUnique, isMultiEntry)
 * - Index get/resolve operations
 * - Index getKey for primary key lookup
 * - Index bulk operations (all, keys, count)
 * - Index iteration
 * - Index cursors
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, NotFoundError } from '../../src/index.js'
import type { DatabaseSchema } from '../../src/types.js'

// ============================================================================
// Test Schema
// ============================================================================

interface User {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly age?: number
	readonly department?: string
}

interface TestSchema extends DatabaseSchema {
	readonly users: User
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-index-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

describe('Index', () => {
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
						{ name: 'byAge', keyPath: 'age' },
						{ name: 'byDepartment', keyPath: 'department' },
					],
				},
			},
		})
	})

	afterEach(async() => {
		db.close()
		await deleteDatabase(dbName)
	})

	// ─── Accessors ───────────────────────────────────────────

	describe('accessors', () => {
		it('getName() returns index name', () => {
			const index = db.store('users').index('byEmail')
			expect(index.getName()).toBe('byEmail')
		})

		it('getKeyPath() returns index keyPath', () => {
			const index = db.store('users').index('byEmail')
			expect(index.getKeyPath()).toBe('email')
		})

		it('isUnique() returns true for unique index', () => {
			const index = db.store('users').index('byEmail')
			expect(index.isUnique()).toBe(true)
		})

		it('isUnique() returns false for non-unique index', () => {
			const index = db.store('users').index('byAge')
			expect(index.isUnique()).toBe(false)
		})

		it('isMultiEntry() returns false by default', () => {
			const index = db.store('users').index('byEmail')
			expect(index.isMultiEntry()).toBe(false)
		})

		it('native throws outside transaction', () => {
			const index = db.store('users').index('byEmail')
			expect(() => index.native).toThrow()
		})

		it('throws for non-existent index', () => {
			expect(() => db.store('users').index('nonexistent')).toThrow(/not found/i)
		})
	})

	// ─── Get ─────────────────────────────────────────────────

	describe('get', () => {
		it('returns undefined for non-existent index key', async() => {
			const result = await db.store('users').index('byEmail').get('nonexistent@test.com')
			expect(result).toBeUndefined()
		})

		it('returns record for existing index key', async() => {
			const user: User = { id: 'u1', name: 'Alice', email: 'alice@test.com' }
			await db.store('users').set(user)

			const result = await db.store('users').index('byEmail').get('alice@test.com')
			expect(result).toEqual(user)
		})

		it('batch get returns array of results', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' })

			const results = await db.store('users').index('byEmail').get([
				'alice@test.com',
				'bob@test.com',
				'charlie@test.com',
			])

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
	})

	// ─── Resolve ─────────────────────────────────────────────

	describe('resolve', () => {
		it('throws NotFoundError for non-existent index key', async() => {
			await expect(
				db.store('users').index('byEmail').resolve('nonexistent@test.com'),
			).rejects.toThrow(NotFoundError)
		})

		it('returns record for existing index key', async() => {
			const user: User = { id: 'u1', name: 'Alice', email: 'alice@test.com' }
			await db.store('users').set(user)

			const result = await db.store('users').index('byEmail').resolve('alice@test.com')
			expect(result).toEqual(user)
		})

		it('batch resolve returns array of records', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
			await db.store('users').set({ id: 'u2', name: 'Bob', email: 'bob@test.com' })

			const results = await db.store('users').index('byEmail').resolve([
				'alice@test.com',
				'bob@test.com',
			])

			expect(Array.isArray(results)).toBe(true)
			expect(results).toHaveLength(2)
		})

		it('batch resolve throws if any key missing', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			await expect(
				db.store('users').index('byEmail').resolve(['alice@test.com', 'bob@test.com']),
			).rejects.toThrow(NotFoundError)
		})
	})

	// ─── Get Key ─────────────────────────────────────────────

	describe('getKey', () => {
		it('returns undefined for non-existent index key', async() => {
			const result = await db.store('users').index('byEmail').getKey('nonexistent@test.com')
			expect(result).toBeUndefined()
		})

		it('returns primary key for existing index key', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const primaryKey = await db.store('users').index('byEmail').getKey('alice@test.com')
			expect(primaryKey).toBe('u1')
		})
	})

	// ─── Bulk Operations ─────────────────────────────────────

	describe('all', () => {
		it('returns empty array for empty store', async() => {
			const results = await db.store('users').index('byEmail').all()
			expect(results).toEqual([])
		})

		it('returns all records ordered by index key', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			])

			const results = await db.store('users').index('byEmail').all()

			expect(results).toHaveLength(3)
			// Sorted alphabetically by email
			expect(results[0]?.email).toBe('alice@test.com')
			expect(results[1]?.email).toBe('bob@test.com')
			expect(results[2]?.email).toBe('charlie@test.com')
		})

		it('respects count parameter', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			])

			const results = await db.store('users').index('byEmail').all(null, 2)
			expect(results).toHaveLength(2)
		})

		it('filters by key range', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			])

			const range = IDBKeyRange.bound('a', 'b\uffff')
			const results = await db.store('users').index('byEmail').all(range)

			expect(results).toHaveLength(2)
			expect(results.map(u => u.email)).toEqual(['alice@test.com', 'bob@test.com'])
		})
	})

	describe('keys', () => {
		it('returns empty array for empty store', async() => {
			const results = await db.store('users').index('byEmail').keys()
			expect(results).toEqual([])
		})

		it('returns all primary keys (ordered by index key)', async() => {
			// Note: IDBIndex.getAllKeys() returns PRIMARY keys, not index keys
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			const results = await db.store('users').index('byEmail').keys()
			// Returns primary keys 'u1', 'u2' ordered by index key (email alphabetically)
			expect(results).toEqual(['u1', 'u2'])
		})
	})

	describe('count', () => {
		it('returns 0 for empty store', async() => {
			const count = await db.store('users').index('byEmail').count()
			expect(count).toBe(0)
		})

		it('returns total count', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			const count = await db.store('users').index('byEmail').count()
			expect(count).toBe(2)
		})

		it('counts within key range', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			])

			const range = IDBKeyRange.bound('a', 'b\uffff')
			const count = await db.store('users').index('byEmail').count(range)
			expect(count).toBe(2)
		})
	})

	// ─── Iteration ───────────────────────────────────────────

	describe('iterate', () => {
		it('iterates over all records', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			const emails: string[] = []
			for await (const user of db.store('users').index('byEmail').iterate()) {
				emails.push(user.email)
			}

			expect(emails).toEqual(['alice@test.com', 'bob@test.com'])
		})

		it('supports reverse iteration', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			const emails: string[] = []
			for await (const user of db.store('users').index('byEmail').iterate({ direction: 'previous' })) {
				emails.push(user.email)
			}

			expect(emails).toEqual(['bob@test.com', 'alice@test.com'])
		})

		it('supports early termination', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com' },
			])

			let count = 0
			for await (const _user of db.store('users').index('byEmail').iterate()) {
				count++
				if (count === 1) break
			}

			expect(count).toBe(1)
		})

		it('iterates over empty store without error', async() => {
			const users: User[] = []
			for await (const user of db.store('users').index('byEmail').iterate()) {
				users.push(user)
			}
			expect(users).toEqual([])
		})
	})

	describe('iterateKeys', () => {
		it('iterates over all keys', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			const keys: unknown[] = []
			for await (const key of db.store('users').index('byEmail').iterateKeys()) {
				keys.push(key)
			}

			expect(keys).toEqual(['alice@test.com', 'bob@test.com'])
		})
	})

	// ─── Cursors ─────────────────────────────────────────────

	describe('openCursor', () => {
		it('returns null for empty store', async() => {
			const cursor = await db.store('users').index('byEmail').openCursor()
			expect(cursor).toBeNull()
		})

		it('returns cursor for non-empty store', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const cursor = await db.store('users').index('byEmail').openCursor()

			expect(cursor).not.toBeNull()
			expect(cursor?.getKey()).toBe('alice@test.com')
			expect(cursor?.getPrimaryKey()).toBe('u1')
			expect(cursor?.getValue()).toMatchObject({ name: 'Alice' })
		})

		it('cursor.continue() advances to next record', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com' },
			])

			let cursor = await db.store('users').index('byEmail').openCursor()

			expect(cursor?.getKey()).toBe('alice@test.com')
			cursor = await cursor?.continue() ?? null
			expect(cursor?.getKey()).toBe('bob@test.com')
			cursor = await cursor?.continue() ?? null
			expect(cursor).toBeNull()
		})
	})

	describe('openKeyCursor', () => {
		it('returns null for empty store', async() => {
			const cursor = await db.store('users').index('byEmail').openKeyCursor()
			expect(cursor).toBeNull()
		})

		it('returns key cursor for non-empty store', async() => {
			await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			const cursor = await db.store('users').index('byEmail').openKeyCursor()

			expect(cursor).not.toBeNull()
			expect(cursor?.getKey()).toBe('alice@test.com')
			expect(cursor?.getPrimaryKey()).toBe('u1')
		})
	})

	// ─── Query Builder Stub ──────────────────────────────────

	describe('stubs', () => {
		it('query() throws not implemented', () => {
			expect(() => db.store('users').index('byEmail').query()).toThrow(/not yet implemented/i)
		})
	})

	// ─── Non-Unique Index ────────────────────────────────────

	describe('non-unique index', () => {
		it('returns first matching record for get()', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 30 },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30 },
			])

			// Both have age 30, get returns one of them
			const result = await db.store('users').index('byAge').get(30)
			expect(result?.age).toBe(30)
		})

		it('all() returns all matching records', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 30 },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30 },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 25 },
			])

			const range = IDBKeyRange.only(30)
			const results = await db.store('users').index('byAge').all(range)
			expect(results).toHaveLength(2)
		})
	})
})
