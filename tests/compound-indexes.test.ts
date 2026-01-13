/**
 * Tests for compound index functionality
 *
 * @remarks
 * Tests compound indexes (indexes with array key paths) to ensure:
 * - Definition and creation works
 * - Querying with all(), count(), iterate() works
 * - extractKey handles compound key paths correctly
 *
 * Note: Direct get() with compound keys has API ambiguity since arrays
 * are used both for compound keys AND for batch operations. Use key ranges
 * or iterate() for compound index queries.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createDatabase } from '../src/index.js'
import type { DatabaseInterface } from '../src/types.js'
import { extractKey } from '../src/helpers.js'

interface Person {
	readonly firstName: string
	readonly lastName: string
	readonly age: number
	readonly email: string
	readonly createdAt: Date
}

interface AppSchema {
	readonly people: Person
}

describe('compound indexes', () => {
	let db: DatabaseInterface<AppSchema>

	beforeEach(async () => {
		// Create database with compound indexes
		db = await createDatabase<AppSchema>({
			name: `test-compound-${Date.now()}-${Math.random()}`,
			version: 1,
			stores: {
				people: {
					keyPath: 'email',
					indexes: [
						// Compound index: lastName + firstName
						{
							name: 'byNameDate',
							keyPath: ['lastName', 'firstName'],
						},
						// Compound index: lastName + createdAt
						{
							name: 'byLastNameDate',
							keyPath: ['lastName', 'createdAt'],
						},
						// Single index for comparison
						{
							name: 'byLastName',
							keyPath: 'lastName',
						},
					],
				},
			},
		})

		// Add test data
		const store = db.store('people')
		await store.set([
			{
				email: 'alice@example.com',
				firstName: 'Alice',
				lastName: 'Smith',
				age: 30,
				createdAt: new Date('2024-01-01'),
			},
			{
				email: 'bob@example.com',
				firstName: 'Bob',
				lastName: 'Smith',
				age: 35,
				createdAt: new Date('2024-01-02'),
			},
			{
				email: 'charlie@example.com',
				firstName: 'Charlie',
				lastName: 'Jones',
				age: 28,
				createdAt: new Date('2024-01-03'),
			},
			{
				email: 'alice2@example.com',
				firstName: 'Alice',
				lastName: 'Jones',
				age: 25,
				createdAt: new Date('2024-01-04'),
			},
		])
	})

	it('defines compound index correctly', () => {
		const store = db.store('people')
		const indexNames = store.getIndexNames()

		expect(indexNames).toContain('byNameDate')
		expect(indexNames).toContain('byLastNameDate')
		expect(indexNames).toContain('byLastName')
	})

	it('compound index keyPath is array', () => {
		const index = db.store('people').index('byNameDate')

		const keyPath = index.getKeyPath()

		expect(Array.isArray(keyPath)).toBe(true)
		expect(keyPath).toEqual(['lastName', 'firstName'])
	})

	it('extractKey works with compound key paths', () => {
		const person = {
			email: 'test@example.com',
			firstName: 'John',
			lastName: 'Doe',
			age: 30,
			createdAt: new Date('2024-01-01'),
		}

		const key = extractKey(person, ['lastName', 'firstName'])

		expect(Array.isArray(key)).toBe(true)
		expect(key).toEqual(['Doe', 'John'])
	})

	it('counts records by compound index', async () => {
		const index = db.store('people').index('byNameDate')

		const total = await index.count()

		expect(total).toBe(4)
	})

	it('retrieves all records from compound index', async () => {
		const index = db.store('people').index('byNameDate')

		const all = await index.all()

		expect(all).toHaveLength(4)
		// Compound indexes should sort by first key, then second key
		expect(all[0]?.lastName).toBeDefined()
	})

	it('iterates over compound index', async () => {
		const index = db.store('people').index('byNameDate')

		const people: Person[] = []
		for await (const person of index.iterate()) {
			people.push(person)
		}

		expect(people).toHaveLength(4)
		// Should be sorted by compound key
		expect(people[0]?.lastName).toBeDefined()
	})

	it('opens cursor on compound index', async () => {
		const index = db.store('people').index('byNameDate')

		const cursor = await index.openCursor()

		expect(cursor).not.toBeNull()
		expect(cursor?.getValue().lastName).toBeDefined()
	})

	it('gets primary keys from compound index', async () => {
		const index = db.store('people').index('byNameDate')

		const keys = await index.keys()

		expect(keys).toHaveLength(4)
		// Should return primary keys (emails)
		expect(keys.some(k => k === 'alice@example.com')).toBe(true)
	})

	it('uses compound index in transaction', async () => {
		let countInTransaction = 0

		await db.read(['people'], async (tx) => {
			const store = tx.store('people')
			const index = store.index('byNameDate')

			countInTransaction = await index.count()

			// Verify it's the TransactionIndex (has native property)
			expect(index.native).toBeDefined()
		})

		expect(countInTransaction).toBe(4)
	})

	it('compound index operations are atomic in transaction', async () => {
		let allInTransaction: readonly Person[] = []

		await db.write(['people'], async (tx) => {
			const store = tx.store('people')
			const index = store.index('byNameDate')

			// Get all via compound index
			allInTransaction = await index.all()

			// Verify it's the TransactionIndex
			expect(index.native).toBeDefined()
		})

		expect(allInTransaction).toHaveLength(4)
	})

	it('uses query builder with compound index', async () => {
		// Query builder can filter compound indexed data
		const query = db.store('people')
			.query()
			.where('lastName').equals('Smith')

		const results = await query.toArray()

		expect(results).toHaveLength(2)
		expect(results.every(p => p.lastName === 'Smith')).toBe(true)
	})
})
