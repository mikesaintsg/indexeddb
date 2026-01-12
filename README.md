# @mikesaintsg/indexeddb

> A focused IndexedDB wrapper that enhances the native API without abstracting it away

## Status

🚧 **In Development** — Not yet ready for production use

## Features

- ✅ **Type Safety** — Generic schema types with full TypeScript support
- ✅ **Promise-based** — Async/await instead of event callbacks
- ✅ **Ergonomic API** — Simplified CRUD, batch operations, query builder
- ✅ **Native Access** — Full access to underlying IndexedDB objects
- ✅ **Auto-batching** — Array operations use single transaction
- ✅ **Cross-tab Sync** — Built-in BroadcastChannel integration
- ✅ **Query Builder** — Fluent API mapping to IDBKeyRange
- ✅ **Migrations** — Version-based schema migrations
- ✅ **Zero Dependencies** — Built entirely on Web Platform APIs

## Installation

```bash
npm install @mikesaintsg/indexeddb
```

## Quick Start

```typescript
import { createDatabase } from '@mikesaintsg/indexeddb'

// Define schema
interface User {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly status: 'active' | 'inactive'
}

interface AppSchema {
	readonly users: User
}

// Create database
const db = await createDatabase<AppSchema>({
	name: 'myApp',
	version: 1,
	stores: {
		users: {
			indexes: [
				{ name: 'byEmail', keyPath: 'email', unique: true },
				{ name: 'byStatus', keyPath: 'status' }
			]
		}
	}
})

// Simple operations
await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@example.com', status: 'active' })
const user = await db.store('users').get('u1')       // User | undefined
const user2 = await db.store('users').resolve('u1')  // User (throws if missing)

// Batch operations (single transaction)
await db.store('users').set([user1, user2, user3])

// Query builder
const active = await db.store('users').query()
	.where('status').equals('active')
	.limit(10)
	.toArray()

// Need native access? It's there.
const nativeDb = db.native
```

## Documentation

- **[API Guide](./guides/indexeddb.md)** — Comprehensive usage documentation
- **[Design Document](./guides/DESIGN.md)** — Architecture and design decisions
- **[Project Plan](./guides/PLAN.md)** — Development phases and roadmap

## Development

```bash
# Install dependencies
npm install

# Run type checking
npm run check

# Run linting with autofix
npm run format

# Run tests
npm test

# Build package
npm run build

# Run showcase
npm run dev
```

## Comparison

| Feature          | This Library       | Dexie.js           | idb        |
|------------------|--------------------|--------------------|------------|
| Type safety      | ✅ Generic schemas  | ⚠️ Limited         | ⚠️ Limited |
| Native access    | ✅ `.native`        | ❌ Hidden           | ⚠️ Exposed |
| Query builder    | ✅ Native ops only  | ⚠️ Over-abstracted | ❌ None     |
| Auto batching    | ✅ Yes              | ✅ Yes              | ❌ No       |
| Cross-tab sync   | ✅ BroadcastChannel | ⚠️ Custom          | ❌ No       |
| Bundle size      | ~5KB               | ~30KB              | ~1KB       |
| Dependencies     | 0                  | 0                  | 0          |

## License

MIT © Mike Garcia

