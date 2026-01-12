# Phase 1: Foundation

> **Status:** ✅ Complete  
> **Started:** 2026-01-12  
> **Completed:** 2026-01-12  
> **Depends on:** None

## Objective

Establish the foundation for the IndexedDB wrapper library. By end of phase, all types are defined, error classes are implemented, and core helpers are ready for use in subsequent phases.

## Deliverables

| #   | Deliverable                                  | Status | Assignee |
|-----|----------------------------------------------|--------|----------|
| 1.1 | Complete types.ts with all interfaces        | ✅ Done | —        |
| 1.2 | Error classes (errors.ts)                    | ✅ Done | —        |
| 1.3 | Constants (defaults, error codes)            | ✅ Done | —        |
| 1.4 | Core helpers (promisifyRequest, type guards) | ✅ Done | —        |
| 1.5 | Barrel exports (index.ts)                    | ✅ Done | —        |
| 1.6 | Unit tests for all above                     | ✅ Done | —        |

**Status Legend:**
- ✅ Done
- 🔄 Active
- ⏳ Pending

## Current Focus: 1.2 Error Classes

### Requirements

1. Base `DatabaseError` class with code, message, cause
2. `NotFoundError` with storeName and key
3. `ConstraintError` with storeName and key
4. `QuotaExceededError`
5. `TransactionError` with specific transaction codes
6. `UpgradeError` for migration failures
7. `wrapError()` function to convert native DOMException
8. Type guards for each error class

### Interface Contract

```typescript
// From src/types.ts
type DatabaseErrorCode =
	| 'OPEN_FAILED'
	| 'UPGRADE_FAILED'
	| 'UPGRADE_BLOCKED'
	| 'TRANSACTION_ABORTED'
	| 'TRANSACTION_INACTIVE'
	| 'CONSTRAINT_ERROR'
	| 'QUOTA_EXCEEDED'
	| 'NOT_FOUND'
	| 'DATA_ERROR'
	| 'READ_ONLY'
	| 'VERSION_ERROR'
	| 'INVALID_STATE'
	| 'TIMEOUT'
	| 'UNKNOWN_ERROR'
```

### Implementation Checklist

- [x] Create `src/errors.ts`
- [x] Implement `DatabaseError` base class
- [x] Implement `NotFoundError` extends DatabaseError
- [x] Implement `ConstraintError` extends DatabaseError
- [x] Implement `QuotaExceededError` extends DatabaseError
- [x] Implement `TransactionError` extends DatabaseError
- [x] Implement `UpgradeError` extends DatabaseError
- [x] Implement `wrapError()` function
- [x] Implement type guards: `isDatabaseError`, `isNotFoundError`, etc.
- [x] Add to barrel export

### Acceptance Criteria

```typescript
describe('errors', () => {
	it('NotFoundError has correct properties', () => {
		const error = new NotFoundError('users', 'u1')
		expect(error.code).toBe('NOT_FOUND')
		expect(error.storeName).toBe('users')
		expect(error.key).toBe('u1')
		expect(error.message).toContain('users')
	})

	it('wrapError converts ConstraintError', () => {
		const native = new DOMException('msg', 'ConstraintError')
		const wrapped = wrapError(native, { storeName: 'users', key: 'u1' })
		expect(wrapped).toBeInstanceOf(ConstraintError)
	})

	it('isNotFoundError type guard works', () => {
		const error = new NotFoundError('users', 'u1')
		expect(isNotFoundError(error)).toBe(true)
		expect(isNotFoundError(new Error())).toBe(false)
	})
})
```

### Blocked By

Nothing currently.

### Blocks

- 1.4 (Core helpers) — helpers need error types
- Phase 2 (Core Database) — needs all error classes

## Notes

- Use `#` private fields, not `private` keyword
- All error classes should extend `DatabaseError`
- Error messages should be human-readable
- Include original cause in wrapped errors
- Type guards must narrow properly for TypeScript

## Phase Completion Criteria

All of the following must be true:

- [x] All deliverables marked ✅ Done
- [x] `npm run check` passes
- [x] `npm run test` passes with >80% coverage on new code
- [x] No `it.todo()` remaining in phase scope
- [x] PLAN.md updated to show Phase 1 complete

