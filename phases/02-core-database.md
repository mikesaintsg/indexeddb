# Phase 2: Core Database

> **Status:** ⏳ Pending  
> **Started:** —  
> **Target:** —  
> **Depends on:** Phase 1 (Foundation) ⏳ Pending

## Objective

Implement the core database connection with lazy opening, store access, and the factory function. By end of phase, users can create a database and access stores.

## Deliverables

| #   | Deliverable                                    | Status    | Assignee |
|-----|------------------------------------------------|-----------|----------|
| 2.1 | Database class implementation                  | ⏳ Pending | —        |
| 2.2 | `createDatabase()` factory function            | ⏳ Pending | —        |
| 2.3 | Lazy connection opening                        | ⏳ Pending | —        |
| 2.4 | Store accessor (`db.store()`)                  | ⏳ Pending | —        |
| 2.5 | Database accessors (name, version, storeNames) | ⏳ Pending | —        |
| 2.6 | Lifecycle methods (close, drop)                | ⏳ Pending | —        |
| 2.7 | Unit tests for all above                       | ⏳ Pending | —        |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: 2.1 Database Class

### Requirements

1. Implement `DatabaseInterface<Schema>` from types.ts
2. Lazy connection: don't open until first operation
3. Store schema definitions for store creation
4. Expose `.native` property for IDBDatabase access
5. Handle connection errors properly
6. Support version upgrades and store creation

### Interface Contract

```typescript
// From src/types.ts
interface DatabaseInterface<Schema extends DatabaseSchema>
	extends DatabaseSubscriptions {
	readonly native: IDBDatabase
	getName(): string
	getVersion(): number
	getStoreNames(): readonly string[]
	isOpen(): boolean
	store<K extends keyof Schema & string>(name: K): StoreInterface<Schema[K]>
	read<K extends keyof Schema & string>(
		storeNames: K | readonly K[],
		operation: TransactionOperation<Schema, K>
	): Promise<void>
	write<K extends keyof Schema & string>(
		storeNames: K | readonly K[],
		operation: TransactionOperation<Schema, K>,
		options?: TransactionOptions
	): Promise<void>
	close(): void
	drop(): Promise<void>
}
```

### Implementation Checklist

- [ ] Create `src/core/Database.ts`
- [ ] Implement private `#db: IDBDatabase | null` field
- [ ] Implement private `#opening: Promise<IDBDatabase> | null` field
- [ ] Implement `#ensureOpen()` for lazy connection
- [ ] Implement `#open()` with indexedDB.open()
- [ ] Handle `onupgradeneeded` for store creation
- [ ] Implement all accessor methods
- [ ] Implement `store()` returning StoreInterface
- [ ] Implement `close()` and `drop()`
- [ ] Add to barrel export

### Acceptance Criteria

```typescript
describe('Database', () => {
	it('opens lazily on first operation', async () => {
		const db = await createDatabase({ name: 'test', version: 1, stores: {} })
		expect(db.isOpen()).toBe(false)
		await db.store('users').get('u1')
		expect(db.isOpen()).toBe(true)
	})

	it('creates stores from schema', async () => {
		const db = await createDatabase({
			name: 'test',
			version: 1,
			stores: { users: {}, posts: { keyPath: 'slug' } }
		})
		expect(db.getStoreNames()).toContain('users')
		expect(db.getStoreNames()).toContain('posts')
	})

	it('exposes native IDBDatabase', async () => {
		const db = await createDatabase({ name: 'test', version: 1, stores: {} })
		expect(db.native).toBeInstanceOf(IDBDatabase)
	})
})
```

### Blocked By

- Phase 1 must be complete

### Blocks

- 2.4 (Store accessor) — needs Database implementation
- Phase 3 (Store Operations) — needs Database

## Notes

- Use `#` private fields for runtime encapsulation
- Database opens on first store access, not on `createDatabase()`
- Store `options` for reference during upgrades
- Handle `onblocked` event for upgrade conflicts
- Clean up BroadcastChannel on close

## Phase Completion Criteria

All of the following must be true:

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage on new code
- [ ] No `it.todo()` remaining in phase scope
- [ ] PLAN.md updated to show Phase 2 complete

