# Universal TypeScript Development Instructions for GitHub Copilot

> **Purpose:** Ensure consistent code design, naming conventions, and architectural patterns across all TypeScript projects—browser, Node.js, or isomorphic—so that generated code matches developer expectations and maintains quality standards.

---

## Critical Rules (Read First)

### Absolute Constraints

| Rule                | Description                                                             |
|---------------------|-------------------------------------------------------------------------|
| **No `any`**        | Use `unknown` and narrow with type guards                               |
| **No `!`**          | No non-null assertions; handle nullability explicitly                   |
| **No `as`**         | No unsafe casts; narrow from `unknown`                                  |
| **No dependencies** | Build with native APIs unless explicitly requested                      |
| **No re-exports**   | Types files define types only; `src/index.ts` is the only barrel export |
| **Symbols matter**  | Never remove unused code to satisfy linters—implement it                |
| **Types first**     | Define interfaces in `src/types.ts` before implementation               |

### File Placement Rules

| Content                 | Location                         |
|-------------------------|----------------------------------|
| Public types/interfaces | `src/types.ts` (SOURCE OF TRUTH) |
| Helper functions        | `src/helpers.ts`                 |
| Constants               | `src/constants.ts`               |
| Factory functions       | `src/factories.ts`               |
| Implementations         | `src/core/[domain].ts`           |
| Tests                   | `tests/` (mirrors `src/`)        |

### Method Naming Semantics

| Prefix                 | Returns             | Use When                      |
|------------------------|---------------------|-------------------------------|
| `get`                  | `T \| undefined`    | Optional lookup, check result |
| `resolve`              | `T` (throws)        | Required lookup, must exist   |
| `all`                  | readonly collection | Bulk retrieval (not `getAll`) |
| `is`, `has`            | boolean             | Check existence/state         |
| `create`, `from`, `of` | instance            | Factory functions             |
| `on`                   | Unsubscribe fn      | Event subscription            |
| `destroy`              | void                | Cleanup entire resource       |
| `close`                | void                | Close connection (can reopen) |
| `drop`                 | void                | Delete table/store            |

### Interface Suffix Rules

