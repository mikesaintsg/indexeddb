# Phase 8: Polish

> **Status:** ⏳ Pending  
> **Started:** —  
> **Target:** —  
> **Depends on:** Phase 7 (Reactivity) ⏳ Pending

## Objective

Complete the library with migrations, full documentation, showcase demo, and integration tests. By end of phase, the library is production-ready.

## Deliverables

| #    | Deliverable                            | Status    | Assignee |
|------|----------------------------------------|-----------|----------|
| 8.1  | Migration system implementation        | ⏳ Pending | —        |
| 8.2  | Migration context with db/tx access    | ⏳ Pending | —        |
| 8.3  | Migration ordering and execution       | ⏳ Pending | —        |
| 8.4  | Integration tests (crud.test.ts)       | ⏳ Pending | —        |
| 8.5  | Integration tests (migrations.test.ts) | ⏳ Pending | —        |
| 8.6  | Integration tests (cross-tab.test.ts)  | ⏳ Pending | —        |
| 8.7  | Showcase demo implementation           | ⏳ Pending | —        |
| 8.8  | Full API documentation review          | ⏳ Pending | —        |
| 8.9  | README finalization                    | ⏳ Pending | —        |
| 8.10 | Package.json exports configuration     | ⏳ Pending | —        |
| 8.11 | Final quality gates pass               | ⏳ Pending | —        |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: 8.1 Migration System

### Requirements

1. Run migrations in version order during onupgradeneeded
2. Provide MigrationContext with database and transaction
3. Support both sync and async migration functions
4. Apply store schema changes before migrations
5. Execute only migrations for version range

### Interface Contract

```typescript
// From src/types.ts
interface MigrationContext {
	readonly database: IDBDatabase
	readonly transaction: IDBTransaction
	readonly oldVersion: number
	readonly newVersion: number
}

interface Migration {
	readonly version: number
	readonly migrate: (context: MigrationContext) => void | Promise<void>
}
```

### Implementation Checklist

- [ ] Add migrations to DatabaseOptions
- [ ] Sort migrations by version on init
- [ ] Hook into onupgradeneeded handler
- [ ] Create stores from schema first
- [ ] Build MigrationContext
- [ ] Execute migrations in order
- [ ] Handle async migrations properly
- [ ] Wrap migration errors in UpgradeError
- [ ] Add migration tests

### Acceptance Criteria

```typescript
describe('Migrations', () => {
	it('runs migrations in order', async () => {
		const order: number[] = []
		
		const db = await createDatabase({
			name: 'test',
			version: 3,
			stores: { users: {} },
			migrations: [
				{ version: 3, migrate: () => { order.push(3) } },
				{ version: 2, migrate: () => { order.push(2) } }
			]
		})
		
		expect(order).toEqual([2, 3])
	})

	it('provides migration context', async () => {
		let context: MigrationContext | null = null
		
		await createDatabase({
			name: 'test',
			version: 2,
			stores: { users: {} },
			migrations: [{
				version: 2,
				migrate: (ctx) => { context = ctx }
			}]
		})
		
		expect(context?.oldVersion).toBe(0)
		expect(context?.newVersion).toBe(2)
		expect(context?.database).toBeInstanceOf(IDBDatabase)
		expect(context?.transaction).toBeInstanceOf(IDBTransaction)
	})

	it('can add index in migration', async () => {
		// First create v1
		const db1 = await createDatabase({
			name: 'test',
			version: 1,
			stores: { users: {} }
		})
		await db1.store('users').set({ id: 'u1', email: 'test@test.com' })
		db1.close()

		// Upgrade to v2 with index
		const db2 = await createDatabase({
			name: 'test',
			version: 2,
			stores: { users: {} },
			migrations: [{
				version: 2,
				migrate: (ctx) => {
					const store = ctx.transaction.objectStore('users')
					store.createIndex('byEmail', 'email')
				}
			}]
		})

		const user = await db2.store('users').index('byEmail').get('test@test.com')
		expect(user?.id).toBe('u1')
	})

	it('can transform data in migration', async () => {
		// Create v1 with old data format
		const db1 = await createDatabase({
			name: 'test',
			version: 1,
			stores: { users: {} }
		})
		await db1.store('users').set({ id: 'u1', fullName: 'Alice Smith' })
		db1.close()

		// Upgrade to v2 with data transformation
		const db2 = await createDatabase({
			name: 'test',
			version: 2,
			stores: { users: {} },
			migrations: [{
				version: 2,
				migrate: async (ctx) => {
					const store = ctx.transaction.objectStore('users')
					const request = store.openCursor()
					
					await new Promise<void>((resolve, reject) => {
						request.onsuccess = () => {
							const cursor = request.result
							if (!cursor) {
								resolve()
								return
							}
							const user = cursor.value
							if (user.fullName) {
								const [firstName, ...rest] = user.fullName.split(' ')
								cursor.update({
									...user,
									firstName,
									lastName: rest.join(' ')
								})
							}
							cursor.continue()
						}
						request.onerror = () => reject(request.error)
					})
				}
			}]
		})

		const user = await db2.store('users').get('u1')
		expect(user?.firstName).toBe('Alice')
		expect(user?.lastName).toBe('Smith')
	})
})
```

