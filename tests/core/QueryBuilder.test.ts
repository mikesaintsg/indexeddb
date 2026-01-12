/**
 * Tests for QueryBuilder and WhereClause
 *
 * @remarks
 * Comprehensive tests covering:
 * - where() clause with all operators
 * - filter() post-cursor predicates
 * - orderBy(), limit(), offset()
 * - Terminal operations (toArray, first, count, keys, iterate)
 * - Combined queries
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from '../../src/index.js'
import type { DatabaseSchema } from '../../src/types.js'

// ============================================================================
// Test Schema
// ============================================================================

interface User {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly age: number
	readonly status: 'active' | 'inactive'
}

interface TestSchema extends DatabaseSchema {
	readonly users: User
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-query-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ============================================================================
// Tests
// ============================================================================

describe('QueryBuilder', () => {
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
						{ name: 'byName', keyPath: 'name' },
						{ name: 'byAge', keyPath: 'age' },
						{ name: 'byStatus', keyPath: 'status' },
						{ name: 'byEmail', keyPath: 'email', unique: true },
					],
				},
			},
		})
	})

	afterEach(async() => {
		await db.drop()
	})

	// ─── Basic Query Operations ──────────────────────────────

	describe('toArray()', () => {
		it('returns all records when no filters', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'inactive' },
			])

			const results = await db.store('users').query().toArray()

			expect(results).toHaveLength(2)
		})

		it('returns empty array for empty store', async() => {
			const results = await db.store('users').query().toArray()
			expect(results).toEqual([])
		})
	})

	describe('first()', () => {
		it('returns first record', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'inactive' },
			])

			const first = await db.store('users').query().first()

			expect(first).toBeDefined()
			expect(first?.id).toBe('u1')
		})

		it('returns undefined for empty store', async() => {
			const first = await db.store('users').query().first()
			expect(first).toBeUndefined()
		})
	})

	describe('count()', () => {
		it('returns total count', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'inactive' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
			])

			const count = await db.store('users').query().count()

			expect(count).toBe(3)
		})

		it('returns 0 for empty store', async() => {
			const count = await db.store('users').query().count()
			expect(count).toBe(0)
		})
	})

	describe('keys()', () => {
		it('returns all primary keys', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'inactive' },
			])

			const keys = await db.store('users').query().keys()

			expect(keys).toHaveLength(2)
			expect(keys).toContain('u1')
			expect(keys).toContain('u2')
		})
	})

	describe('iterate()', () => {
		it('yields all records', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'inactive' },
			])

			const results: User[] = []
			for await (const user of db.store('users').query().iterate()) {
				results.push(user)
			}

			expect(results).toHaveLength(2)
		})

		it('supports early termination', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'inactive' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
			])

			let count = 0
			for await (const _ of db.store('users').query().iterate()) {
				count++
				if (count === 2) break
			}

			expect(count).toBe(2)
		})
	})

	// ─── Where Clause: equals ────────────────────────────────

	describe('where().equals()', () => {
		it('matches single value by index', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'inactive' },
			])

			const results = await db.store('users').query()
				.where('byStatus').equals('active')
				.toArray()

			expect(results).toHaveLength(1)
			expect(results[0]?.id).toBe('u1')
		})

		it('returns empty for no matches', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byStatus').equals('inactive')
				.toArray()

			expect(results).toHaveLength(0)
		})
	})

	// ─── Where Clause: greaterThan ───────────────────────────

	describe('where().greaterThan()', () => {
		it('matches values above bound (exclusive)', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 20, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 25, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byAge').greaterThan(25)
				.toArray()

			expect(results).toHaveLength(1)
			expect(results[0]?.name).toBe('Charlie')
		})
	})

	describe('where().greaterThanOrEqual()', () => {
		it('matches values above bound (inclusive)', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 20, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 25, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byAge').greaterThanOrEqual(25)
				.toArray()

			expect(results).toHaveLength(2)
		})
	})

	// ─── Where Clause: lessThan ──────────────────────────────

	describe('where().lessThan()', () => {
		it('matches values below bound (exclusive)', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 20, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 25, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byAge').lessThan(25)
				.toArray()

			expect(results).toHaveLength(1)
			expect(results[0]?.name).toBe('Alice')
		})
	})

	describe('where().lessThanOrEqual()', () => {
		it('matches values below bound (inclusive)', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 20, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 25, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byAge').lessThanOrEqual(25)
				.toArray()

			expect(results).toHaveLength(2)
		})
	})

	// ─── Where Clause: between ───────────────────────────────

	describe('where().between()', () => {
		it('matches values in range (inclusive by default)', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 20, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 25, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 30, status: 'active' },
				{ id: 'u4', name: 'David', email: 'david@test.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byAge').between(25, 30)
				.toArray()

			expect(results).toHaveLength(2)
		})

		it('respects lowerOpen option', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byAge').between(25, 35, { lowerOpen: true })
				.toArray()

			expect(results).toHaveLength(1)
			expect(results[0]?.name).toBe('Bob')
		})

		it('respects upperOpen option', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byAge').between(20, 30, { upperOpen: true })
				.toArray()

			expect(results).toHaveLength(1)
			expect(results[0]?.name).toBe('Alice')
		})
	})

	// ─── Where Clause: startsWith ────────────────────────────

	describe('where().startsWith()', () => {
		it('matches string prefix', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Albert', email: 'albert@test.com', age: 30, status: 'active' },
				{ id: 'u3', name: 'Bob', email: 'bob@test.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byName').startsWith('Al')
				.toArray()

			expect(results).toHaveLength(2)
		})

		it('is case-sensitive', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'alice', email: 'alice2@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byName').startsWith('Al')
				.toArray()

			expect(results).toHaveLength(1)
			expect(results[0]?.name).toBe('Alice')
		})
	})

	// ─── Where Clause: anyOf ─────────────────────────────────

	describe('where().anyOf()', () => {
		it('matches any of given values', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'inactive' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byName').anyOf(['Alice', 'Charlie'])
				.toArray()

			expect(results).toHaveLength(2)
		})

		it('deduplicates results', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
			])

			// Same value twice
			const results = await db.store('users').query()
				.where('byName').anyOf(['Alice', 'Alice'])
				.toArray()

			expect(results).toHaveLength(1)
		})

		it('returns empty for empty values array', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byName').anyOf([])
				.toArray()

			expect(results).toHaveLength(0)
		})
	})

	// ─── filter() ────────────────────────────────────────────

	describe('filter()', () => {
		it('applies post-cursor predicate', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@gmail.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@gmail.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.filter(u => u.email.endsWith('@gmail.com'))
				.toArray()

			expect(results).toHaveLength(2)
		})

		it('chains multiple filters (AND logic)', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@gmail.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@gmail.com', age: 30, status: 'inactive' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.filter(u => u.email.endsWith('@gmail.com'))
				.filter(u => u.status === 'active')
				.toArray()

			expect(results).toHaveLength(1)
			expect(results[0]?.name).toBe('Alice')
		})

		it('works with count()', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@gmail.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
			])

			const count = await db.store('users').query()
				.filter(u => u.email.endsWith('@gmail.com'))
				.count()

			expect(count).toBe(1)
		})
	})

	// ─── orderBy() ───────────────────────────────────────────

	describe('orderBy()', () => {
		it('orders ascending by default', async() => {
			await db.store('users').set([
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.orderBy('ascending')
				.toArray()

			expect(results[0]?.id).toBe('u1')
			expect(results[1]?.id).toBe('u2')
			expect(results[2]?.id).toBe('u3')
		})

		it('orders descending', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.orderBy('descending')
				.toArray()

			expect(results[0]?.id).toBe('u3')
			expect(results[1]?.id).toBe('u2')
			expect(results[2]?.id).toBe('u1')
		})
	})

	// ─── limit() ─────────────────────────────────────────────

	describe('limit()', () => {
		it('limits results', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.limit(2)
				.toArray()

			expect(results).toHaveLength(2)
		})

		it('returns all if limit exceeds count', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
			])

			const results = await db.store('users').query()
				.limit(10)
				.toArray()

			expect(results).toHaveLength(1)
		})

		it('works with iterate()', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
			])

			const results: User[] = []
			for await (const user of db.store('users').query().limit(2).iterate()) {
				results.push(user)
			}

			expect(results).toHaveLength(2)
		})
	})

	// ─── offset() ────────────────────────────────────────────

	describe('offset()', () => {
		it('skips records', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.offset(1)
				.toArray()

			expect(results).toHaveLength(2)
			expect(results[0]?.id).toBe('u2')
		})

		it('returns empty if offset exceeds count', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
			])

			const results = await db.store('users').query()
				.offset(10)
				.toArray()

			expect(results).toHaveLength(0)
		})
	})

	// ─── Combined Queries ────────────────────────────────────

	describe('combined queries', () => {
		it('where + filter', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@gmail.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@gmail.com', age: 30, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byStatus').equals('active')
				.filter(u => u.email.endsWith('@gmail.com'))
				.toArray()

			expect(results).toHaveLength(2)
		})

		it('where + limit + offset', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 20, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 25, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@test.com', age: 30, status: 'active' },
				{ id: 'u4', name: 'David', email: 'david@test.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byAge').greaterThanOrEqual(25)
				.offset(1)
				.limit(2)
				.toArray()

			expect(results).toHaveLength(2)
			expect(results[0]?.name).toBe('Charlie')
			expect(results[1]?.name).toBe('David')
		})

		it('filter + orderBy descending', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@gmail.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
				{ id: 'u3', name: 'Charlie', email: 'charlie@gmail.com', age: 35, status: 'active' },
			])

			const results = await db.store('users').query()
				.filter(u => u.email.endsWith('@gmail.com'))
				.orderBy('descending')
				.toArray()

			expect(results).toHaveLength(2)
			expect(results[0]?.name).toBe('Charlie')
			expect(results[1]?.name).toBe('Alice')
		})

		it('full pagination pattern', async() => {
			// Create 10 users with zero-padded IDs for correct lexicographic order
			await db.store('users').set(
				Array.from({ length: 10 }, (_, i) => ({
					id: `u${String(i + 1).padStart(2, '0')}`,
					name: `User${i + 1}`,
					email: `user${i + 1}@test.com`,
					age: 20 + i,
					status: 'active' as const,
				})),
			)

			// Page 2, 3 items per page
			const results = await db.store('users').query()
				.offset(3)
				.limit(3)
				.toArray()

			expect(results).toHaveLength(3)
			expect(results[0]?.id).toBe('u04')
			expect(results[1]?.id).toBe('u05')
			expect(results[2]?.id).toBe('u06')
		})
	})

	// ─── Edge Cases ──────────────────────────────────────────

	describe('edge cases', () => {
		it('handles zero limit', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
			])

			const results = await db.store('users').query()
				.limit(0)
				.toArray()

			expect(results).toHaveLength(0)
		})

		it('handles filter that matches nothing', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
			])

			const results = await db.store('users').query()
				.filter(() => false)
				.toArray()

			expect(results).toHaveLength(0)
		})

		it('handles filter that matches everything', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.filter(() => true)
				.toArray()

			expect(results).toHaveLength(2)
		})

		it('query builder is immutable (chaining creates new instance)', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Alice', email: 'alice@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Bob', email: 'bob@test.com', age: 30, status: 'active' },
			])

			const base = db.store('users').query()
			const limited = base.limit(1)

			const allResults = await base.toArray()
			const limitedResults = await limited.toArray()

			expect(allResults).toHaveLength(2)
			expect(limitedResults).toHaveLength(1)
		})

		it('handles special characters in startsWith', async() => {
			await db.store('users').set([
				{ id: 'u1', name: 'Test[1]', email: 'test1@test.com', age: 25, status: 'active' },
				{ id: 'u2', name: 'Test[2]', email: 'test2@test.com', age: 30, status: 'active' },
			])

			const results = await db.store('users').query()
				.where('byName').startsWith('Test[')
				.toArray()

			expect(results).toHaveLength(2)
		})
	})
})