1. Behavioral interface with methods → Add `Interface` suffix
2. Data-only interface → No suffix
3. Ends with `Subscriptions` or `Options` → No suffix

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Core Principles](#core-principles)
3. [Dependency Policy](#dependency-policy)
4. [TypeScript Standards](#typescript-standards)
5. [Naming Conventions](#naming-conventions)
6. [Code Organization](#code-organization)
7. [Repository Structure](#repository-structure)
8. [Development Workflow](#development-workflow)
9. [API Design Patterns](#api-design-patterns)
10. [Testing Standards](#testing-standards)
11. [Documentation Standards](#documentation-standards)
12. [Symbol Preservation Protocol](#symbol-preservation-protocol)
13. [Quality Gates](#quality-gates)
14. [Agent Behavior Guidelines](#agent-behavior-guidelines)
15. [Project Configuration Template](#project-configuration-template)

---

## Quick Reference

### Stack
- **Language:** TypeScript (ESM-only, strict mode)
- **Environment:** Isomorphic (browser + Node.js)
- **Shell:** PowerShell (Windows paths with backslashes, chain with semicolons)
- **Testing:** Vitest + Playwright for browser tests

### Quality Commands
```powershell
npm run check    # Typecheck (no emit)
npm run format   # Lint and autofix
npm run build    # Build library
npm test         # Unit tests
```

---

## Core Principles

| Principle                   | Description                                                         |
|-----------------------------|---------------------------------------------------------------------|
| **Determinism**             | Same inputs → same outputs; stable ordering and comparison          |
| **Strict typing**           | No `any`, no `!`, no unsafe casts; narrow from `unknown`            |
| **Zero dependencies**       | Build with native APIs; add packages only when explicitly requested |
| **Readonly immutability**   | Prefer `readonly` outputs; copy-on-write for internal state         |
| **Small, modular APIs**     | Composable functions; real use cases drive API growth               |
| **Environment-agnostic**    | Isolate platform-specific code when needed                          |
| **Accuracy over latency**   | Take time to get things right; precision over speed                 |
| **Types-first development** | Define types before implementation; use as source of truth          |

---

## Dependency Policy

### Core Rule

**NEVER suggest adding npm packages unless explicitly requested by the user.**

### Forbidden Actions
- ❌ Do NOT suggest installing packages
- ❌ Do NOT mention external libraries
- ❌ Do NOT import from packages not already in `package.json`
- ❌ Do NOT add devDependencies without explicit permission

### Required Actions
- ✅ Build custom solutions using native APIs
- ✅ Use native JavaScript/TypeScript APIs (Date, Array, Map, Set, Promise, URL, etc.)
- ✅ Use existing project dependencies only
- ✅ Keep runtime dependency-free when possible

### Native APIs by Environment

| Environment   | Available APIs                                                                       |
|---------------|--------------------------------------------------------------------------------------|
| **Browser**   | DOM, Fetch, Storage, WebSocket, BroadcastChannel, IndexedDB, Canvas, Web Audio       |
| **Node.js**   | `fs`, `path`, `http`, `https`, `crypto`, `stream`, `buffer`, `process`               |
| **Universal** | `Promise`, `Array`, `Map`, `Set`, `RegExp`, `URL`, `URLSearchParams`, `Date`, `Math` |

---

## TypeScript Standards

### Core Type Rules

1. **No `any`** — Use `unknown` and narrow with type guards
2. **No `!`** — Handle nullability explicitly with optional chaining or conditionals
3. **No `as`** — Narrow from `unknown` using validation, not type assertions
4. **Prefer `readonly`** — In public interfaces and return types
5. **Model nullability explicitly** — Use `T | undefined` and optional fields
6. **Named exports only** — Avoid default exports (except when required by frameworks)
7. **ESM imports** — Always include `.js` extensions: `import { x } from './foo.js'`
8. **No Re-exports of types** — Import types directly where needed, only the export barrel should re-export

### Type Guards and Narrowing

Write small, composable user-defined type guards:

```typescript
function isString(value: unknown): value is string {
	return typeof value === 'string'
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0
}
```

**Rules:**
- No mutation inside guards
- Export guards alongside the APIs they validate
- Prefer positive guards over negative complements
- For discriminated unions, use explicit discriminants

### Preserving Subtypes in Type Predicates

When validating functions or complex types, preserve original subtypes via generics:

```typescript
export function isAsyncFunction<F extends (...args: unknown[]) => Promise<unknown>>(fn: F): fn is F
export function isAsyncFunction(fn: unknown): fn is (...args: unknown[]) => Promise<unknown>
export function isAsyncFunction(fn: unknown): boolean {
	if (typeof fn !== 'function') return false
	const name = (fn as { constructor?: { name?: unknown } }).constructor?.name
	return typeof name === 'string' && name === 'AsyncFunction'
}
```

### Generics and Inference

- Constrain generics to the minimum needed: `<T extends object>`
- Avoid unconstrained `<T>` when it loses useful inference
- Prefer conditional and mapped types over excessive overloads

### Immutability and Collections

- Prefer `readonly T[]`, `ReadonlyArray<T>`, `ReadonlyMap<K, V>`, `ReadonlySet<T>`
- Do not mutate inputs; use copy-on-write for internal state
- Public getters should return copies or readonly views, not mutable references
- Document collection ordering semantics

### Encapsulation

- Use `#` private fields (runtime-enforced), not `private` keyword
- Expose via getters/setters only if truly needed
- Keep public surface minimal
- No top-level mutable state

```typescript
class Counter {
	#count = 0

	getCount(): number {
		return this.#count
	}

	increment(): void {
		this.#count++
	}
}
```

### Options Objects

- Define a named `*Options` interface for any exported function/class options
- Place in `src/types.ts`
- Document as single `@param` with fields listed under `@remarks`
- Prefer boolean/enum flags that are orthogonal and stable
- For stateful systems with events, use the [System Hooks Pattern](#system-hooks-pattern)

### Recommended tsconfig Settings

**Base tsconfig.json:**
```json
{
	"compilerOptions": {
		"target": "ESNext",
		"module": "ESNext",
		"moduleResolution": "bundler",
		"lib": ["ESNext", "DOM", "DOM.Iterable"],
		"types": ["node", "vite/client"],
		"noEmit": true,
		"strict": true,
		"skipLibCheck": true,
		"noImplicitAny": true,
		"noUncheckedIndexedAccess": true,
		"exactOptionalPropertyTypes": true,
		"noImplicitOverride": true,
		"useUnknownInCatchVariables": true,
		"resolveJsonModule": true,
		"esModuleInterop": true,
		"baseUrl": ".",
		"paths": { "~/src/*": ["src/*"] }
	},
	"exclude": ["node_modules", "dist"]
}
```

**configs/tsconfig.build.json:**
```json
{
	"extends": "../tsconfig.json",
	"compilerOptions": {
		"noEmit": false,
		"types": []
	},
	"include": ["../src/**/*.ts"]
}
```

---

## Naming Conventions

### Type and Class Naming

| Type                      | Suffix      | Example                   | Location               |
|---------------------------|-------------|---------------------------|------------------------|
| Interface (behavioral)    | `Interface` | `SessionManagerInterface` | `src/types.ts`         |
| Interface (data only)     | None        | `Vector2`, `Rectangle`    | `src/types.ts`         |
| Interface (subscriptions) | None        | `EngineSubscriptions`     | `src/types.ts`         |
| Interface (options)       | None        | `EngineOptions`           | `src/types.ts`         |
| Implementation            | None        | `SessionManager`          | `src/core/[domain].ts` |

**Decision Tree for Interface Suffix:**
1. Does the interface have methods? NO → No suffix needed
2. Does the name end with `Subscriptions`? YES → No suffix needed
3. Does the name end with `Options`? YES → No suffix needed
4. Otherwise → Add `Interface` suffix

**Default Pattern:** Interface → Implementation (no abstract class layer)

TypeScript's type system enforces interface contracts at compile time, making abstract classes unnecessary for most use cases.

### Method Prefix Categories

| Category         | Prefix                               | Return Type         | Purpose                      |
|------------------|--------------------------------------|---------------------|------------------------------|
| **Accessors**    | `get`, `peek`, `at`                  | `T \| undefined`    | Optional lookup (may fail)   |
|                  | `resolve`                            | `T` (throws)        | Required lookup (must exist) |
|                  | `has`, `is`                          | boolean             | Check existence/state        |
|                  | `all`, `keys`, `entries`             | readonly collection | Bulk retrieval               |
| **Mutators**     | `set`, `update`                      | void/this           | Assign or modify             |
|                  | `add`, `create`                      | void/instance       | Insert new (accepts arrays)  |
|                  | `append`, `prepend`, `insert`        | void/this           | Add elements                 |
|                  | `remove`, `clear`                    | void/this           | Remove elements              |
| **Transformers** | `to`, `as`, `map`, `filter`, `clone` | new instance        | Transform (pure)             |
| **Constructors** | `from`, `of`, `create`               | instance            | Factory functions            |
| **Commands**     | `run`, `exec`, `apply`, `compute`    | result              | Execute operations           |
|                  | `validate`, `check`                  | boolean/result      | Verify correctness           |
| **Lifecycle**    | `init`, `load`, `save`, `reset`      | void/any            | State management             |
|                  | `close`                              | void                | Close connections            |
|                  | `destroy`                            | void                | Destroy entire resource      |
|                  | `drop`                               | void/Promise        | Delete table/store           |
| **Events**       | `on`                                 | Unsubscribe fn      | Event subscription           |
| **Async**        | `waitFor`, `schedule`, `ensure`      | Promise             | Async operations             |

### Accessor Semantics: `get` vs `resolve`

The distinction between `get` and `resolve` is critical for expressing intent:

| Method         | Returns          | When Item Missing      | Use When                         |
|----------------|------------------|------------------------|----------------------------------|
| `get(key)`     | `T \| undefined` | Returns `undefined`    | Lookup is optional, check result |
| `resolve(key)` | `T`              | Throws `NotFoundError` | Item must exist, handle error    |

```typescript
// get() — Optional lookup, caller checks result
const user = await store.get('u1')
if (user) {
	console.log(user.name)
}

// resolve() — Required lookup, throws if missing
try {
	const user = await store.resolve('u1')
	console.log(user.name) // Safe - would have thrown
} catch (error) {
	if (isNotFoundError(error)) {
		console.log(`User ${error.key} not found`)
	}
}
```

### Batch Operations: Array Overloads, Not Separate Methods

**Do NOT create separate methods for batch operations.** Methods should accept both single values and arrays:

```typescript
// ✅ Single method handles both cases
await store.set(user)                    // Single value
await store.set([user1, user2, user3])   // Array of values

await store.get('u1')                    // Single key
await store.get(['u1', 'u2', 'u3'])      // Array of keys

// ❌ DO NOT create separate batch methods
await store.setMany(users)               // Wrong
await store.createBatch(items)           // Wrong
await store.executeBatch(operations)     // Wrong
```

Implementation pattern:

```typescript
async set(value: T | readonly T[], key?: ValidKey): Promise<ValidKey | readonly ValidKey[]> {
	if (Array.isArray(value)) {
		return this.#batchSet(value)
	}
	return this.#singleSet(value, key)
}
```

### Database Lifecycle Terminology

| Method      | Purpose                              | Example                     |
|-------------|--------------------------------------|-----------------------------|
| `close()`   | Close connection (can reopen)        | `db.close()`                |
| `drop()`    | Delete a table/store                 | `await db.drop('users')`    |
| `destroy()` | Destroy entire database              | `await db.destroy()`        |

### Bulk Retrieval: Use `all()` Not `getAll()`

```typescript
// ✅ Correct
const users = await store.all()
const keys = await store.keys()

// ❌ Wrong
const users = await store.getAll()
```

### Naming Rules

1. **Structure:** `<prefix><DomainNoun><Qualifier?>`
	- ✅ `getReadyState`, `setVolume`, `isConnected`
	- ❌ `get_state`, `volume`, `connected`

2. **Boolean methods:** Must use `is` or `has`
	- ✅ `isOpen()`, `hasPermission()`
	- ❌ `open()`, `checkPermission()`

3. **No abbreviations** (exceptions: ID, URL, API, HTML, DOM, CSS, JSON, UUID)
	- ✅ `getReadyState`, `setDropEffect`
	- ❌ `getRdyState`, `setDropEff`

4. **One prefix only**
	- ✅ `getValue()` + `setValue()`
	- ❌ `getOrSetValue()`

5. **Event subscriptions:** Return cleanup function
	- ✅ `onMessage(callback): () => void`
	- ❌ `addMessageListener(callback)`

6. **Function variants:** Use separate named functions
	- ✅ `addRowBody()`, `addRowHead()`, `addRowFoot()`
	- ❌ `addRow(section: 'body' | 'head' | 'foot')`

### Qualifier Vocabulary

| Qualifier   | Meaning              | Example              |
|-------------|----------------------|----------------------|
| `ById`      | Lookup by identifier | `getItemById(id)`    |
| `ByKey`     | Lookup by key        | `getValueByKey(key)` |
| `ByIndex`   | Access by position   | `getEntryByIndex(0)` |
| `FromCache` | Use cached source    | `loadFromCache()`    |
| `IfExists`  | Conditional behavior | `deleteIfExists()`   |
| `OrThrow`   | Throw on failure     | `getOrThrow()`       |
| `OrDefault` | Fallback value       | `getOrDefault()`     |

### Method Organization Order

1. **Property Accessors** (`get`, `is`, `has`)
2. **Property Mutators** (`set`, `update`)
3. **Actions/Manipulation** (`append`, `remove`, `send`, `load`)
4. **Event Subscriptions** (`on*` returning cleanup)
5. **Lifecycle** (`init`, `close`, `destroy`)

---

## Code Organization

### Centralized Files

| File               | Purpose                                             |
|--------------------|-----------------------------------------------------|
| `src/types.ts`     | All exported types and interfaces (SOURCE OF TRUTH) |
| `src/helpers.ts`   | Shared utility functions and type guards            |
| `src/constants.ts` | Immutable shared constants                          |
| `src/factories.ts` | Factory functions for creating instances            |
| `src/index.ts`     | Barrel exports (no logic)                           |

### Folder Organization Philosophy

**Prefer descriptive folders over descriptive file names.** Organize related logic into folders that describe the category, with simple file names inside.

**Nesting Guidelines:**
- **Nest related items** — Group by domain or category
- **Don't nest aggressively** — 3-4 levels maximum
- **Folder name provides context** — File names stay simple
- **One index.ts per folder** — Re-exports for clean imports

```
# ✅ CORRECT: Descriptive folders, simple file names
src/
  adapters/
    storage/
      indexeddb.ts     # IndexedDB adapter
      filesystem.ts    # Filesystem adapter
      index.ts         # Re-exports
    providers/
      openai.ts        # OpenAI provider
      anthropic.ts     # Anthropic provider
      index.ts         # Re-exports
    index.ts           # Re-exports all adapters
  core/
      Engine.ts        # Engine implementation
      Session.ts       # Session implementation

# ❌ WRONG: Flat structure with verbose file names
src/adapters/
  indexeddb-storage-adapter.ts
  filesystem-storage-adapter.ts
  openai-provider-adapter.ts
  anthropic-provider-adapter.ts

# ❌ WRONG: Too deeply nested
src/core/engine/internal/handlers/events/lifecycle/init.ts
```

**Why this pattern:**
- Folder hierarchy provides context — file names don't need to repeat it
- Related files are visually grouped in file explorers
- Easier to navigate deep hierarchies
- Barrel exports (`index.ts`) make imports clean
- Category is obvious from path: `adapters/storage/indexeddb.ts`

**Folder naming rules:**
- Use **plural nouns** for categories: `adapters/`, `services/`, `utils/`
- Use **singular or descriptive names** for domains: `storage/`, `auth/`
- Use **PascalCase** for class files: `Engine.ts`, `Session.ts`
- Use **camelCase** for function files: `helpers.ts`, `factories.ts`
- Keep **folder depth reasonable** (3-4 levels max)

### Test Import Guidelines

**Always use aliased package imports in tests, never relative paths:**

```typescript
// ✅ CORRECT: Aliased import from package
import { createDatabase } from '@scope/package'
import type { DatabaseOptions } from '@scope/package'

// ❌ WRONG: Relative path imports
import { createDatabase } from '../../../src/database.js'
import type { DatabaseOptions } from '../../../src/types.js'
```

**Why aliased imports in tests:**
- Tests verify the public API as consumers would use it
- Ensures exports are correctly configured in barrel files
- No path depth wrangling when moving test files
- Catches missing exports early
- Documents the intended public API

**Configure alias in tsconfig.json:**
```json
{
  "compilerOptions": {
    "paths": {
      "@scope/package": ["./src/index.ts"]
    }
  }
}
```

### CRITICAL: No Internal Definitions in Implementation Files

**Implementation files (`src/core/[domain].ts`) should ONLY contain:**
- Class implementations
- Private methods and fields using `#`
- Imports from centralized files

**Implementation files must NOT contain:**
- ❌ Interface definitions (even if only used by that file)
- ❌ Type aliases or type helpers
- ❌ Constants (even if only used by that file)
- ❌ Helper functions (even if only used by that file)
- ❌ Type guards

**ALWAYS extract to the appropriate centralized file:**

| What                              | Extract To         | Even If                         |
|-----------------------------------|--------------------|---------------------------------|
| Interfaces, types, type aliases   | `src/types.ts`     | Only used in one file           |
| Pure helper functions             | `src/helpers.ts`   | Only used in one file           |
| Type guards                       | `src/helpers.ts`   | Only used in one file           |
| Constants, error messages         | `src/constants.ts` | Only used in one file           |
| Factory functions                 | `src/factories.ts` | Only create one type of thing   |

```typescript
// ❌ WRONG: Internal type in implementation file
// src/core/Database.ts
interface InternalCacheEntry {
	readonly key: string
	readonly value: unknown
	readonly expiresAt: number
}

class Database {
	#cache = new Map<string, InternalCacheEntry>()
}

// ✅ CORRECT: Type extracted to types.ts
// src/types.ts
export interface CacheEntry {
	readonly key: string
	readonly value: unknown
	readonly expiresAt: number
}

// src/core/Database.ts
import type { CacheEntry } from '../../types.js'

class Database {
	#cache = new Map<string, CacheEntry>()
}
```

### Barrel Export Pattern

```typescript
// src/index.ts
export * from './[modules/domain].js'
export * from './factories.js'
export * from './helpers.js'
export * from './constants.js'
export type * from './types.js'
```

**CRITICAL:** Use `export *` pattern—do NOT curate exports.

### Environment Portability

**Runtime Neutrality:**
- Library modules should not import platform-specific APIs by default
- Prefer Web Platform APIs or small abstractions
- If platform-specific features are needed, define interfaces and accept implementation from callers
- Avoid side effects at import time

**Isolation Pattern:**

| Code Type    | Location                                                      | Examples                            |
|--------------|---------------------------------------------------------------|-------------------------------------|
| Browser-only | `src/dom/`, `src/browser.ts`, `client/`, `game/`, `showcase/` | DOM manipulation, Canvas            |
| Node-only    | `src/cli.ts`, `src/node/`, `server/`, `scripts/`              | File system, CLI commands           |
| Shared       | `src/`, `shared/`                                             | Validation, parsing, transformation |

**CSS and Styling:**
- All styles in external `.css` or `.scss` files
- Import CSS in main entry point: `import './styles.css'`
- No inline styles in HTML files
- No CSS-in-JS or template literals with CSS
- Use class names, not inline `style` attributes (except for dynamic values)

---

## Repository Structure

### Required Structure

```
project/
├── PLAN.md               # Strategic: What we're building and why
├── phases/               # Tactical: How we're building it
│   ├── 01-foundation.md
│   ├── 02-core-api.md
│   └── 03-integration.md
├── prompts/              # Model prompts for each workflow stage
├── src/                  # Library source
│   ├── index.ts          # Barrel exports only
│   ├── types.ts          # Centralized types (SOURCE OF TRUTH)
│   ├── helpers.ts        # Shared utilities
│   ├── constants.ts      # Immutable constants
│   ├── factories.ts      # Factory functions
│   └── core/             # Implementation classes
│       └── [domain]/     # Domain-specific implementations
├── tests/                # Tests mirroring src/ structure
│   ├── setup.ts          # Test utilities
│   ├── helpers.test.ts   # Tests for helpers.ts
│   ├── core/             # Tests for implementations
│   └── integration/      # Integration tests
├── guides/               # Feature documentation
├── configs/              # Build configurations
├── .github/
│   └── copilot-instructions.md  # Operational: How to write code
├── package.json
├── tsconfig.json
├── eslint.config.ts
├── vite.config.ts
└── vitest.config.ts
```

### Planning Hierarchy

| Level       | File                      | Scope          | Updates                   |
|-------------|---------------------------|----------------|---------------------------|
| Strategic   | `PLAN.md`                 | Entire project | Rarely, major pivots only |
| Tactical    | `phases/*.md`             | Current phase  | After each milestone      |
| Operational | `copilot-instructions.md` | Every task     | Almost never              |

### Optional Folders

| Folder      | Purpose                            | When to Create           |
|-------------|------------------------------------|--------------------------|
| `examples/` | Usage examples                     | Sandbox for testing      |
| `docs/`     | Documentation site                 | For library demos        |
| `game/`     | Game-specific code                 | For game projects        |
| `showcase/` | Library demos                      | For NPM packages         |
| `client/`   | Browser-only app                   | For client apps          |
| `server/`   | Node.js server                     | For server apps          |
| `output/`   | Generated artifacts                | For CLI outputs          |
| `dist/`     | Build output                       | Generated, not committed |
| `scripts/`  | Build automation                   | For build scripts        |

**Rules:**
- Do not create optional folders unless requested
- Adapt to what is present in the repository
- Do not add CI workflows in repos that explicitly avoid them

### Sandbox Folders

Folders like `examples/`, `docs/`, `game/`, `showcase/` serve as **integration playgrounds**:

- Test library APIs in realistic use cases
- Provide interactive demos
- Generate single-file HTML artifacts for review
- **Demonstrate ALL features from `src/`**

**Sandbox vite config pattern:**
```typescript
// configs/vite.showcase.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
	plugins: [viteSingleFile()],
	root: 'showcase',
	publicDir: false,
	build: {
		outDir: '../dist/showcase',
		emptyOutDir: true,
	},
	resolve: {
		alias: { '~/src': resolve(__dirname, '../src') },
	},
})
```

---

## Development Workflow

### Types-First Development Flow

| Phase | Focus             | Key Activities                                              |
|-------|-------------------|-------------------------------------------------------------|
| 1     | Types             | Define interfaces in `src/types.ts` with `Interface` suffix |
| 2     | Implementation    | Implement in `src/core/[domain].ts` using factory functions |
| 3     | Factories         | Create factory functions in `src/factories.ts`              |
| 4     | Unit Tests        | Write tests in `tests/` mirroring source structure          |
| 5     | Documentation     | Update guides and README.md                                 |
| 6     | Sandbox           | Create integration in sandbox folder                        |
| 7     | Integration Tests | Write tests in `tests/integration/`                         |
| 8     | Review            | Run quality gates, commit                                   |

### File Creation Order

```
1. src/types.ts          ← Interfaces (SOURCE OF TRUTH)
2. src/core/[domain].ts    ← Implementations
3. src/helpers.ts        ← Utilities
4. src/constants.ts      ← Constants
5. src/factories.ts      ← Factories
6. src/index.ts          ← Barrel exports
7. tests/                ← Unit tests
8. guides/               ← Documentation
9. [sandbox]/            ← Integration
10. tests/integration/   ← Integration tests
```

### Extraction Rules

| What to Extract   | Destination        | Criteria                        |
|-------------------|--------------------|---------------------------------|
| Types/interfaces  | `src/types.ts`     | Used across files OR public API |
| Helper functions  | `src/helpers.ts`   | Pure functions, type guards     |
| Constants         | `src/constants.ts` | Immutable values                |
| Factory functions | `src/factories.ts` | System instance creation        |

---

## API Design Patterns

### System Hooks Pattern

For complex stateful systems (engines, managers, controllers), use the **Hooks-Options-Interface** pattern:

```typescript
/** Cleanup function returned by event subscriptions */
export type Unsubscribe = () => void

/**
 * Converts subscription methods to hook callbacks for options.
 * Takes methods like `onEvent(callback: (data: T) => void): Unsubscribe`
 * and converts them to `onEvent?: (data: T) => void`
 */
export type SubscriptionToHook<T> = {
	[K in keyof T]?: T[K] extends (callback: infer CB) => Unsubscribe
		? CB
		: never
}

/** 1. State interface (readonly snapshot) */
export interface SystemState {
	readonly isActive: boolean
	readonly count: number
}

/** 2. Subscriptions interface (hook methods) */
export interface SystemSubscriptions {
	onActivate(callback: () => void): Unsubscribe
	onDeactivate(callback: () => void): Unsubscribe
	onChange(callback: (value: string) => void): Unsubscribe
}

/** 3. Options interface (extends Partial<Subscriptions>) */
export interface SystemOptions extends SubscriptionToHook<SystemSubscriptions> {
	readonly requiredOption: string
	readonly optionalOption?: number
}

/** 4. Public interface (extends Subscriptions) */
export interface SystemInterface extends SystemSubscriptions {
	getState(): SystemState
	isActive(): boolean
	start(): void
	stop(): void
	destroy(): void
}
```

**Key Rules:**
1. Subscriptions interface defines hook methods returning `Unsubscribe`
2. Options extends `SubscriptionToHook<Subscriptions>` (converts subscription methods to hook callbacks)
3. Main interface extends `Subscriptions` (hooks required on instances)
4. State interface is always readonly

**Type Ordering:** State → Subscriptions → Options → Interface

### Factory Pattern with Required Adapters

When a system requires a primary dependency (adapter) to function, use this pattern:

```typescript
// ✅ CORRECT: Required adapter is first parameter
const system = createSystem(requiredAdapter, {
	optionalAdapter?: SomeAdapterInterface,
	configOption?: boolean,
	onEvent?: (data) => void,
})

// ❌ WRONG: Required adapter hidden in options
const system = createSystem({
	adapter: requiredAdapter,  // Don't do this
	optionalAdapter?: ...,
})
```

**Key Rules:**
1. Required adapter is always the **first parameter** (not in options)
2. Optional adapters are in the **options object** (second parameter)
3. All optional adapters are **opt-in** — nothing enabled by default
4. Factory returns the system interface

**Pattern Structure:**

```typescript
// Factory function signature
export type CreateSystem = (
	requiredAdapter: RequiredAdapterInterface,
	options?: SystemOptions
) => SystemInterface

// Options contain only optional adapters and configuration
export interface SystemOptions extends SubscriptionToHook<SystemSubscriptions> {
	readonly optionalAdapter?: OptionalAdapterInterface
	readonly configOption?: boolean
}
```

**Why this pattern:**
- Clear dependency — the required adapter is explicit
- Opt-in design — nothing hidden
- Composable — adapters are peers, not layers
- Type-safe — each port has a typed interface

### Adapter Categories

Adapters fall into these categories:

| Category        | Purpose                      | Examples                          |
|-----------------|------------------------------|-----------------------------------|
| **Source**      | Generate or retrieve data    | Provider, Embedding               |
| **Persistence** | Store and load data          | IndexedDB, OPFS, HTTP             |
| **Transform**   | Transform data formats       | ToolFormat, Token, Similarity     |
| **Policy**      | Apply policies to operations | Retry, RateLimit                  |
| **Enhancement** | Add capabilities             | Cache, Batch, Reranker            |

### Result Pattern

The Result pattern is useful for **external operations outside your control** where you want to catch errors without throwing. **Do not use Result for methods within your control** — use `get` (returns undefined) or `resolve` (throws) semantics instead.

**When to use Result pattern:**
- External API calls (fetch, third-party services)
- Parsing untrusted input
- Operations that may fail for unpredictable reasons

**When NOT to use Result pattern:**
- Database lookups within your control → use `get`/`resolve` semantics
- Internal operations → throw appropriate error types

```typescript
// ✅ Good: Result for external operations
type Result<T, E = Error> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: E }

async function fetchUserFromAPI(id: string): Promise<Result<User>> {
	try {
		const response = await fetch(`/api/users/${id}`)
		if (!response.ok) {
			return { ok: false, error: new Error(`HTTP ${response.status}`) }
		}
		const user = await response.json()
		return { ok: true, value: user }
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error : new Error('Unknown') }
	}
}

// ❌ Wrong: Don't use Result for internal lookups
function getUser(id: string): Result<User> { /* Wrong approach */ }

// ✅ Correct: Use get/resolve semantics for internal lookups
function get(id: string): User | undefined { /* Returns undefined if not found */ }
async function resolve(id: string): Promise<User> { /* Throws NotFoundError if not found */ }
```

### Event Subscription Pattern

```typescript
interface EventEmitterInterface {
	onChange(callback: (value: string) => void): () => void
	onError(callback: (error: Error) => void): () => void
}

function createEmitter(): EventEmitterInterface {
	const changeListeners = new Set<(value: string) => void>()

	return {
		onChange(callback): () => void {
			changeListeners.add(callback)
			return () => changeListeners.delete(callback)
		},
		// ...
	}
}
```

### Cleanup Pattern

Every stateful instance should have a `destroy()` method:

```typescript
interface InstanceInterface {
	// ... API methods ...
	destroy(): void
}
```

### Error Typing

Define stable, structured error metadata:

```typescript
interface ValidationError {
	readonly expected: string
	readonly path: readonly (string | number)[]
	readonly receivedType: string
	readonly receivedPreview?: string
	readonly hint?: string
	readonly helpUrl?: string
}
```

---

## Testing Standards

### Structure

- **Mirror source:** `tests/[file].test.ts` for every `src/[file].ts`
- **Integration tests:** `tests/integration/[feature].test.ts`
- One top-level `describe()` per file
- Nested `describe()` per function/feature
- Use **Vitest with Playwright** for browser testing (not jsdom or happy-dom)

### Principles

- **Deterministic:** Same inputs → same outputs
- **Fast:** Short timers (10–50ms), avoid network calls
- **No mocks in core libraries:** Use real values and small scenarios
- **Cover edge cases:** Happy path + key edge cases
- **Test public API:** Not internal implementation details

### Configuration

```typescript
// vitest.config.ts
import { mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'
import { playwright } from '@vitest/browser-playwright'

export default mergeConfig(viteConfig, {
	test: {
		include: ['tests/**/*.test.ts'],
		browser: {
			enabled: true,
			provider: playwright(),
			instances: [
				{ browser: 'chromium' },
			],
		},
		setupFiles: ['./tests/setup.ts'],
	},
})
```

### Test Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { myFunction } from '../src/module.js'

describe('module', () => {
	describe('myFunction', () => {
		it('handles expected input', () => {
			expect(myFunction('input')).toBe('expected')
		})

		it('returns false for invalid input', () => {
			expect(myFunction(null as unknown)).toBe(false)
		})
	})
})
```

### Test Placeholder Policy

- **Never skip tests or create placeholder tests that pass**
- Use `it.todo('descriptive test case')` for unimplemented tests
- Convert todos to real tests when implementing logic
- Search for remaining `it.todo()` before completing a feature

### Test Utilities

```typescript
// tests/setup.ts
export function createMockElement(): HTMLElement {
	const el = document.createElement('div')
	el.id = 'test'
	return el
}
```

---

## Documentation Standards

### TSDoc Policy

| Target                            | Requirement                                                           |
|-----------------------------------|-----------------------------------------------------------------------|
| Public exported classes/functions | Full TSDoc: description, `@param`, `@returns`, `@example`, `@remarks` |
| Simple getters/setters            | Concise description and `@returns`                                    |
| Private methods                   | Single-line comment                                                   |
| Types and interfaces              | Concise single-line comments                                          |

### Full TSDoc Example

`````typescript
/**
 * Validates an object against a shape of property guards.
 *
 * @param props - Mapping of property names to guard functions
 * @param options - Optional configuration
 * @remarks
 * Properties on `options`:
 * - `optional` — readonly array of keys that may be missing
 * - `exact` — boolean; when true, additional keys are disallowed
 * @returns A guard function that validates objects matching `props`
 * @example
 * ```ts
 * const isUser = objectOf({ name: isString, age: isNumber })
 * isUser({ name: 'Alice', age: 30 }) // true
 * ```
 */
export function objectOf<T>(
	props: { readonly [K in keyof T]: Guard<T[K]> },
	options?: ObjectOptions
): Guard<T> {
	// Implementation
}
`````

### Documentation Rules

- Do not include type annotations in JSDoc; rely on TypeScript types
- Keep examples copy-pasteable
- Use `ts` fences for code examples
- When wrapping TSDoc examples that contain backticks, use at least 5 backticks for the outer fence
- Avoid leaking secrets or large payloads in previews
- For options objects, list fields under `@remarks` (TSDoc doesn't support dotted `@param`)

---

## Symbol Preservation Protocol

### Core Principle

**NEVER remove a symbol to satisfy a linter or reduce warnings.**

Unused parameters, fields, and methods were created for a reason. The correct response is to **implement them**, not delete them.

### When Encountering Unused Symbols

1. **STOP** — Do not remove it
2. **THINK** — Why was this created? What was the original intent?
3. **SEARCH** — Check `types.ts` and related interfaces
4. **IMPLEMENT** — Wire up the symbol to fulfill its purpose
5. **DOCUMENT** — If implementation is blocked, add a descriptive TODO comment

### Protection Strategies

**Layer 1: Type System Enforcement**
```typescript
// Interface fields CANNOT be removed from implementations
export interface SessionState {
	readonly userId: string
	readonly tenantId?: string  // Implementations MUST include this
}
```

**Layer 2: Descriptive TODO Comments**

When a symbol cannot be implemented yet, use a clear TODO comment explaining:
- **What** the symbol is for
- **Why** it's not implemented yet
- **When** it should be revisited

```typescript
function createSession(userId: string, tenantId?: string): SessionInterface {
	// TODO: [Multi-tenant Auth] Implement tenantId parameter for tenant isolation
	// Reserved for multi-tenant auth feature (see PLAN.md Phase 4)
	// Should store tenantId in session and use for permission scoping
	return { id: crypto.randomUUID(), userId }
}

interface DatabaseOptions {
	readonly name: string
	// TODO: [Encryption] Add encryption key support for encrypted storage
	// Will be implemented when IndexedDB encryption feature is added
	readonly encryptionKey?: string
}
```

### TODO Comment Format

```typescript
// TODO: [Feature/Context] Brief description of intended purpose
// Additional context: when to implement, dependencies, related issues
```

### Decision Tree

```
Unused symbol detected
│
├─ Is it defined in types.ts?
│  ├─ YES → Implement it
│  └─ NO → Continue
│
├─ Does it have a TODO comment explaining its purpose?
│  ├─ YES → Preserve it, check if ready to implement
│  └─ NO → Continue
│
├─ Can you determine original intent from context?
│  ├─ YES → Implement it
│  └─ NO → Continue
│
└─ After exhausting all options:
   └─ Add TODO comment explaining purpose and asking for clarification
```

---

## Quality Gates

### Commands (Must Pass Before Commit)

```powershell
npm run check    # Typecheck (no emit)
npm run format   # Lint and autofix
npm run build    # Build library
npm test         # Unit tests
```

### Pre-Commit Checklist

- [ ] Types defined in `src/types.ts` before implementation
- [ ] Interfaces use `Interface` suffix for behavioral contracts
- [ ] Implementation classes use clean names (no suffix)
- [ ] Method names follow canonical prefix taxonomy
- [ ] No `any`, no `!`, no unsafe `as`
- [ ] ESM imports use `.js` extensions
- [ ] Public exports have full TSDoc
- [ ] Tests mirror source structure
- [ ] Barrel exports updated in `src/index.ts`
- [ ] No symbols removed to satisfy linter warnings
- [ ] `npm run check` passes
- [ ] `npm run format` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `npm run show` sandbox/showcase generated to commit (if applicable)

---

## Agent Behavior Guidelines

### Before Coding

1. Run setup steps in `.github/workflows/copilot-setup-steps.yml` if present
2. Run `npm run check`, `npm test`, `npm run build`, `npm run format`
3. Read `PLAN.md` and active phase file if present
4. Install Playwright browsers: `npx playwright install --with-deps chromium`

### When Generating Code

- Start with types in `src/types.ts` before implementing logic
- Use System Hooks Pattern for stateful systems
- Add and update mirrored tests alongside implementation
- Respect strict typing: no `any`, no `!`, no unsafe `as`
- Keep ESM-only imports/exports with `.js` extensions
- Follow TSDoc policy with `ts` examples (use 5+ backticks for nested code blocks)
- Use `it.todo()` for unimplemented tests
- Follow canonical prefix taxonomy for method names
- Organize methods in standard order
- Use Playwright for browser tests
- Use `get` for optional lookups (returns undefined), `resolve` for required (throws)
- Use `all()` instead of `getAll()` for bulk retrieval
- Methods that accept single values should also accept arrays (no separate batch methods)
- Use `close()` for connections, `drop()` for tables, `destroy()` for entire resources

### Symbol Preservation

- **NEVER** remove parameters, fields, or methods to satisfy linters
- **ALWAYS** implement unused symbols or add descriptive TODO comments
- **CHECK** `types.ts` for contracts before claiming something is unused
- **SEARCH** for original intent before removing any symbol
- **ASK** for clarification if intent is unclear

### Extraction Discipline

- **NEVER** define types, interfaces, or type aliases in implementation files
- **ALWAYS** extract types to `src/types.ts`, even if only used in one file
- **ALWAYS** extract helper functions to `src/helpers.ts`
- **ALWAYS** extract constants to `src/constants.ts`
- Implementation files (`src/core/[domain].ts`) contain ONLY class implementations

### Communication Style

- Write in clear, technical English with precision over verbosity
- Provide actionable code with brief explanations
- Keep responses concise
- ✅ Short summary in chat
- ❌ No markdown summary files
- ❌ No lengthy documentation unless necessary
- Use PowerShell syntax in terminal examples
- Use Windows paths with backslashes

### TODO Comments

Leave TODO comments for:
- Stale/legacy code needing removal
- Code left to avoid breaking tests
- Code necessary to revisit later

---

## Pre-Implementation Protocol

**BEFORE writing any implementation code, complete these steps IN ORDER:**

### Step 1: Orientation (Required)

```
Read: PLAN.md
Read: phases/[current-phase].md
Confirm: Which deliverable am I working on?
Confirm: What is the acceptance criteria?
```

### Step 2: Context Gathering (Required)

```
Check: src/types.ts — What interfaces exist?
Check: Related tests — What behavior is already specified?
Check: src/factories.ts — What factory functions exist?
```

### Step 3: Approach Proposal (Required for new features)

Before implementing, state:

1. **Deliverable:** Which item from the phase file
2. **Approach:** How I plan to implement it (2-3 sentences)
3. **Files affected:** List of files I'll create or modify
4. **Risks:** Anything that might not work or need revision

Wait for approval before proceeding.

### Step 4: Implementation

Only after Steps 1-3, begin coding:

1. Types first (if new interfaces needed)
2. Implementation second
3. Tests third
4. Update phase file checklist

### Step 5: Checkpoint

After completing a deliverable:

```powershell
npm run check; npm run format; npm test
```

If all pass, update the phase file:
- Mark deliverable ✅ Done
- Update "Current Focus" to next item
- Note any blockers discovered

---

## Plan Adherence Protocol

### Reading Plans

When starting a session or task:

1. **Always read `PLAN.md` first** — Understand the project scope
2. **Always read the active phase file** — Understand current focus
3. **Never implement beyond current phase** — Stay focused
4. **Never modify PLAN.md without explicit request** — It's sacred

### Updating Phase Files

You MUST update the phase file when:

- Completing a checklist item → Mark with `[x]`
- Completing a deliverable → Change status to `✅ Done`
- Discovering a blocker → Add to "Blocked By" section
- Finding an issue → Add to "Notes" section

You MUST NOT:

- Skip ahead to future deliverables
- Mark items complete before tests pass
- Remove items from the checklist
- Change acceptance criteria

### Scope Control

**If asked to do something outside the current phase:**

1. Acknowledge the request
2. Note that it's outside current phase scope
3. Ask: "Should I add this to a future phase, or pause current work to address it?"
4. Wait for direction

**If you notice something that SHOULD be done but isn't in the plan:**

1. Complete current task first
2. Note the observation
3. Suggest adding to "Open Questions" in PLAN.md
4. Do not implement without approval

### Context Recovery

If you lose track of where we are:

1. Ask: "Can you confirm which deliverable we're working on?"
2. Or state: "I'll re-read the phase file to get oriented."
3. Then summarize: "We're on Phase X, Deliverable Y, specifically working on Z."

---

## File Update Protocol

### When Updating Phase Files

Show the exact changes using diff format:

```diff
 | # | Deliverable | Status | Assignee |
 |---|-------------|--------|----------|
 | 2.1 | EngineInterface | ✅ Done | — |
-| 2.2 | Engine implementation | 🔄 Active | — |
+| 2.2 | Engine implementation | ✅ Done | — |
-| 2.3 | SessionInterface | ⏳ Pending | — |
+| 2.3 | SessionInterface | 🔄 Active | — |
```

### When Updating Checklists

Be explicit about what changed:

```markdown
Updated checklist in phases/02-core-api.md:
- [x] Implement `createSession` — stores in internal Map ← NEWLY CHECKED
- [x] Implement `destroySession` — removes and calls session.destroy() ← NEWLY CHECKED
```

### Never Silently Update

Always show:
1. Which file you're updating
2. What specifically changed
3. Why (which task completed)

---

## Conversation Patterns

### Starting a Session

Always begin with:

```
I'm starting work on [project]. Let me read the plan files first.

[After reading]

Current status:
- Phase: 2 of 4 (Core API)
- Active deliverable: 2.2 Engine implementation
- Checklist progress: 2/7 items complete
- Next task: Implement createSession method

Ready to proceed with createSession. My approach:
1. Add private #sessions Map<string, SessionInterface>
2. Implement createSession to instantiate and store
3. Return the session instance

Files affected:
- src/core/engine/Engine.ts (modify)

Should I proceed?
```

### Mid-Task Check-In

If the conversation is long:

```
Quick checkpoint before continuing:

We're implementing: Engine.createSession
Progress: Method implemented, need to add to subscription wiring
Remaining: destroySession, start/stop, destroy, subscriptions

Continuing with destroySession next. Correct?
```

### Completing a Deliverable

```
Deliverable 2.2 complete. Summary:

Files created/modified:
- src/core/engine/Engine.ts ✅

Tests passing:
- tests/core/engine/Engine.test.ts ✅ (12 tests)

Quality gates:
- npm run check ✅
- npm run format ✅
- npm run test ✅

Updating phase file:
- Marking 2.2 as ✅ Done
- Moving "Current Focus" to 2.3 SessionInterface

Ready to proceed with 2.3?
```

---

## Project Configuration Template

When creating project-specific instructions, add this section:

```markdown
# Project-Specific Configuration

## Project Profile

| Field              | Value                                         |
|--------------------|-----------------------------------------------|
| **Package name**   | `@scope/package-name`                         |
| **Environment**    | `browser` / `node` / `isomorphic`             |
| **Type**           | `library` / `application` / `cli`             |
| **Focus**          | Brief description of primary purpose          |
| **Sandbox folder** | `docs/` / `game/` / `examples/` / `showcase/` |

## Environment-Specific Rules

<!-- Add environment-specific patterns here -->

## Domain-Specific Patterns

<!-- Add domain-specific patterns here -->

## Error Codes

<!-- Add project-specific error codes here -->

## Package Scripts

<!-- Add project-specific scripts here -->
```

---

## Appendix: ESLint Configuration

```typescript
// eslint.config.ts
import tseslint from 'typescript-eslint'
import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import type { Linter } from 'eslint'

const formattingRules: Linter.RulesRecord = {
	'indent': ['error', 'tab', { SwitchCase: 1 }],
	'quotes': ['error', 'single', { avoidEscape: true }],
	'semi': ['error', 'never'],
	'comma-dangle': ['error', 'always-multiline'],
	'no-trailing-spaces': 'error',
	'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
	'eol-last': ['error', 'always'],
	'object-curly-spacing': ['error', 'always'],
	'array-bracket-spacing': ['error', 'never'],
	'space-before-function-paren': ['error', 'never'],
	'keyword-spacing': ['error', { before: true, after: true }],
	'space-infix-ops': 'error',
	'arrow-spacing': ['error', { before: true, after: true }],
	'no-case-declarations': 'off',
}

export default defineConfig(
	{ ignores: ['dist/**', 'node_modules/**'] },
	eslint.configs.recommended,
	tseslint.configs.recommendedTypeChecked,
	tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			parserOptions: { projectService: true },
		},
	},
	{
		files: ['**/types.ts', '**/*.d.ts'],
		rules: {
			...formattingRules,
			'@typescript-eslint/no-unused-vars': 'off',
		},
	},
	{
		files: ['**/*.ts'],
		ignores: ['**/types.ts', '**/*.d.ts'],
		rules: {
			...formattingRules,
			'@typescript-eslint/no-unused-vars': ['error', {
				varsIgnorePattern: '^_',
				argsIgnorePattern: '^_',
				ignoreRestSiblings: true,
			}],
			'no-console': 'warn',
			'no-debugger': 'error',
			'no-var': 'error',
			'prefer-const': 'error',
		},
	},
	{
		files: ['tests/**/*.ts'],
		rules: {
			'@typescript-eslint/no-empty-function': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
		},
	},
)
```

---

## Gotchas and Tips

| Topic      | Tip                                                                  |
|------------|----------------------------------------------------------------------|
| ESM        | Avoid CommonJS patterns; use `import`/`export` with `.js` extensions |
| Paths      | Use Windows examples with backslashes in docs                        |
| Numbers    | Be explicit about semantics (`+0 !== -0`, `NaN === NaN`)             |
| Config     | Import and extend reusable config builders; don't duplicate          |
| Playwright | Always install browsers in `copilot-setup-steps.yml`                 |

---

## Code of Conduct

Be kind. Assume good intent. Discuss ideas, not people.

---

**End of Universal TypeScript Development Instructions**