---

## Integration Tests

### crud.test.ts

Full CRUD workflows testing the complete API:

```typescript
describe('Integration: CRUD', () => {
	it('complete user lifecycle', async () => {
		// Create
		await store.add({ id: 'u1', name: 'Alice', status: 'active' })
		
		// Read
		const user = await store.resolve('u1')
		expect(user.name).toBe('Alice')
		
		// Update
		await store.set({ ...user, name: 'Alice Smith' })
		const updated = await store.get('u1')
		expect(updated?.name).toBe('Alice Smith')
		
		// Delete
		await store.remove('u1')
		expect(await store.has('u1')).toBe(false)
	})

	it('batch operations are atomic', async () => {
		// All or nothing
	})

	it('query builder with pagination', async () => {
		// Setup data
		// Query with where, filter, limit, offset
		// Verify results
	})
})
```

### cross-tab.test.ts

Cross-tab synchronization tests:

```typescript
describe('Integration: Cross-Tab', () => {
	it('receives changes from other tabs', async () => {
		// Setup two database connections
		// Make change in one
		// Verify event received in other with source: 'remote'
	})
})
```

---

## Showcase Demo

### Requirements

1. Single-page demo in `showcase/` folder
2. Demonstrates all major features
3. Interactive UI for testing operations
4. Builds to single HTML file

### Features to Demo

- [ ] Database creation with schema
- [ ] CRUD operations
- [ ] Query builder usage
- [ ] Index queries
- [ ] Transaction example
- [ ] Change event logging
- [ ] Cross-tab sync demo

---

## Documentation Review

### Checklist

- [ ] All public exports have TSDoc
- [ ] Examples are copy-pasteable
- [ ] guides/indexeddb.md is complete
- [ ] README has quick start
- [ ] DESIGN.md is up to date
- [ ] All phases completed

---

## Package Configuration

### package.json Exports

```json
{
	"exports": {
		".": {
			"types": "./dist/types.d.ts",
			"import": "./dist/index.js"
		}
	},
	"types": "./dist/types.d.ts",
	"main": "./dist/index.js",
	"module": "./dist/index.js",
	"files": ["dist"]
}
```

### Blocked By

- Phase 7 must be complete

### Blocks

- Nothing — this is the final phase

## Notes

- Migrations execute during onupgradeneeded (blocking)
- Async migrations must complete before upgrade finishes
- Consider migration dry-run/validation
- Showcase should work offline
- Test on multiple browsers

## Phase Completion Criteria

All of the following must be true:

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage
- [ ] `npm run build` succeeds
- [ ] Showcase builds and runs
- [ ] No `it.todo()` remaining
- [ ] README complete
- [ ] PLAN.md shows all phases complete

