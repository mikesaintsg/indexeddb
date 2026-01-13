/**
 * Tests for compound index functionality
 *
 * @remarks
 * Tests compound indexes (indexes with array key paths) to ensure:
 * - Definition and creation works
 * - Querying with compound keys works
 * - extractKey handles compound key paths correctly
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createDatabase } from '../src/index.js'
import type { DatabaseInterface } from '../src/types.js'

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

	it('queries compound index with array key', async () => {
		const index = db.store('people').index('byNameDate')

		// First verify the index was created properly
		const keyPath = index.getKeyPath()
		expect(Array.isArray(keyPath)).toBe(true)
		expect(keyPath).toEqual(['lastName', 'firstName'])

		// Verify data exists
		const all = await index.all()
		expect(all.length).toBeGreaterThan(0)

		// Query by compound key [lastName, 'Alice']
		const person = await index.get(['Smith', 'Alice'])

		expect(person).toBeDefined()
		if (person) {
			expect(person.email).toBe('alice@example.com')
			expect(person.firstName).toBe('Alice')
			expect(person.lastName).toBe('Smith')
		}
	})

	it('returns undefined for non-matching compound key', async () => {
		const index = db.store('people').index('byNameDate')

		// Non-existent combination
		const person = await index.get(['Smith', 'Charlie'])

		expect(person).toBeUndefined()
	})

	it('queries multiple records with compound keys', async () => {
		const index = db.store('people').index('byNameDate')

		const people = await index.get([
			['Smith', 'Alice'],
			['Jones', 'Alice'],
		])

		expect(people).toHaveLength(2)
		expect(people[0]?.email).toBe('alice@example.com')
		expect(people[1]?.email).toBe('alice2@example.com')
	})

	it('queries compound index with Date values', async () => {
		const index = db.store('people').index('byLastNameDate')

		const person = await index.get(['Smith', new Date('2024-01-01')])

		expect(person).toBeDefined()
		expect(person?.email).toBe('alice@example.com')
	})

	it('resolves with compound key', async () => {
		const index = db.store('people').index('byNameDate')

		const person = await index.resolve(['Jones', 'Charlie'])

		expect(person.email).toBe('charlie@example.com')
		expect(person.firstName).toBe('Charlie')
		expect(person.lastName).toBe('Jones')
	})

	it('throws NotFoundError for missing compound key', async () => {
		const index = db.store('people').index('byNameDate')

		await expect(
			index.resolve(['NonExistent', 'Person']),
		).rejects.toThrow('not found')
	})

	it('counts records by compound index', async () => {
		const index = db.store('people').index('byLastNameDate')

		// Count all records
		const total = await index.count()
		expect(total).toBe(4)

		// Count specific compound key
		const specific = await index.count(['Smith', new Date('2024-01-01')])
		expect(specific).toBe(1)
	})

	it('retrieves all records from compound index', async () => {
		const index = db.store('people').index('byNameDate')

		const all = await index.all()

		expect(all).toHaveLength(4)
		// Compound indexes should sort by first key, then second key
		expect(all[0]?.lastName).toBe('Jones')
		expect(all[2]?.lastName).toBe('Smith')
	})

	it('iterates over compound index', async () => {
		const index = db.store('people').index('byNameDate')

		const people: Person[] = []
		for await (const person of index.iterate()) {
			people.push(person)
		}

		expect(people).toHaveLength(4)
		// Should be sorted by compound key
		expect(people[0]?.lastName).toBe('Jones')
	})

	it('opens cursor on compound index', async () => {
		const index = db.store('people').index('byNameDate')

		const cursor = await index.openCursor()

		expect(cursor).not.toBeNull()
		expect(cursor?.getValue().lastName).toBe('Jones')
	})

	it('gets primary keys from compound index', async () => {
		const index = db.store('people').index('byNameDate')

		const keys = await index.keys()

		expect(keys).toHaveLength(4)
		// Should return primary keys (emails)
		expect(keys.some(k => k === 'alice@example.com')).toBe(true)
	})

	it('getKey returns primary key for compound index key', async () => {
		const index = db.store('people').index('byNameDate')

		const primaryKey = await index.getKey(['Smith', 'Bob'])

		expect(primaryKey).toBe('bob@example.com')
	})

	it('uses compound index in transaction', async () => {
		await db.write(['people'], async (tx) => {
			const store = tx.store('people')
			const index = store.index('byNameDate')

			const person = await index.get(['Jones', 'Charlie'])

			expect(person).toBeDefined()
			expect(person?.email).toBe('charlie@example.com')
		})
	})

	it('compound index operations are atomic in transaction', async () => {
		let foundInTransaction: Person | undefined

		await db.write(['people'], async (tx) => {
			const store = tx.store('people')
			const index = store.index('byNameDate')

			// Get via compound index
			foundInTransaction = await index.get(['Smith', 'Alice'])

			// Verify it's the TransactionIndex (has native property)
			expect(index.native).toBeDefined()
		})

		expect(foundInTransaction).toBeDefined()
		expect(foundInTransaction?.email).toBe('alice@example.com')
	})

	it('compound index keyPath is array', () => {
		const index = db.store('people').index('byNameDate')

		const keyPath = index.getKeyPath()

		expect(Array.isArray(keyPath)).toBe(true)
		expect(keyPath).toEqual(['lastName', 'firstName'])
	})
})
