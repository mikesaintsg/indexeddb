# Phase Files Index

This document provides an index to the detailed phase documents for the @mikesaintsg/indexeddb project.

## Phases

| # | Phase             | File                                                       | Status     |
|---|-------------------|------------------------------------------------------------|------------|
| 1 | Foundation        | [01-foundation.md](../phases/01-foundation.md)             | ✅ Complete |
| 2 | Core Database     | [02-core-database.md](../phases/02-core-database.md)       | 🔄 Active  |
| 3 | Store Operations  | [03-store-operations.md](../phases/03-store-operations.md) | ⏳ Pending  |
| 4 | Indexes & Cursors | [04-indexes-cursors.md](../phases/04-indexes-cursors.md)   | ⏳ Pending  |
| 5 | Query Builder     | [05-query-builder.md](../phases/05-query-builder.md)       | ⏳ Pending  |
| 6 | Transactions      | [06-transactions.md](../phases/06-transactions.md)         | ⏳ Pending  |
| 7 | Reactivity        | [07-reactivity.md](../phases/07-reactivity.md)             | ⏳ Pending  |
| 8 | Polish            | [08-polish.md](../phases/08-polish.md)                     | ⏳ Pending  |

**Status Legend:**
- ✅ Complete
- 🔄 Active
- ⏳ Pending

## Phase Dependencies

```
Phase 1: Foundation
    │
    ▼
Phase 2: Core Database
    │
    ▼
Phase 3: Store Operations
    │
    ▼
Phase 4: Indexes & Cursors
    │
    ▼
Phase 5: Query Builder
    │
    ▼
Phase 6: Transactions
    │
    ▼
Phase 7: Reactivity
    │
    ▼
Phase 8: Polish
```

## Quick Reference

### Phase 1: Foundation
Types, errors, helpers, constants — the base layer everything depends on.

### Phase 2: Core Database
Database class, createDatabase factory, lazy connection, store access.

### Phase 3: Store Operations
Full CRUD (get, resolve, set, add, remove, has), batching, bulk operations.

### Phase 4: Indexes & Cursors
Index queries, cursor iteration, async generators.

### Phase 5: Query Builder
Fluent query API, where clauses, filters, pagination.

### Phase 6: Transactions
Explicit transactions, multi-store atomicity, durability options.

### Phase 7: Reactivity
Change events, cross-tab sync with BroadcastChannel.

### Phase 8: Polish
Migrations, integration tests, showcase, documentation.
