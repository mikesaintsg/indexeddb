# Phase 3: Store Operations

> **Status:** ✅ Complete  
> **Started:** 2026-01-12  
> **Completed:** 2026-01-12  
> **Depends on:** Phase 2 (Core Database) ✅ Complete

## Objective

Implement full CRUD operations on object stores with automatic batching for arrays. By end of phase, users can perform all basic data operations.

## Deliverables

| #    | Deliverable                                 | Status    | Assignee |
|------|---------------------------------------------|-----------|----------|
| 3.1  | Store class implementation                  | ✅ Done    | —        |
| 3.2  | `get()` single and array overloads          | ✅ Done    | —        |
| 3.3  | `resolve()` single and array overloads      | ✅ Done    | —        |
| 3.4  | `set()` upsert with auto-batching           | ✅ Done    | —        |
| 3.5  | `add()` insert with constraint errors       | ✅ Done    | —        |
| 3.6  | `remove()` single and array                 | ✅ Done    | —        |
| 3.7  | `has()` existence check                     | ✅ Done    | —        |
| 3.8  | Bulk operations (all, keys, clear, count)   | ✅ Done    | —        |
| 3.9  | Store accessors (name, keyPath, indexNames) | ✅ Done    | —        |
| 3.10 | Unit tests for all above                    | ✅ Done    | —        |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: 3.1 Store Class

### Requirements

1. Implement `StoreInterface<T>` from types.ts
2. Single and array overloads for get/resolve/set/add/remove/has
3. Array operations use single transaction (atomic)
4. `resolve()` throws `NotFoundError` if missing
5. `add()` throws `ConstraintError` if key exists
6. `remove()` silently succeeds if key missing
7. Expose `.native` property for IDBObjectStore

### Interface Contract

```typescript
// From src/types.ts — key methods
interface StoreInterface<T> extends StoreSubscriptions {
	readonly native: IDBObjectStore
	getName(): string
	getKeyPath(): KeyPath | null
	getIndexNames(): readonly string[]
	hasAutoIncrement(): boolean
	
	get(key: ValidKey): Promise<T | undefined>
	get(keys: readonly ValidKey[]): Promise<readonly (T | undefined)[]>
	
	resolve(key: ValidKey): Promise<T>
	resolve(keys: readonly ValidKey[]): Promise<readonly T[]>
	
	set(value: T, key?: ValidKey): Promise<ValidKey>
	set(values: readonly T[]): Promise<readonly ValidKey[]>
	
	add(value: T, key?: ValidKey): Promise<ValidKey>
	add(values: readonly T[]): Promise<readonly ValidKey[]>
	
	remove(key: ValidKey): Promise<void>
	remove(keys: readonly ValidKey[]): Promise<void>
	
	has(key: ValidKey): Promise<boolean>
	has(keys: readonly ValidKey[]): Promise<readonly boolean[]>
	
	all(query?: IDBKeyRange | null, count?: number): Promise<readonly T[]>
	keys(query?: IDBKeyRange | null, count?: number): Promise<readonly ValidKey[]>
	clear(): Promise<void>
	count(query?: IDBKeyRange | ValidKey | null): Promise<number>
}
```

### Implementation Checklist

- [ ] Create `src/core/Store.ts`
- [ ] Implement constructor with database and store name
- [ ] Implement private transaction helper
- [ ] Implement `get()` with single/array detection
- [ ] Implement `resolve()` with NotFoundError
- [ ] Implement `set()` with auto-batching
- [ ] Implement `add()` with ConstraintError
- [ ] Implement `remove()` silent on missing
- [ ] Implement `has()` using count
- [ ] Implement `all()`, `keys()`, `clear()`, `count()`
- [ ] Implement accessor methods
- [ ] Add to barrel export

### Acceptance Criteria

```typescript
describe('Store', () => {
	describe('get', () => {
		it('returns undefined for missing key', async () => {
			const result = await store.get('nonexistent')
			expect(result).toBeUndefined()
		})
		
		it('returns array for array input', async () => {
			const results = await store.get(['u1', 'u2'])
			expect(Array.isArray(results)).toBe(true)
		})
	})
	
	describe('resolve', () => {
		it('throws NotFoundError for missing key', async () => {
			await expect(store.resolve('missing'))
				.rejects.toThrow(NotFoundError)
		})
	})
	
	describe('set', () => {
		it('batches array in single transaction', async () => {
			const keys = await store.set([user1, user2, user3])
			expect(keys).toHaveLength(3)
		})
	})
	
	describe('add', () => {
		it('throws ConstraintError for duplicate key', async () => {
			await store.add({ id: 'u1', name: 'Alice' })
			await expect(store.add({ id: 'u1', name: 'Bob' }))
				.rejects.toThrow(ConstraintError)
		})
	})
})
```

### Blocked By

- Phase 2 must be complete

### Blocks

- Phase 4 (Indexes & Cursors) — needs Store
- Phase 5 (Query Builder) — needs Store

## Notes

- Array detection: `Array.isArray(input)`
- Use `promisifyRequest()` from helpers
- Batch operations create single readwrite transaction
- Consider key extraction for in-line keyPath stores
- Store reference to database for transaction creation

## Phase Completion Criteria

All of the following must be true:

- [ ] All deliverables marked ✅ Done
- [ ] `npm run check` passes
- [ ] `npm run test` passes with >80% coverage on new code
- [ ] No `it.todo()` remaining in phase scope
- [ ] PLAN.md updated to show Phase 3 complete

