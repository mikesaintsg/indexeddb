/**
 * Transactions Example
 *
 * Demonstrates:
 * - db.read() - Read-only transactions
 * - db.write() - Read-write transactions
 * - Multi-store transactions
 * - Transaction options (durability)
 * - Atomic operations
 * - Transaction abort/commit
 */

import type { DatabaseInterface } from '@mikesaintsg/indexeddb'
import type { AppSchema, ExampleResult, Post } from './types.js'
import { SAMPLE_POSTS } from './types.js'

/**
 * Demonstrates read-only transactions
 */
export async function demonstrateReadTransaction(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	let userCount = 0
	let postCount = 0
	let userName = ''

	// Read transaction - consistent view across multiple stores
	await db.read(['users', 'posts'], async(tx) => {
		const users = await tx.store('users').all()
		const posts = await tx.store('posts').all()
		userCount = users.length
		postCount = posts.length
		userName = users[0]?.name ?? 'none'
	})

	return {
		success: true,
		message: 'db.read() - Consistent reads across stores',
		data: {
			userCount,
			postCount,
			firstUser: userName,
		},
		code: `
// Read transaction - consistent view
await db.read(['users', 'posts'], async (tx) => {
  const users = await tx.store('users').all()
  const posts = await tx.store('posts').all()
  // Both reads see the same snapshot
})

// Single store reads can use store directly
const user = await db.store('users').get('u1')
`.trim(),
	}
}

/**
 * Demonstrates write transactions
 */
export async function demonstrateWriteTransaction(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	// Load posts first
	await db.store('posts').set([...SAMPLE_POSTS])

	let postId = ''
	let authorName = ''

	// Write transaction - atomic modifications
	await db.write(['users', 'posts'], async(tx) => {
		// Read user
		const user = await tx.store('users').resolve('u1')
		authorName = user.name

		// Create related post
		const newPost: Post = {
			id: 'tx-post',
			title: 'Transaction Demo Post',
			content: 'Created in a transaction',
			authorId: user.id,
			published: true,
			views: 0,
			createdAt: Date.now(),
		}
		await tx.store('posts').set(newPost)
		postId = newPost.id
	})

	// Cleanup
	await db.store('posts').remove('tx-post')

	return {
		success: true,
		message: 'db.write() - Atomic multi-store modifications',
		data: {
			createdPostId: postId,
			authorName,
		},
		code: `
// Write transaction - atomic modifications
await db.write(['users', 'posts'], async (tx) => {
  const user = await tx.store('users').resolve('u1')

  await tx.store('posts').set({
    id: crypto.randomUUID(),
    title: 'New Post',
    authorId: user.id,
    // ...
  })

  // Transaction commits on success
  // Aborts on any error (all changes rolled back)
})
`.trim(),
	}
}

/**
 * Demonstrates transaction durability options
 */
export async function demonstrateDurabilityOptions(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	// Relaxed durability - faster, may not be persisted immediately
	await db.write(['settings'], async(tx) => {
		await tx.store('settings').set({
			id: 'durability-test',
			key: 'test',
			value: 'relaxed',
			updatedAt: Date.now(),
		})
	}, { durability: 'relaxed' })

	// Cleanup
	await db.store('settings').remove('durability-test')

	return {
		success: true,
		message: 'Transaction durability options',
		data: {
			durabilityLevels: ['default', 'strict', 'relaxed'],
		},
		code: `
// Durability options control when transaction is considered complete

// 'default' - OS/browser default behavior
await db.write(['logs'], async (tx) => {
  await tx.store('logs').set(entry)
})

// 'strict' - Wait for data to be flushed to disk
await db.write(['critical'], async (tx) => {
  await tx.store('critical').set(data)
}, { durability: 'strict' })

// 'relaxed' - May return before data is flushed (faster)
await db.write(['logs'], async (tx) => {
  await tx.store('logs').set(entry)
}, { durability: 'relaxed' })
`.trim(),
	}
}

/**
 * Demonstrates transaction accessors
 */
export async function demonstrateTransactionAccessors(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	let mode = ''
	let storeNames: readonly string[] = []
	let isActive = false

	await db.read(['users', 'posts'], (tx) => {
		mode = tx.getMode()
		storeNames = tx.getStoreNames()
		isActive = tx.isActive()
	})

	return {
		success: true,
		message: 'Transaction accessor methods',
		data: {
			mode,
			storeNames,
			isActive,
		},
		code: `
await db.read(['users', 'posts'], async (tx) => {
  tx.getMode()         // 'readonly' | 'readwrite'
  tx.getStoreNames()   // ['users', 'posts']
  tx.isActive()        // true (while in operation)
  tx.isFinished()      // false (until complete/abort)
})
`.trim(),
	}
}

/**
 * Demonstrates transaction abort
 */
export async function demonstrateTransactionAbort(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	const beforeCount = await db.store('settings').count()
	let errorCaught = false

	try {
		await db.write(['settings'], async(tx) => {
			// Add a record
			await tx.store('settings').set({
				id: 'abort-test',
				key: 'abort',
				value: 'should be rolled back',
				updatedAt: Date.now(),
			})

			// Explicitly abort - all changes rolled back
			tx.abort()
		})
	} catch {
		errorCaught = true
	}

	const afterCount = await db.store('settings').count()

	return {
		success: true,
		message: 'Transaction abort - rolls back all changes',
		data: {
			beforeCount,
			afterCount,
			errorCaught,
			recordsAdded: afterCount - beforeCount,
		},
		code: `
await db.write(['users'], async (tx) => {
  await tx.store('users').set(user1)
  await tx.store('users').set(user2)

  if (someCondition) {
    tx.abort()  // Roll back ALL changes
  }
})

// Also aborts on any thrown error:
await db.write(['users'], async (tx) => {
  await tx.store('users').set(user)
  throw new Error('Something went wrong')
  // Transaction is automatically aborted
})
`.trim(),
	}
}

/**
 * Demonstrates native transaction access
 */
export async function demonstrateNativeTransactionAccess(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	let nativeMode = ''

	await db.read(['users'], (tx) => {
		const nativeTx = tx.native
		nativeMode = nativeTx.mode
	})

	return {
		success: true,
		message: 'Native IDBTransaction access',
		data: {
			nativeMode,
		},
		code: `
await db.write(['users'], async (tx) => {
  // Access native IDBTransaction
  const nativeTx = tx.native

  // Use native APIs when needed
  nativeTx.mode           // 'readonly' | 'readwrite'
  nativeTx.objectStoreNames  // DOMStringList
  nativeTx.db             // IDBDatabase
})
`.trim(),
	}
}
