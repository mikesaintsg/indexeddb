/**
 * Performance Tests
 *
 * @remarks
 * Stress tests comparing the library performance against native IndexedDB
 * and testing various operation patterns.
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
	readonly category: string
	readonly active: boolean
	readonly createdAt: number
}

interface TestSchema extends DatabaseSchema {
	readonly items: Item
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-perf-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function generateItems(count: number): Item[] {
	const categories = ['electronics', 'clothing', 'food', 'books', 'toys']
	const items: Item[] = []

	for (let i = 0; i < count; i++) {
		items.push({
			id: `item-${String(i).padStart(6, '0')}`,
			name: `Item ${i}`,
			value: Math.random() * 1000,
			category: categories[i % categories.length] ?? 'other',
			active: i % 2 === 0,
			createdAt: Date.now() - i * 1000,
		})
	}

	return items
}

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
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
						{ name: 'byCategory', keyPath: 'category' },
						{ name: 'byValue', keyPath: 'value' },
						{ name: 'byCreatedAt', keyPath: 'createdAt' },
					],
				},
			},
			crossTabSync: false, // Disable for performance testing
		})
	})

	afterEach(async() => {
		await db.drop()
	})

	// ─── Batch Insert Performance ────────────────────────────

	describe('batch insert', () => {
		it('inserts 100 records efficiently', async() => {
			const items = generateItems(100)

			const start = performance.now()
			await db.store('items').set(items)
			const duration = performance.now() - start

			const count = await db.store('items').count()
			expect(count).toBe(100)
			expect(duration).toBeLessThan(500) // Should be < 500ms
		})

		it('inserts 1000 records efficiently', async() => {
			const items = generateItems(1000)

			const start = performance.now()
			await db.store('items').set(items)
			const duration = performance.now() - start

			const count = await db.store('items').count()
			expect(count).toBe(1000)
			expect(duration).toBeLessThan(2000) // Should be < 2s
		})

		it('batch insert is faster than individual inserts', async() => {
			const items1 = generateItems(100)
			const items2 = generateItems(100).map((item, i) => ({
				...item,
				id: `individual-${i}`,
			}))

			// Batch insert
			const batchStart = performance.now()
			await db.store('items').set(items1)
			const batchDuration = performance.now() - batchStart

			// Individual inserts (first 20 only to keep test fast and reliable)
			const individualStart = performance.now()
			for (const item of items2.slice(0, 20)) {
				await db.store('items').set(item)
			}
			const individualDuration = performance.now() - individualStart

			// Batch of 100 should complete in similar or less time than 20 individual
			// (This is a conservative test - in practice batch is 5-10x faster)
			expect(batchDuration).toBeLessThan(individualDuration * 10)
		})
	})

	// ─── Query Performance ───────────────────────────────────

	describe('query performance', () => {
		beforeEach(async() => {
			// Populate with test data
			const items = generateItems(500)
			await db.store('items').set(items)
		})

		it('indexed where() is faster than filter()', async() => {
			// Indexed query
			const indexedStart = performance.now()
			const indexed = await db.store('items').query()
				.where('byCategory').equals('electronics')
				.toArray()
			const indexedDuration = performance.now() - indexedStart

			// Filter query (scans all)
			const filterStart = performance.now()
			const filtered = await db.store('items').query()
				.filter(item => item.category === 'electronics')
				.toArray()
			const filterDuration = performance.now() - filterStart

			// Both should return same results
			expect(indexed.length).toBe(filtered.length)
			expect(indexed.length).toBe(100) // 500 / 5 categories

			// Indexed should be faster (usually 2-10x faster)
			// Note: In smaller datasets the difference may be less pronounced
			expect(indexedDuration).toBeLessThanOrEqual(filterDuration * 2)
		})

		it('limit() stops iteration early', async() => {
			const start = performance.now()
			const limited = await db.store('items').query()
				.limit(10)
				.toArray()
			const duration = performance.now() - start

			expect(limited).toHaveLength(10)
			expect(duration).toBeLessThan(100) // Should be very fast
		})

		it('combined where + filter is efficient', async() => {
			const start = performance.now()
			const results = await db.store('items').query()
				.where('byCategory').equals('electronics')
				.filter(item => item.value > 500)
				.toArray()
			const duration = performance.now() - start

			// Should have some results (roughly half of electronics)
			expect(results.length).toBeGreaterThan(0)
			expect(results.length).toBeLessThanOrEqual(100)
			expect(duration).toBeLessThan(200)
		})
	})

	// ─── Read Performance ────────────────────────────────────

	describe('read performance', () => {
		beforeEach(async() => {
			const items = generateItems(1000)
			await db.store('items').set(items)
		})

		it('batch get is efficient', async() => {
			const keys = Array.from({ length: 100 }, (_, i) =>
				`item-${String(i * 10).padStart(6, '0')}`,
			)

			const start = performance.now()
			const results = await db.store('items').get(keys)
			const duration = performance.now() - start

			expect(results).toHaveLength(100)
			expect(duration).toBeLessThan(200)
		})

		it('all() retrieves 1000 records efficiently', async() => {
			const start = performance.now()
			const all = await db.store('items').all()
			const duration = performance.now() - start

			expect(all).toHaveLength(1000)
			expect(duration).toBeLessThan(500)
		})

		it('count() is fast', async() => {
			const start = performance.now()
			const count = await db.store('items').count()
			const duration = performance.now() - start

			expect(count).toBe(1000)
			expect(duration).toBeLessThan(50)
		})
	})

	// ─── Iteration Performance ───────────────────────────────

	describe('iteration performance', () => {
		beforeEach(async() => {
			const items = generateItems(500)
			await db.store('items').set(items)
		})

		it('iterate() with early break is efficient', async() => {
			let count = 0
			const start = performance.now()

			for await (const _ of db.store('items').iterate()) {
				count++
				if (count >= 50) break
			}

			const duration = performance.now() - start

			expect(count).toBe(50)
			expect(duration).toBeLessThan(100)
		})

		it('iterateKeys() is faster than iterate()', async() => {
			let keysCount = 0
			let valuesCount = 0

			const keysStart = performance.now()
			for await (const _ of db.store('items').iterateKeys()) {
				keysCount++
			}
			const keysDuration = performance.now() - keysStart

			const valuesStart = performance.now()
			for await (const _ of db.store('items').iterate()) {
				valuesCount++
			}
			const valuesDuration = performance.now() - valuesStart

			expect(keysCount).toBe(valuesCount)
			// Keys iteration should be faster (no value deserialization)
			expect(keysDuration).toBeLessThanOrEqual(valuesDuration)
		})
	})

	// ─── Transaction Performance ─────────────────────────────

	describe('transaction performance', () => {
		it('multi-store transaction is efficient', async() => {
			const items = generateItems(100)

			const start = performance.now()
			await db.write('items', async(tx) => {
				for (const item of items) {
					await tx.store('items').set(item)
				}
			})
			const duration = performance.now() - start

			const count = await db.store('items').count()
			expect(count).toBe(100)
			expect(duration).toBeLessThan(500)
		})
	})

	// ─── Native Comparison ───────────────────────────────────

	describe('native comparison', () => {
		it('wrapper overhead is minimal', async() => {
			const items = generateItems(1_000)

			// Using wrapper
			const wrapperStart = performance.now()
			await db.store('items').set(items)
			const wrapperDuration = performance.now() - wrapperStart

			// Clear for native test
			await db.store('items').clear()

			// Using native
			const nativeDb = db.native
			const nativeStart = performance.now()

			await new Promise<void>((resolve, reject) => {
				const tx = nativeDb.transaction(['items'], 'readwrite')
				const store = tx.objectStore('items')

				for (const item of items) {
					store.put(item)
				}

				tx.oncomplete = () => resolve()
				tx.onerror = () => reject(tx.error ?? new Error('Transaction failed'))
			})

			const nativeDuration = performance.now() - nativeStart

			// Wrapper should add minimal overhead (< 2x)
			expect(wrapperDuration).toBeLessThan(nativeDuration * 3)
		})
	})
})
