# Project Plan: @mikesaintsg/indexeddb

> **Status:** Phase 5 of 8 — Query Builder  
> **Last Updated:** 2026-01-12  
> **Next Milestone:** Fluent query API with where clauses

## Vision

A focused IndexedDB wrapper that **enhances** the native API without abstracting it away. Developers get type safety, Promise-based operations, and ergonomic helpers while retaining full access to native IndexedDB when needed. Zero dependencies, browser-native, with cross-tab synchronization built in.

## Non-Goals

Explicit boundaries. What we are NOT building:

- ❌ ORM/Relations — App-layer concern, adds complexity
- ❌ Sync protocol — Use dedicated sync libraries
- ❌ Full-text search — Use dedicated search libraries
- ❌ Schema inference — Explicit schemas are safer
- ❌ Cross-field OR queries — IndexedDB limitation, use filter()
- ❌ Populate/Join — Denormalize or fetch separately
- ❌ Offline-first framework — We're a database wrapper, not a framework

## Architecture

```
┌─────────────────┐
│   factories.ts  │  createDatabase()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Database.ts   │  DatabaseInterface
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌─────────────┐
│Store.ts│ │Transaction.ts│
└───┬────┘ └─────────────┘
    │
┌───┼────────┐
▼   ▼        ▼
Index  Cursor  QueryBuilder
```

**Core Components:**
- **Database** — Connection management, store access, transactions
- **Store** — CRUD operations, query builder, iteration
- **Index** — Index queries, key lookups
- **Cursor** — Manual iteration with update/delete
- **QueryBuilder** — Fluent query API with IDBKeyRange
- **Transaction** — Multi-store atomic operations

## Phases

| # | Phase             | Status     | Description                        |
|---|-------------------|------------|------------------------------------|
| 1 | Foundation        | ✅ Complete | Types, errors, helpers, constants  |
| 2 | Core Database     | ✅ Complete | Database, factories, store access  |
| 3 | Store Operations  | ✅ Complete | Full CRUD, batching, bulk ops      |
| 4 | Indexes & Cursors | ✅ Complete | Index queries, cursor iteration    |
| 5 | Query Builder     | 🔄 Active  | Fluent queries, where clauses      |
| 6 | Transactions      | ⏳ Pending  | Explicit transactions, multi-store |
| 7 | Reactivity        | ⏳ Pending  | Change events, cross-tab sync      |
| 8 | Polish            | ⏳ Pending  | Migrations, docs, showcase         |

**Status Legend:**
- ✅ Complete
- 🔄 Active
- ⏳ Pending

## Decisions Log

### 2026-01-12: Simple Return Types
**Decision:** Methods return values directly, not Result wrappers  
**Rationale:** `get()` returns `T | undefined`, `resolve()` throws. Simpler API, matches developer expectations  
**Alternatives rejected:** Result<T, E> wrapper pattern — over-engineered for this use case

### 2026-01-12: Enhance, Don't Abstract
**Decision:** Expose `.native` property on all wrappers  
**Rationale:** Developers can drop to native IndexedDB when needed  
**Alternatives rejected:** Full abstraction — limits advanced use cases

### 2026-01-12: Unified Single/Array Methods
**Decision:** Same method handles both single and array inputs  
**Rationale:** `set(user)` and `set([users])` — arrays auto-batch  
**Alternatives rejected:** Separate methods (setOne/setMany) — API bloat

## Open Questions

- [ ] Should `iterate()` support `break` cleanup automatically or require explicit transaction close?
- [ ] Should `anyOf()` dedupe by primary key or return duplicates?
- [ ] Should we support compound keyPath in query builder `where()` clause?

## References

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [DESIGN.md](./DESIGN.md)
- [API Guide](./indexeddb.md)
- [Phases Index](./PHASES.md)
