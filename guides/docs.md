# IndexedDB API Complete Reference

This document is a comprehensive reference for the IndexedDB API, compiled from official MDN documentation. IndexedDB is a low-level API for client-side storage of significant amounts of structured data, including files and blobs.

---

## Table of Contents

1. [Overview](#overview)
2. [IDBFactory](#idbfactory)
3. [IDBDatabase](#idbdatabase)
4. [IDBObjectStore](#idbobjectstore)
5. [IDBIndex](#idbindex)
6. [IDBKeyRange](#idbkeyrange)
7. [IDBCursor](#idbcursor)
8. [IDBCursorWithValue](#idbcursorwithvalue)
9. [IDBRequest](#idbrequest)
10. [IDBOpenDBRequest](#idbopendbrequest)
11. [IDBTransaction](#idbtransaction)
12. [IDBVersionChangeEvent](#idbversionchangeevent)

---

## Overview

IndexedDB is a transactional database system for client-side storage. It uses indexes to enable high-performance searches. Key concepts:

- **Database**: The top-level container for all data
- **Object Store**: Storage for records (like a table)
- **Index**: Alternative lookup keys for records
- **Transaction**: All data access happens within transactions
- **Cursor**: Mechanism for iterating over records
- **Key Range**: Defines bounds for record retrieval

Everything in IndexedDB happens in the context of a **transaction**. All objects (object stores, indexes, cursors) are tied to a particular transaction.

---

## IDBFactory

The `IDBFactory` interface lets applications asynchronously access indexed databases. The object that implements the interface is `window.indexedDB`.

### Methods

#### `open(name, version?)`

Requests opening a connection to a database.

**Parameters:**
- `name`: The name of the database
- `version` (optional): The version to open the database with

**Returns:** `IDBOpenDBRequest`

**Events triggered:**
- `success`: Database opened successfully
- `error`: Failed to open
- `upgradeneeded`: New version needed
- `blocked`: Open connection blocking upgrade

**Example:**
```js
const request = window.indexedDB.open("toDoList", 4);

request.onerror = (event) => {
  console.error("Error loading database.");
};

request.onsuccess = (event) => {
  const db = request.result;
  console.log("Database initialized.");
};

request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const objectStore = db.createObjectStore("toDoList", { keyPath: "taskTitle" });
  objectStore.createIndex("hours", "hours", { unique: false });
};
```

#### `deleteDatabase(name)`

Requests deletion of a database.

**Parameters:**
- `name`: The name of the database to delete

**Returns:** `IDBOpenDBRequest`

**Notes:**
- Attempting to delete a non-existent database does not throw an exception
- Open connections receive a `versionchange` event

**Example:**
```js
const DBDeleteRequest = window.indexedDB.deleteDatabase("toDoList");

DBDeleteRequest.onerror = (event) => {
  console.error("Error deleting database.");
};

DBDeleteRequest.onsuccess = (event) => {
  console.log("Database deleted successfully");
};
```

#### `databases()`

Returns a Promise with an array of all available databases.

**Returns:** `Promise<Array<{name: string, version: number}>>`

**Example:**
```js
async function getDb() {
  const databases = await indexedDB.databases();
  databases.forEach((element) => {
    console.log(`name: ${element.name}, version: ${element.version}`);
  });
}
```

#### `cmp(first, second)`

Compares two keys and returns a result indicating which one is greater.

**Parameters:**
- `first`: The first key to compare
- `second`: The second key to compare

**Returns:**
- `-1`: First key is less than second
- `0`: Keys are equal
- `1`: First key is greater than second

**Note:** Only use for valid IndexedDB keys (not booleans, objects, etc.)

---

## IDBDatabase

The `IDBDatabase` interface provides a connection to a database. It's the only way to get and manage versions of the database.

### Properties

| Property           | Type            | Description                                            |
|--------------------|-----------------|--------------------------------------------------------|
| `name`             | `string`        | The name of the connected database                     |
| `version`          | `number`        | The version of the connected database (64-bit integer) |
| `objectStoreNames` | `DOMStringList` | List of object store names in the database             |

### Methods

#### `close()`

Closes the connection to the database immediately.

**Notes:**
- Connection is not actually closed until all transactions complete
- No new transactions can be created after calling close()

#### `createObjectStore(name, options?)`

Creates and returns a new object store. **Only callable within a `versionchange` transaction.**

**Parameters:**
- `name`: Name of the new object store
- `options` (optional):
  - `keyPath`: The key path for the object store
  - `autoIncrement`: If `true`, object store has a key generator

**Returns:** `IDBObjectStore`

**Exceptions:**
- `ConstraintError`: Object store with name already exists
- `InvalidAccessError`: `autoIncrement` is true with empty string or array keyPath
- `InvalidStateError`: Not called from versionchange transaction
- `SyntaxError`: Invalid keyPath

**Example:**
```js
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const objectStore = db.createObjectStore("toDoList", { keyPath: "taskTitle" });
  objectStore.createIndex("hours", "hours", { unique: false });
};
```

#### `deleteObjectStore(name)`

Destroys the object store with the given name. **Only callable within a `versionchange` transaction.**

**Parameters:**
- `name`: Name of the object store to delete

**Exceptions:**
- `InvalidStateError`: Not called from versionchange transaction
- `NotFoundError`: Object store does not exist

#### `transaction(storeNames, mode?, options?)`

Creates and returns a transaction object.

**Parameters:**
- `storeNames`: Array of object store names (or single string)
- `mode` (optional): `"readonly"` (default), `"readwrite"`, or `"readwriteflush"` (non-standard)
- `options` (optional):
  - `durability`: `"strict"`, `"relaxed"`, or `"default"`

**Returns:** `IDBTransaction`

**Exceptions:**
- `InvalidStateError`: `close()` has been called
- `NotFoundError`: Object store doesn't exist
- `TypeError`: Invalid mode
- `InvalidAccessError`: Empty store names list

**Example:**
```js
const transaction = db.transaction(["toDoList"], "readwrite");
const objectStore = transaction.objectStore("toDoList");
```

### Events

| Event           | Description                                   |
|-----------------|-----------------------------------------------|
| `close`         | Database connection unexpectedly closed       |
| `versionchange` | Database structure change requested elsewhere |

---

## IDBObjectStore

The `IDBObjectStore` interface represents an object store in a database. Records are sorted by keys for fast insertion, lookup, and ordered retrieval.

### Properties

| Property        | Type             | Description                                              |
|-----------------|------------------|----------------------------------------------------------|
| `name`          | `string`         | Name of the object store                                 |
| `keyPath`       | `any`            | Key path of this object store (null if out-of-line keys) |
| `indexNames`    | `DOMStringList`  | List of index names                                      |
| `transaction`   | `IDBTransaction` | The transaction this store belongs to                    |
| `autoIncrement` | `boolean`        | Whether the store auto-increments keys                   |

### Methods

#### `add(value, key?)`

Adds a new record. Throws error if key already exists.

**Parameters:**
- `value`: The value to store
- `key` (optional): The key to use (for out-of-line keys)

**Returns:** `IDBRequest`

**Exceptions:**
- `ReadOnlyError`: Read-only transaction
- `TransactionInactiveError`: Transaction is inactive
- `DataError`: Key issues
- `InvalidStateError`: Store deleted
- `DataCloneError`: Value cannot be cloned
- `ConstraintError`: Key already exists

#### `put(value, key?)`

Updates an existing record or inserts a new one.

**Parameters:**
- `value`: The value to store
- `key` (optional): The key to use

**Returns:** `IDBRequest`

**Notes:** Same exceptions as `add()`, but no `ConstraintError` for existing keys

#### `get(key)`

Retrieves a record by key.

**Parameters:**
- `key`: Key or `IDBKeyRange` identifying the record

**Returns:** `IDBRequest` (result is the value or undefined)

**Note:** Returns same result for non-existent record and record with undefined value. Use `openCursor()` to distinguish.

#### `getKey(key)`

Retrieves the key of a record.

**Parameters:**
- `key`: Key or `IDBKeyRange`

**Returns:** `IDBRequest` (result is the key)

#### `getAll(query?, count?)`

Retrieves all records matching the query.

**Parameters:**
- `query` (optional): Key or `IDBKeyRange`
- `count` (optional): Maximum records to return

Can also accept an options object with `query`, `count`, and `direction` properties.

**Returns:** `IDBRequest` (result is an array of values)

#### `getAllKeys(query?, count?)`

Retrieves all keys matching the query.

**Parameters:** Same as `getAll()`

**Returns:** `IDBRequest` (result is an array of keys)

#### `getAllRecords(options?)` (Experimental)

Retrieves all records including keys, primary keys, and values.

**Parameters:**
- `options` (optional):
  - `query`: Key or `IDBKeyRange`
  - `count`: Maximum records
  - `direction`: `"next"`, `"nextunique"`, `"prev"`, `"prevunique"`

**Returns:** `IDBRequest` (result is array of `{key, primaryKey, value}` objects)

#### `count(query?)`

Returns the count of records matching the query.

**Parameters:**
- `query` (optional): Key or `IDBKeyRange`

**Returns:** `IDBRequest` (result is a number)

#### `delete(key)`

Deletes records matching the key.

**Parameters:**
- `key`: Key or `IDBKeyRange`

**Returns:** `IDBRequest` (result is undefined)

#### `clear()`

Deletes all records in the store.

**Returns:** `IDBRequest` (result is undefined)

#### `openCursor(query?, direction?)`

Opens a cursor to iterate over records.

**Parameters:**
- `query` (optional): Key or `IDBKeyRange`
- `direction` (optional): `"next"`, `"nextunique"`, `"prev"`, `"prevunique"`

**Returns:** `IDBRequest` (result is `IDBCursorWithValue` or null)

#### `openKeyCursor(query?, direction?)`

Opens a cursor to iterate over keys only.

**Returns:** `IDBRequest` (result is `IDBCursor` or null)

#### `index(name)`

Opens a named index.

**Parameters:**
- `name`: Name of the index

**Returns:** `IDBIndex`

#### `createIndex(indexName, keyPath, options?)`

Creates a new index. **Only callable within versionchange transaction.**

**Parameters:**
- `indexName`: Name of the index
- `keyPath`: Key path for the index
- `options` (optional):
  - `unique`: If true, no duplicate values allowed
  - `multiEntry`: If true, creates entry for each array element

**Returns:** `IDBIndex`

#### `deleteIndex(indexName)`

Deletes an index. **Only callable within versionchange transaction.**

**Parameters:**
- `indexName`: Name of the index to delete

---

## IDBIndex

The `IDBIndex` interface provides asynchronous access to an index. An index is used for looking up records using properties other than the primary key.

### Properties

| Property       | Type             | Description                            |
|----------------|------------------|----------------------------------------|
| `name`         | `string`         | Name of the index                      |
| `objectStore`  | `IDBObjectStore` | The object store this index references |
| `keyPath`      | `any`            | Key path of the index                  |
| `multiEntry`   | `boolean`        | If true, one entry per array element   |
| `unique`       | `boolean`        | If true, no duplicate values allowed   |
| `isAutoLocale` | `boolean`        | (Deprecated) Whether locale is auto    |
| `locale`       | `string`         | (Deprecated) The index locale          |

### Methods

All methods work similarly to `IDBObjectStore` but operate on the index:

- `get(key)`: Get value by index key
- `getKey(key)`: Get primary key by index key
- `getAll(query?, count?)`: Get all values
- `getAllKeys(query?, count?)`: Get all primary keys
- `getAllRecords(options?)`: Get all records (experimental)
- `count(query?)`: Count matching records
- `openCursor(query?, direction?)`: Open value cursor
- `openKeyCursor(query?, direction?)`: Open key-only cursor

---

## IDBKeyRange

The `IDBKeyRange` interface represents a continuous interval over keys. Used for querying records.

### Properties

| Property    | Type      | Description                     |
|-------------|-----------|---------------------------------|
| `lower`     | `any`     | Lower bound of the range        |
| `upper`     | `any`     | Upper bound of the range        |
| `lowerOpen` | `boolean` | True if lower bound is excluded |
| `upperOpen` | `boolean` | True if upper bound is excluded |

### Static Methods

#### `IDBKeyRange.only(value)`

Creates a range containing a single value.

```js
const range = IDBKeyRange.only("A");
```

#### `IDBKeyRange.lowerBound(lower, open?)`

Creates a range with only a lower bound.

```js
// All keys >= "F"
const range = IDBKeyRange.lowerBound("F");
// All keys > "F"
const range = IDBKeyRange.lowerBound("F", true);
```

#### `IDBKeyRange.upperBound(upper, open?)`

Creates a range with only an upper bound.

```js
// All keys <= "F"
const range = IDBKeyRange.upperBound("F");
// All keys < "F"
const range = IDBKeyRange.upperBound("F", true);
```

#### `IDBKeyRange.bound(lower, upper, lowerOpen?, upperOpen?)`

Creates a range with both bounds.

```js
// All keys >= "A" && <= "F"
const range = IDBKeyRange.bound("A", "F");
// All keys > "A" && < "F"
const range = IDBKeyRange.bound("A", "F", true, true);
```

### Instance Methods

#### `includes(key)`

Returns true if the key is within the range.

```js
const range = IDBKeyRange.bound("A", "K");
range.includes("F"); // true
range.includes("W"); // false
```

---

## IDBCursor

The `IDBCursor` interface represents a cursor for traversing or iterating over multiple records in a database.

### Properties

| Property     | Type                         | Description                         |
|--------------|------------------------------|-------------------------------------|
| `source`     | `IDBObjectStore \| IDBIndex` | The source being iterated           |
| `direction`  | `string`                     | Direction of traversal              |
| `key`        | `any`                        | Key at cursor position              |
| `primaryKey` | `any`                        | Primary key at cursor position      |
| `request`    | `IDBRequest`                 | The request that opened this cursor |

### Direction Values

- `"next"`: Ascending order, includes duplicates
- `"nextunique"`: Ascending order, excludes duplicates
- `"prev"`: Descending order, includes duplicates
- `"prevunique"`: Descending order, excludes duplicates

### Methods

#### `advance(count)`

Moves the cursor forward by a specified number of positions.

**Parameters:**
- `count`: Number of positions to advance

**Exceptions:**
- `TypeError`: If count is 0
- `InvalidStateError`: Cursor is being iterated or has finished
- `TransactionInactiveError`: Transaction is inactive

#### `continue(key?)`

Advances the cursor to the next position.

**Parameters:**
- `key` (optional): Key to advance to

**Example:**
```js
objectStore.openCursor().onsuccess = (event) => {
  const cursor = event.target.result;
  if (cursor) {
    console.log(cursor.value);
    cursor.continue();
  }
};
```

#### `continuePrimaryKey(key, primaryKey)`

Sets the cursor to a specific index key and primary key.

**Parameters:**
- `key`: The index key to set
- `primaryKey`: The primary key to set

**Notes:**
- Only available on cursors from indexes
- Direction must be `"next"` or `"prev"`

#### `delete()`

Deletes the record at the cursor's position.

**Returns:** `IDBRequest`

**Notes:**
- Cannot be used on cursors from `openKeyCursor()`
- Does not change cursor position

#### `update(value)`

Updates the record at the cursor's position.

**Parameters:**
- `value`: The new value to store

**Returns:** `IDBRequest`

**Notes:**
- Cannot be used on cursors from `openKeyCursor()`
- Cannot change primary key

---

## IDBCursorWithValue

The `IDBCursorWithValue` interface extends `IDBCursor` with a `value` property. It's returned by `openCursor()` methods.

### Additional Properties

| Property | Type  | Description                     |
|----------|-------|---------------------------------|
| `value`  | `any` | The value of the current record |

### Inheritance

Inherits all properties and methods from `IDBCursor`.

---

## IDBRequest

The `IDBRequest` interface provides access to results of asynchronous requests.

### Properties

| Property      | Type                                              | Description                                   |
|---------------|---------------------------------------------------|-----------------------------------------------|
| `result`      | `any`                                             | The result of the request (throws if pending) |
| `error`       | `DOMException \| null`                            | Error if request failed                       |
| `source`      | `IDBObjectStore \| IDBIndex \| IDBCursor \| null` | Source of the request                         |
| `transaction` | `IDBTransaction \| null`                          | Associated transaction                        |
| `readyState`  | `string`                                          | `"pending"` or `"done"`                       |

### Events

| Event     | Description                    |
|-----------|--------------------------------|
| `success` | Request completed successfully |
| `error`   | Request failed                 |

### Error Types

| Error                | Description                                |
|----------------------|--------------------------------------------|
| `AbortError`         | Transaction was aborted                    |
| `ConstraintError`    | Constraint violation (e.g., duplicate key) |
| `NotReadableError`   | Unrecoverable read failure                 |
| `QuotaExceededError` | Storage quota exceeded                     |
| `UnknownError`       | Transient read failure                     |
| `VersionError`       | Opening with version lower than current    |

---

## IDBOpenDBRequest

The `IDBOpenDBRequest` interface extends `IDBRequest` for database open/delete operations.

### Inheritance

Inherits from `IDBRequest`.

### Events

| Event           | Description                          |
|-----------------|--------------------------------------|
| `blocked`       | Open connection blocks versionchange |
| `upgradeneeded` | Version upgrade needed               |
| `success`       | Operation succeeded                  |
| `error`         | Operation failed                     |

### The Upgrade Transaction

When `upgradeneeded` fires:
- `event.target.result` contains the database
- `event.oldVersion` is the old version number
- `event.newVersion` is the new version number
- The transaction mode is `"versionchange"`

**Example:**
```js
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  
  // Handle version migrations
  if (event.oldVersion < 1) {
    db.createObjectStore("store1");
  }
  if (event.oldVersion < 2) {
    db.deleteObjectStore("store1");
    db.createObjectStore("store2");
  }
};
```

---

## IDBTransaction

The `IDBTransaction` interface provides a static, asynchronous transaction on a database.

### Properties

| Property           | Type                   | Description                                           |
|--------------------|------------------------|-------------------------------------------------------|
| `db`               | `IDBDatabase`          | The associated database connection                    |
| `durability`       | `string`               | Durability hint: `"strict"`, `"relaxed"`, `"default"` |
| `error`            | `DOMException \| null` | Error if transaction failed                           |
| `mode`             | `string`               | `"readonly"`, `"readwrite"`, or `"versionchange"`     |
| `objectStoreNames` | `DOMStringList`        | Names of object stores in scope                       |

### Transaction Modes

| Mode            | Description               |
|-----------------|---------------------------|
| `readonly`      | Read data only            |
| `readwrite`     | Read and write data       |
| `versionchange` | Modify database structure |

### Methods

#### `objectStore(name)`

Returns an object store from the transaction scope.

**Parameters:**
- `name`: Name of the object store

**Returns:** `IDBObjectStore`

#### `abort()`

Rolls back all changes made in the transaction.

**Notes:**
- All pending requests get `AbortError`
- Fires `abort` event

#### `commit()`

Commits the transaction explicitly.

**Notes:**
- Not normally needed (auto-commits when no pending requests)
- Can be used to commit early

### Events

| Event      | Description                        |
|------------|------------------------------------|
| `complete` | Transaction successfully committed |
| `abort`    | Transaction was aborted            |
| `error`    | Request error bubbled up           |

### Transaction Lifecycle

1. Transaction created → active
2. Requests made → pending
3. Request completes → success/error event
4. No more requests + all complete → auto-commit
5. Transaction complete → `complete` event

### Transaction Failures

Transactions can fail due to:
- Bad requests (duplicate keys, constraint violations)
- Explicit `abort()` call
- Uncaught exception in event handler
- I/O error
- Quota exceeded
- User agent crash

### Durability

| Level     | Description                                        |
|-----------|----------------------------------------------------|
| `strict`  | Data flushed to persistent storage before complete |
| `relaxed` | Data written to OS, not necessarily disk           |
| `default` | Browser default behavior                           |

---

## IDBVersionChangeEvent

The `IDBVersionChangeEvent` interface indicates that the database version has changed.

### Constructor

```js
new IDBVersionChangeEvent(type, options?)
```

**Parameters:**
- `type`: Event type (`"versionchange"`, `"success"`, `"blocked"`)
- `options` (optional):
  - `oldVersion`: Previous version (default: 0)
  - `newVersion`: New version (default: null for deletion)

### Properties

| Property     | Type             | Description                            |
|--------------|------------------|----------------------------------------|
| `oldVersion` | `number`         | Old version number (0 if new database) |
| `newVersion` | `number \| null` | New version (null if deleting)         |

### Usage

```js
request.onupgradeneeded = (event) => {
  console.log(`Upgrading from ${event.oldVersion} to ${event.newVersion}`);
  
  const db = event.target.result;
  // Perform migrations based on version
};
```

---

## Best Practices

### Opening a Database

```js
const DBOpenRequest = window.indexedDB.open("myDatabase", 1);

DBOpenRequest.onerror = (event) => {
  console.error("Database error:", event.target.error);
};

DBOpenRequest.onsuccess = (event) => {
  const db = event.target.result;
  // Use the database
};

DBOpenRequest.onupgradeneeded = (event) => {
  const db = event.target.result;
  // Create object stores and indexes
};
```

### Transaction Pattern

```js
function addItem(db, item) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["items"], "readwrite");
    const store = transaction.objectStore("items");
    const request = store.add(item);

    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
  });
}
```

### Cursor Iteration

```js
function getAllItems(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["items"], "readonly");
    const store = transaction.objectStore("items");
    const items = [];

    store.openCursor().onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };

    transaction.onerror = () => reject(transaction.error);
  });
}
```

### Version Migrations

```js
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  const oldVersion = event.oldVersion;

  // Version 1: Initial schema
  if (oldVersion < 1) {
    const store = db.createObjectStore("users", { keyPath: "id" });
    store.createIndex("email", "email", { unique: true });
  }

  // Version 2: Add new index
  if (oldVersion < 2) {
    const store = event.target.transaction.objectStore("users");
    store.createIndex("createdAt", "createdAt");
  }

  // Version 3: New store
  if (oldVersion < 3) {
    db.createObjectStore("settings", { keyPath: "key" });
  }
};
```

---

## Error Handling

### Request Errors

```js
request.onerror = (event) => {
  const error = event.target.error;
  console.error(`Error: ${error.name}: ${error.message}`);
  
  // Prevent error from bubbling
  event.preventDefault();
};
```

### Transaction Errors

```js
transaction.onerror = (event) => {
  console.error("Transaction error:", transaction.error);
};

transaction.onabort = (event) => {
  console.warn("Transaction aborted:", transaction.error);
};
```

### Handling Blocked Upgrades

```js
request.onblocked = (event) => {
  // Another tab has the database open
  console.warn("Database upgrade blocked. Close other tabs.");
};

// In other connections, listen for versionchange
db.onversionchange = (event) => {
  db.close();
  alert("Database is outdated. Please reload.");
};
```

---

## Summary

IndexedDB provides a powerful client-side storage solution with:

- **Transactional database**: All operations within transactions
- **Object stores**: Flexible schema with key-value storage
- **Indexes**: Fast lookups on any property
- **Cursors**: Efficient iteration over large datasets
- **Key ranges**: Flexible querying with bounds
- **Version management**: Schema migrations via upgrade transactions
- **Async API**: Non-blocking operations via events

Use IndexedDB for:
- Offline data storage
- Caching large datasets
- Client-side databases
- Storing structured data (including blobs)
