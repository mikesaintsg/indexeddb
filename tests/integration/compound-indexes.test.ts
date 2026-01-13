/**
 * Tests for compound indexes
 *
 * @remarks
 * Tests covering compound (multi-key) indexes:
 * - Compound keyPath indexes
 * - Querying with compound keys
 * - Sorting with compound indexes
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from '../../src/index.js'
import type { DatabaseSchema } from '../../src/types.js'

// ============================================================================
// Test Schema
// ============================================================================

interface Event {
	readonly id: string
	readonly year: number
	readonly month: number
	readonly day: number
	readonly title: string
	readonly category: string
}

interface TestSchema extends DatabaseSchema {
	readonly events: Event
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-compound-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ============================================================================
// Tests
// ============================================================================

describe('Compound Indexes', () => {
	let dbName: string
	let db: ReturnType<typeof createDatabase<TestSchema>>

	beforeEach(async() => {
		dbName = createTestDbName()
		db = createDatabase<TestSchema>({
			name: dbName,
			version: 1,
			stores: {
				events: {
					indexes: [
						{ name: 'byDate', keyPath: ['year', 'month', 'day'] },
						{ name: 'byCategoryDate', keyPath: ['category', 'year', 'month'] },
					],
				},
			},
		})

		// Seed test data
		const store = db.store('events')
		await store.set([
			{ id: 'e1', year: 2024, month: 1, day: 15, title: 'New Year Party', category: 'social' },
			{ id: 'e2', year: 2024, month: 2, day: 14, title: 'Valentines', category: 'social' },
			{ id: 'e3', year: 2024, month: 3, day: 20, title: 'Spring Meeting', category: 'work' },
			{ id: 'e4', year: 2024, month: 1, day: 10, title: 'Team Sync', category: 'work' },
			{ id: 'e5', year: 2023, month: 12, day: 25, title: 'Christmas', category: 'social' },
		])
	})

	afterEach(async() => {
		if (db) {
			await db.drop()
		}
	})

	describe('Index accessors', () => {
		it('getKeyPath returns compound key path as array', () => {
			const index = db.store('events').index('byDate')
			const keyPath = index.getKeyPath()
			expect(Array.isArray(keyPath)).toBe(true)
			expect(keyPath).toEqual(['year', 'month', 'day'])
		})

		it('getName returns index name', () => {
			const index = db.store('events').index('byDate')
			expect(index.getName()).toBe('byDate')
		})
	})

	describe('get() with compound key', () => {
		it('retrieves record by exact compound key', async() => {
			const index = db.store('events').index('byDate')
			// For a single compound key, we use getAll with IDBKeyRange.only
			const range = IDBKeyRange.only([2024, 1, 15])
			const events = await index.all(range)
			expect(events.length).toBe(1)
			expect(events[0]?.title).toBe('New Year Party')
		})

		it('returns empty for non-existent compound key', async() => {
			const index = db.store('events').index('byDate')
			const range = IDBKeyRange.only([2024, 1, 1])
			const events = await index.all(range)
			expect(events.length).toBe(0)
		})

		it('retrieves multiple records by compound keys using batch', async() => {
			const index = db.store('events').index('byDate')
			// Using get with array of compound keys - each compound key is an array
			const events = await index.get([
				[2024, 1, 15],
				[2024, 2, 14],
				[2099, 1, 1],
			]) as unknown as readonly (Event | undefined)[]
			expect(events).toHaveLength(3)
			expect(events[0]?.title).toBe('New Year Party')
			expect(events[1]?.title).toBe('Valentines')
			expect(events[2]).toBeUndefined()
		})
	})

	describe('resolve() with compound key', () => {
		it('resolves record by compound key using all()', async() => {
			const index = db.store('events').index('byDate')
			// Use IDBKeyRange.only for single compound key lookup
			const range = IDBKeyRange.only([2024, 1, 15])
			const events = await index.all(range)
			expect(events.length).toBe(1)
			expect(events[0]!.title).toBe('New Year Party')
		})

		it('throws NotFoundError for non-existent compound key', async() => {
			const index = db.store('events').index('byDate')
			// This will throw because a compound key [2099,1,1] is treated as array of keys
			await expect(index.resolve([[2099, 1, 1]])).rejects.toThrow()
		})
	})

	describe('has() with compound key', () => {
		it('returns true for existing compound key using count', async() => {
			const index = db.store('events').index('byDate')
			// For compound keys, use count with IDBKeyRange.only
			const count = await index.count([2024, 1, 15])
			expect(count).toBe(1)
		})

		it('returns false for non-existent compound key using count', async() => {
			const index = db.store('events').index('byDate')
			const count = await index.count([2099, 1, 1])
			expect(count).toBe(0)
		})

		it('checks multiple compound keys using batch has', async() => {
			const index = db.store('events').index('byDate')
			// Batch has() treats each array element as a separate key lookup
			const results = await index.has([
				[2024, 1, 15],
				[2099, 1, 1],
				[2024, 2, 14],
			])
			expect(results).toEqual([true, false, true])
		})
	})

	describe('all() with compound range query', () => {
		it('retrieves all records within compound key range', async() => {
			const index = db.store('events').index('byDate')
			const range = IDBKeyRange.bound([2024, 1, 1], [2024, 2, 28])
			const events = await index.all(range)

			expect(events.length).toBeGreaterThanOrEqual(3)
			expect(events.every(e => e.year === 2024 && (e.month === 1 || e.month === 2))).toBe(true)
		})
	})

	describe('count() with compound key', () => {
		it('counts records with exact compound key', async() => {
			const index = db.store('events').index('byDate')
			const count = await index.count([2024, 1, 15])
			expect(count).toBe(1)
		})

		it('counts records in compound key range', async() => {
			const index = db.store('events').index('byDate')
			const range = IDBKeyRange.bound([2024, 1, 1], [2024, 12, 31])
			const count = await index.count(range)
			expect(count).toBe(4) // 4 events in 2024
		})
	})

	describe('getKey() with compound index', () => {
		it('returns primary key for compound index key', async() => {
			const index = db.store('events').index('byDate')
			const primaryKey = await index.getKey([2024, 1, 15])
			expect(primaryKey).toBe('e1')
		})

		it('returns undefined for non-existent compound key', async() => {
			const index = db.store('events').index('byDate')
			const primaryKey = await index.getKey([2099, 1, 1])
			expect(primaryKey).toBeUndefined()
		})
	})

	describe('iterate() with compound index', () => {
		it('iterates over records in compound key order', async() => {
			const index = db.store('events').index('byDate')
			const range = IDBKeyRange.bound([2024, 1, 1], [2024, 3, 31])

			const events: Event[] = []
			for await (const event of index.iterate({ query: range })) {
				events.push(event)
			}

			// Should be sorted by [year, month, day]
			expect(events.length).toBe(4)
			expect(events[0]!.day).toBe(10) // Jan 10
			expect(events[1]!.day).toBe(15) // Jan 15
			expect(events[2]!.day).toBe(14) // Feb 14
			expect(events[3]!.day).toBe(20) // Mar 20
		})

		it('supports reverse iteration with compound index', async() => {
			const index = db.store('events').index('byDate')
			const range = IDBKeyRange.bound([2024, 1, 1], [2024, 3, 31])

			const events: Event[] = []
			for await (const event of index.iterate({ query: range, direction: 'previous' })) {
				events.push(event)
			}

			// Should be sorted in reverse by [year, month, day]
			expect(events.length).toBe(4)
			expect(events[0]!.day).toBe(20) // Mar 20
			expect(events[3]!.day).toBe(10) // Jan 10
		})
	})

	describe('cursor operations with compound index', () => {
		it('opens cursor on compound index', async() => {
			const index = db.store('events').index('byDate')
			const cursor = await index.openCursor()

			expect(cursor).toBeDefined()
			expect(cursor?.getKey()).toBeDefined()
		})

		it('opens key cursor on compound index', async() => {
			const index = db.store('events').index('byDate')
			const cursor = await index.openKeyCursor()

			expect(cursor).toBeDefined()
			expect(Array.isArray(cursor?.getKey())).toBe(true)
		})
	})

	describe('mixed compound and category index', () => {
		it('queries by category and partial date', async() => {
			const index = db.store('events').index('byCategoryDate')
			const range = IDBKeyRange.bound(['work', 2024, 1], ['work', 2024, 12])
			const events = await index.all(range)

			expect(events.length).toBe(2)
			expect(events.every(e => e.category === 'work')).toBe(true)
		})
	})
})
