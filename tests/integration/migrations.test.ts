/**
 * Integration Tests: Migrations
 *
 * @remarks
 * Tests for database schema migrations including version upgrades,
 * data transformations, and index management.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createDatabase } from '../../src/index.js'
import type { DatabaseSchema, MigrationContext } from '../../src/types.js'

// ============================================================================
// Test Utilities
// ============================================================================

let testDbCounter = 0
function createTestDbName(): string {
	return `test-migration-${Date.now()}-${++testDbCounter}`
}

async function deleteDatabase(name: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.deleteDatabase(name)
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error ?? new Error('Failed to delete database'))
	})
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration: Migrations', () => {
	const createdDatabases: string[] = []

	afterEach(async() => {
		// Clean up all created databases
		for (const name of createdDatabases) {
			try {
				await deleteDatabase(name)
			} catch {
				// Ignore cleanup errors
			}
		}
		createdDatabases.length = 0
	})

	// ─── Basic Migration ─────────────────────────────────────

	describe('basic migration', () => {
		it('runs migrations in version order', async() => {
			const order: number[] = []
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface TestSchema extends DatabaseSchema {
				users: { id: string }
			}

			const db = createDatabase<TestSchema>({
				name: dbName,
				version: 3,
				stores: { users: {} },
				migrations: [
					{ version: 3, migrate: () => { order.push(3) } },
					{ version: 2, migrate: () => { order.push(2) } },
					{ version: 1, migrate: () => { order.push(1) } },
				],
			})

			// Force database open
			await db.store('users').get('test')

			expect(order).toEqual([1, 2, 3])
			db.close()
		})

		it('provides migration context', async() => {
			let capturedContext: MigrationContext | undefined
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface TestSchema extends DatabaseSchema {
				users: { id: string }
			}

			const db = createDatabase<TestSchema>({
				name: dbName,
				version: 2,
				stores: { users: {} },
				migrations: [{
					version: 2,
					migrate: (ctx) => { capturedContext = ctx },
				}],
			})

			await db.store('users').get('test')

			expect(capturedContext).toBeDefined()
			if (capturedContext) {
				expect(capturedContext.oldVersion).toBe(0)
				expect(capturedContext.newVersion).toBe(2)
				expect(capturedContext.database).toBeInstanceOf(IDBDatabase)
				expect(capturedContext.transaction).toBeInstanceOf(IDBTransaction)
			}

			db.close()
		})

		it('only runs migrations for version range', async() => {
			const order: number[] = []
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface TestSchema extends DatabaseSchema {
				users: { id: string }
			}

			// First create v1
			const db1 = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {} },
				migrations: [
					{ version: 1, migrate: () => { order.push(1) } },
				],
			})
			await db1.store('users').get('test')
			db1.close()

			// Clear order for upgrade
			order.length = 0

			// Upgrade to v3
			const db2 = createDatabase<TestSchema>({
				name: dbName,
				version: 3,
				stores: { users: {} },
				migrations: [
					{ version: 1, migrate: () => { order.push(1) } },
					{ version: 2, migrate: () => { order.push(2) } },
					{ version: 3, migrate: () => { order.push(3) } },
				],
			})
			await db2.store('users').get('test')

			// Should only run 2 and 3 (not 1, since we're upgrading from 1)
			expect(order).toEqual([2, 3])
			db2.close()
		})
	})

	// ─── Index Management ────────────────────────────────────

	describe('index management', () => {
		it('can add index in migration', async() => {
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface UserV1 {
				id: string
				email: string
				name: string
			}

			interface TestSchemaV1 extends DatabaseSchema {
				users: UserV1
			}

			// Create v1 with data
			const db1 = createDatabase<TestSchemaV1>({
				name: dbName,
				version: 1,
				stores: { users: {} },
			})

			await db1.store('users').set({ id: 'u1', email: 'alice@test.com', name: 'Alice' })
			await db1.store('users').set({ id: 'u2', email: 'bob@test.com', name: 'Bob' })
			db1.close()

			// Upgrade to v2 with email index
			const db2 = createDatabase<TestSchemaV1>({
				name: dbName,
				version: 2,
				stores: {
					users: {
						indexes: [{ name: 'byEmail', keyPath: 'email', unique: true }],
					},
				},
				migrations: [{
					version: 2,
					migrate: (ctx) => {
						const store = ctx.transaction.objectStore('users')
						if (!store.indexNames.contains('byEmail')) {
							store.createIndex('byEmail', 'email', { unique: true })
						}
					},
				}],
			})

			// Query using new index
			const user = await db2.store('users').index('byEmail').get('bob@test.com')
			expect(user?.id).toBe('u2')

			db2.close()
		})

		it('can remove index in migration', async() => {
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface TestSchema extends DatabaseSchema {
				users: { id: string; email: string }
			}

			// Create v1 with index
			const db1 = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: {
					users: {
						indexes: [{ name: 'byEmail', keyPath: 'email' }],
					},
				},
			})
			await db1.store('users').set({ id: 'u1', email: 'test@test.com' })
			db1.close()

			// Upgrade to v2 removing index
			const db2 = createDatabase<TestSchema>({
				name: dbName,
				version: 2,
				stores: { users: {} },
				migrations: [{
					version: 2,
					migrate: (ctx) => {
						const store = ctx.transaction.objectStore('users')
						if (store.indexNames.contains('byEmail')) {
							store.deleteIndex('byEmail')
						}
					},
				}],
			})

			// Index should no longer exist
			await db2.store('users').get('u1')
			const indexNames = db2.store('users').getIndexNames()
			expect(indexNames).not.toContain('byEmail')

			db2.close()
		})
	})

	// ─── Data Transformation ─────────────────────────────────

	describe('data transformation', () => {
		it('can transform data format in migration', async() => {
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface UserV1 {
				id: string
				fullName: string
			}

			interface UserV2 {
				id: string
				firstName: string
				lastName: string
			}

			interface TestSchemaV1 extends DatabaseSchema {
				users: UserV1
			}

			interface TestSchemaV2 extends DatabaseSchema {
				users: UserV2
			}

			// Create v1 with old format
			const db1 = createDatabase<TestSchemaV1>({
				name: dbName,
				version: 1,
				stores: { users: {} },
			})
			await db1.store('users').set([
				{ id: 'u1', fullName: 'Alice Smith' },
				{ id: 'u2', fullName: 'Bob Jones Jr' },
			])
			db1.close()

			// Upgrade to v2 with data transformation
			const db2 = createDatabase<TestSchemaV2>({
				name: dbName,
				version: 2,
				stores: { users: {} },
				migrations: [{
					version: 2,
					migrate: (ctx) => {
						const store = ctx.transaction.objectStore('users')
						const request = store.openCursor()

						request.onsuccess = () => {
							const cursor = request.result
							if (!cursor) return

							const user = cursor.value as UserV1 & Partial<UserV2>
							if (user.fullName && !user.firstName) {
								const parts = user.fullName.split(' ')
								const firstName = parts[0] ?? ''
								const lastName = parts.slice(1).join(' ')

								cursor.update({
									id: user.id,
									firstName,
									lastName,
								})
							}
							cursor.continue()
						}
					},
				}],
			})

			await db2.store('users').get('u1') // Force open

			const alice = await db2.store('users').get('u1')
			const bob = await db2.store('users').get('u2')

			expect(alice?.firstName).toBe('Alice')
			expect(alice?.lastName).toBe('Smith')
			expect(bob?.firstName).toBe('Bob')
			expect(bob?.lastName).toBe('Jones Jr')

			db2.close()
		})

		it('can add new field with default value', async() => {
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface UserV1 {
				id: string
				name: string
			}

			interface UserV2 {
				id: string
				name: string
				status: string
			}

			interface TestSchemaV1 extends DatabaseSchema {
				users: UserV1
			}

			interface TestSchemaV2 extends DatabaseSchema {
				users: UserV2
			}

			// Create v1
			const db1 = createDatabase<TestSchemaV1>({
				name: dbName,
				version: 1,
				stores: { users: {} },
			})
			await db1.store('users').set([
				{ id: 'u1', name: 'Alice' },
				{ id: 'u2', name: 'Bob' },
			])
			db1.close()

			// Upgrade to v2 adding status field
			const db2 = createDatabase<TestSchemaV2>({
				name: dbName,
				version: 2,
				stores: { users: {} },
				migrations: [{
					version: 2,
					migrate: (ctx) => {
						const store = ctx.transaction.objectStore('users')
						const request = store.openCursor()

						request.onsuccess = () => {
							const cursor = request.result
							if (!cursor) return

							const user = cursor.value as UserV1 & Partial<UserV2>
							if (!user.status) {
								cursor.update({ ...user, status: 'active' })
							}
							cursor.continue()
						}
					},
				}],
			})

			await db2.store('users').get('u1')

			const users = await db2.store('users').all()
			users.forEach(u => expect(u.status).toBe('active'))

			db2.close()
		})
	})

	// ─── Store Management ────────────────────────────────────

	describe('store management', () => {
		it('can add new store in migration', async() => {
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface TestSchemaV1 extends DatabaseSchema {
				users: { id: string }
			}

			interface TestSchemaV2 extends DatabaseSchema {
				users: { id: string }
				posts: { id: string; title: string }
			}

			// Create v1
			const db1 = createDatabase<TestSchemaV1>({
				name: dbName,
				version: 1,
				stores: { users: {} },
			})
			await db1.store('users').set({ id: 'u1' })
			db1.close()

			// Upgrade to v2 with new store
			const db2 = createDatabase<TestSchemaV2>({
				name: dbName,
				version: 2,
				stores: { users: {}, posts: {} },
			})

			await db2.store('posts').set({ id: 'p1', title: 'Hello' })
			const post = await db2.store('posts').get('p1')
			expect(post?.title).toBe('Hello')

			db2.close()
		})

		it('can delete store in migration', async() => {
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface TestSchemaV1 extends DatabaseSchema {
				users: { id: string }
				legacy: { id: string }
			}

			interface TestSchemaV2 extends DatabaseSchema {
				users: { id: string }
			}

			// Create v1 with legacy store
			const db1 = createDatabase<TestSchemaV1>({
				name: dbName,
				version: 1,
				stores: { users: {}, legacy: {} },
			})
			await db1.store('legacy').set({ id: 'old' })
			db1.close()

			// Upgrade to v2 deleting legacy store
			const db2 = createDatabase<TestSchemaV2>({
				name: dbName,
				version: 2,
				stores: { users: {} },
				migrations: [{
					version: 2,
					migrate: (ctx) => {
						if (ctx.database.objectStoreNames.contains('legacy')) {
							ctx.database.deleteObjectStore('legacy')
						}
					},
				}],
			})

			await db2.store('users').get('u1')

			const storeNames = db2.getStoreNames()
			expect(storeNames).toContain('users')
			expect(storeNames).not.toContain('legacy')

			db2.close()
		})
	})

	// ─── Edge Cases ──────────────────────────────────────────

	describe('edge cases', () => {
		it('handles empty migrations array', async() => {
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface TestSchema extends DatabaseSchema {
				users: { id: string }
			}

			const db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {} },
				migrations: [],
			})

			await db.store('users').set({ id: 'u1' })
			const user = await db.store('users').get('u1')
			expect(user?.id).toBe('u1')

			db.close()
		})

		it('handles no migrations property', async() => {
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface TestSchema extends DatabaseSchema {
				users: { id: string }
			}

			const db = createDatabase<TestSchema>({
				name: dbName,
				version: 1,
				stores: { users: {} },
			})

			await db.store('users').set({ id: 'u1' })
			expect(await db.store('users').has('u1')).toBe(true)

			db.close()
		})

		it('migrations with same version run once', async() => {
			const runs: number[] = []
			const dbName = createTestDbName()
			createdDatabases.push(dbName)

			interface TestSchema extends DatabaseSchema {
				users: { id: string }
			}

			const db = createDatabase<TestSchema>({
				name: dbName,
				version: 2,
				stores: { users: {} },
				migrations: [
					{ version: 2, migrate: () => { runs.push(1) } },
					{ version: 2, migrate: () => { runs.push(2) } }, // Same version
				],
			})

			await db.store('users').get('u1')

			// Both migrations with version 2 should run
			expect(runs).toEqual([1, 2])
			db.close()
		})
	})
})
