/**
 * Factory functions for creating instances
 *
 * @packageDocumentation
 */

import type {
	DatabaseSchema,
	DatabaseOptions,
	DatabaseInterface,
} from './types.js'
import { Database } from './core/Database.js'

/**
 * Creates a database connection.
 *
 * @param options - Database configuration options
 * @returns Database interface for the specified schema
 *
 * @remarks
 * The database connection opens lazily on first operation.
 * Stores are created automatically during version upgrades.
 *
 * @example
 * ```ts
 * interface User {
 *   readonly id: string
 *   readonly name: string
 *   readonly email: string
 * }
 *
 * interface AppSchema {
 *   readonly users: User
 * }
 *
 * const db = await createDatabase<AppSchema>({
 *   name: 'myApp',
 *   version: 1,
 *   stores: {
 *     users: {
 *       indexes: [
 *         { name: 'byEmail', keyPath: 'email', unique: true }
 *       ]
 *     }
 *   }
 * })
 *
 * await db.store('users').set({ id: 'u1', name: 'Alice', email: 'alice@test.com' })
 * const user = await db.store('users').get('u1')
 * ```
 */
export function createDatabase<Schema extends DatabaseSchema>(
	options: DatabaseOptions<Schema>,
): DatabaseInterface<Schema> {
	return new Database(options)
}
