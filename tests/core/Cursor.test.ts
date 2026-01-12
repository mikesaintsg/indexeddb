/**
 * Tests for Cursor, KeyCursor, iterate, and iterateKeys
 *
 * @remarks
 * Comprehensive tests for:
 * - Store cursor operations
 * - Store iteration with async generators
 * - Cursor navigation (continue, advance)
 * - Cursor direction options
 * - Key range filtering
 * - Early termination
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase } from '../../src/index.js'
import type { DatabaseSchema } from '../../src/types.js'

// ============================================================================
// Test Schema
// ============================================================================

interface Item {
	readonly id: string
	readonly name: string
	readonly value: number
}

interface TestSchema extends DatabaseSchema {
	readonly items: Item
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-cursor-${Date.now()}-${Math.random().toString(36).slice(2)}`
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

describe('Cursor & Iteration', () => {
	let dbName: string
	let db: ReturnType<typeof createDatabase<TestSchema>>

	beforeEach(() => {
		dbName = createTestDbName()
		db = createDatabase<TestSchema>({
			name: dbName,
			version: 1,
			stores: {
				items: {
					indexes: [
						{ name: 'byValue', keyPath: 'value' },
					],
				},
			},
		})
	})

	afterEach(async() => {
		db.close()
		await deleteDatabase(dbName)
	})

	// ─── Store iterate() ─────────────────────────────────────

	describe('store.iterate()', () => {
		it('iterates over all records in key order', async() => {
			await db.store('items').set([
				{ id: 'c', name: 'Charlie', value: 3 },
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			const ids: string[] = []
			for await (const item of db.store('items').iterate()) {
				ids.push(item.id)
			}

			// Sorted by primary key 'id'
			expect(ids).toEqual(['a', 'b', 'c'])
		})

		it('iterates in reverse with direction: previous', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
				{ id: 'c', name: 'Charlie', value: 3 },
			])

			const ids: string[] = []
			for await (const item of db.store('items').iterate({ direction: 'previous' })) {
				ids.push(item.id)
			}

			expect(ids).toEqual(['c', 'b', 'a'])
		})

		it('filters by key range with query option', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
				{ id: 'c', name: 'Charlie', value: 3 },
			])

			const ids: string[] = []
			const range = IDBKeyRange.bound('a', 'b')
			for await (const item of db.store('items').iterate({ query: range })) {
				ids.push(item.id)
			}

			expect(ids).toEqual(['a', 'b'])
		})

		it('supports early termination with break', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
				{ id: 'c', name: 'Charlie', value: 3 },
			])

			let count = 0
			for await (const _item of db.store('items').iterate()) {
				count++
				if (count === 2) break
			}

			expect(count).toBe(2)
		})

		it('iterates over empty store without error', async() => {
			const items: Item[] = []
			for await (const item of db.store('items').iterate()) {
				items.push(item)
			}
			expect(items).toEqual([])
		})

		it('yields values one at a time (memory efficient)', async() => {
			// Create 100 items
			const items = Array.from({ length: 100 }, (_, i) => ({
				id: `item-${i.toString().padStart(3, '0')}`,
				name: `Item ${i}`,
				value: i,
			}))
			await db.store('items').set(items)

			let iterations = 0
			for await (const _item of db.store('items').iterate()) {
				iterations++
				if (iterations === 10) break // Only need first 10
			}

			expect(iterations).toBe(10)
		})
	})

	// ─── Store iterateKeys() ─────────────────────────────────

	describe('store.iterateKeys()', () => {
		it('iterates over all keys in order', async() => {
			await db.store('items').set([
				{ id: 'c', name: 'Charlie', value: 3 },
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			const keys: unknown[] = []
			for await (const key of db.store('items').iterateKeys()) {
				keys.push(key)
			}

			expect(keys).toEqual(['a', 'b', 'c'])
		})

		it('iterates in reverse with direction: previous', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			const keys: unknown[] = []
			for await (const key of db.store('items').iterateKeys({ direction: 'previous' })) {
				keys.push(key)
			}

			expect(keys).toEqual(['b', 'a'])
		})

		it('filters by key range', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
				{ id: 'c', name: 'Charlie', value: 3 },
			])

			const keys: unknown[] = []
			const range = IDBKeyRange.lowerBound('b')
			for await (const key of db.store('items').iterateKeys({ query: range })) {
				keys.push(key)
			}

			expect(keys).toEqual(['b', 'c'])
		})
	})

	// ─── Store openCursor() ──────────────────────────────────

	describe('store.openCursor()', () => {
		it('returns null for empty store', async() => {
			const cursor = await db.store('items').openCursor()
			expect(cursor).toBeNull()
		})

		it('returns cursor positioned at first record', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			const cursor = await db.store('items').openCursor()

			expect(cursor).not.toBeNull()
			expect(cursor?.getKey()).toBe('a')
			expect(cursor?.getPrimaryKey()).toBe('a')
			expect(cursor?.getValue()).toMatchObject({ id: 'a', name: 'Alice' })
			expect(cursor?.getDirection()).toBe('next')
		})

		it('cursor.continue() advances to next record', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
				{ id: 'c', name: 'Charlie', value: 3 },
			])

			let cursor = await db.store('items').openCursor()

			const keys: unknown[] = []
			while (cursor) {
				keys.push(cursor.getKey())
				cursor = await cursor.continue()
			}

			expect(keys).toEqual(['a', 'b', 'c'])
		})

		it('cursor.continue(key) advances to specific key', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
				{ id: 'c', name: 'Charlie', value: 3 },
			])

			let cursor = await db.store('items').openCursor()
			expect(cursor?.getKey()).toBe('a')

			// Skip 'b' and go directly to 'c'
			cursor = await cursor?.continue('c') ?? null
			expect(cursor?.getKey()).toBe('c')
		})

		it('cursor.advance(count) skips records', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
				{ id: 'c', name: 'Charlie', value: 3 },
				{ id: 'd', name: 'David', value: 4 },
			])

			let cursor = await db.store('items').openCursor()
			expect(cursor?.getKey()).toBe('a')

			cursor = await cursor?.advance(2) ?? null
			expect(cursor?.getKey()).toBe('c')
		})

		it('supports reverse direction', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			const cursor = await db.store('items').openCursor({ direction: 'previous' })

			expect(cursor?.getKey()).toBe('b')
			// Note: IDB returns 'prev' but our interface uses 'previous'
		})

		it('cursor.native provides access to IDBCursorWithValue', async() => {
			await db.store('items').set({ id: 'a', name: 'Alice', value: 1 })

			const cursor = await db.store('items').openCursor()

			expect(cursor?.native).toBeInstanceOf(IDBCursorWithValue)
		})
	})

	// ─── Store openKeyCursor() ───────────────────────────────

	describe('store.openKeyCursor()', () => {
		it('returns null for empty store', async() => {
			const cursor = await db.store('items').openKeyCursor()
			expect(cursor).toBeNull()
		})

		it('returns key cursor for non-empty store', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			const cursor = await db.store('items').openKeyCursor()

			expect(cursor).not.toBeNull()
			expect(cursor?.getKey()).toBe('a')
			expect(cursor?.getPrimaryKey()).toBe('a')
			expect(cursor?.getDirection()).toBe('next')
		})

		it('key cursor.continue() advances to next key', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			let cursor = await db.store('items').openKeyCursor()

			expect(cursor?.getKey()).toBe('a')
			cursor = await cursor?.continue() ?? null
			expect(cursor?.getKey()).toBe('b')
			cursor = await cursor?.continue() ?? null
			expect(cursor).toBeNull()
		})

		it('key cursor.advance(count) skips keys', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
				{ id: 'c', name: 'Charlie', value: 3 },
			])

			let cursor = await db.store('items').openKeyCursor()
			cursor = await cursor?.advance(2) ?? null
			expect(cursor?.getKey()).toBe('c')
		})

		it('cursor.native provides access to IDBCursor', async() => {
			await db.store('items').set({ id: 'a', name: 'Alice', value: 1 })

			const cursor = await db.store('items').openKeyCursor()

			expect(cursor?.native).toBeDefined()
		})
	})

	// ─── Direction Options ───────────────────────────────────

	describe('direction options', () => {
		it('next iterates forward', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			const keys: unknown[] = []
			for await (const item of db.store('items').iterate({ direction: 'next' })) {
				keys.push(item.id)
			}

			expect(keys).toEqual(['a', 'b'])
		})

		it('previous iterates backward', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			const keys: unknown[] = []
			for await (const item of db.store('items').iterate({ direction: 'previous' })) {
				keys.push(item.id)
			}

			expect(keys).toEqual(['b', 'a'])
		})
	})

	// ─── Key Range Queries ───────────────────────────────────

	describe('key range queries', () => {
		beforeEach(async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
				{ id: 'c', name: 'Charlie', value: 3 },
				{ id: 'd', name: 'David', value: 4 },
				{ id: 'e', name: 'Eve', value: 5 },
			])
		})

		it('IDBKeyRange.only(key)', async() => {
			const keys: unknown[] = []
			for await (const item of db.store('items').iterate({ query: IDBKeyRange.only('c') })) {
				keys.push(item.id)
			}
			expect(keys).toEqual(['c'])
		})

		it('IDBKeyRange.lowerBound(key)', async() => {
			const keys: unknown[] = []
			for await (const item of db.store('items').iterate({ query: IDBKeyRange.lowerBound('c') })) {
				keys.push(item.id)
			}
			expect(keys).toEqual(['c', 'd', 'e'])
		})

		it('IDBKeyRange.lowerBound(key, true) excludes key', async() => {
			const keys: unknown[] = []
			for await (const item of db.store('items').iterate({ query: IDBKeyRange.lowerBound('c', true) })) {
				keys.push(item.id)
			}
			expect(keys).toEqual(['d', 'e'])
		})

		it('IDBKeyRange.upperBound(key)', async() => {
			const keys: unknown[] = []
			for await (const item of db.store('items').iterate({ query: IDBKeyRange.upperBound('c') })) {
				keys.push(item.id)
			}
			expect(keys).toEqual(['a', 'b', 'c'])
		})

		it('IDBKeyRange.bound(lower, upper)', async() => {
			const keys: unknown[] = []
			for await (const item of db.store('items').iterate({ query: IDBKeyRange.bound('b', 'd') })) {
				keys.push(item.id)
			}
			expect(keys).toEqual(['b', 'c', 'd'])
		})
	})

	// ─── Edge Cases ──────────────────────────────────────────

	describe('edge cases', () => {
		it('handles single record iteration', async() => {
			await db.store('items').set({ id: 'only', name: 'Only', value: 1 })

			const ids: string[] = []
			for await (const item of db.store('items').iterate()) {
				ids.push(item.id)
			}

			expect(ids).toEqual(['only'])
		})

		it('handles cursor at end of store', async() => {
			await db.store('items').set({ id: 'a', name: 'Alice', value: 1 })

			let cursor = await db.store('items').openCursor()
			cursor = await cursor?.continue() ?? null

			expect(cursor).toBeNull()
		})

		it('advance past end returns null', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'b', name: 'Bob', value: 2 },
			])

			let cursor = await db.store('items').openCursor()
			cursor = await cursor?.advance(10) ?? null

			expect(cursor).toBeNull()
		})

		it('continue to non-existent key skips to next valid', async() => {
			await db.store('items').set([
				{ id: 'a', name: 'Alice', value: 1 },
				{ id: 'c', name: 'Charlie', value: 3 },
			])

			let cursor = await db.store('items').openCursor()
			// 'b' doesn't exist, should skip to 'c'
			cursor = await cursor?.continue('b') ?? null

			expect(cursor?.getKey()).toBe('c')
		})
	})
})
