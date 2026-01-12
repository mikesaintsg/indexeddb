/**
 * Integration Tests: CRUD Operations
 *
 * @remarks
 * End-to-end tests for complete CRUD workflows, testing the full API
 * in realistic scenarios.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDatabase, NotFoundError, ConstraintError } from '../../src/index.js'
import type { DatabaseSchema, ChangeEvent } from '../../src/types.js'

// ============================================================================
// Test Schema
// ============================================================================

interface User {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly status: 'active' | 'inactive' | 'pending'
	readonly createdAt: number
	readonly tags?: readonly string[]
}

interface Post {
	readonly id: string
	readonly title: string
	readonly content: string
	readonly authorId: string
	readonly published: boolean
	readonly views: number
}

interface Comment {
	readonly id: string
	readonly postId: string
	readonly authorId: string
	readonly text: string
	readonly timestamp: number
}

interface TestSchema extends DatabaseSchema {
	readonly users: User
	readonly posts: Post
	readonly comments: Comment
}

// ============================================================================
// Test Utilities
// ============================================================================

function createTestDbName(): string {
	return `test-integration-crud-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createUser(overrides: Partial<User> = {}): User {
	const uniqueId = Math.random().toString(36).slice(2)
	return {
		id: `u-${uniqueId}`,
		name: 'Test User',
		email: `test-${uniqueId}@example.com`,
		status: 'active',
		createdAt: Date.now(),
		...overrides,
	}
}

function createPost(overrides: Partial<Post> = {}): Post {
	return {
		id: `p-${Math.random().toString(36).slice(2)}`,
		title: 'Test Post',
		content: 'This is test content.',
		authorId: 'u1',
		published: false,
		views: 0,
		...overrides,
	}
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration: CRUD', () => {
	let dbName: string
	let db: ReturnType<typeof createDatabase<TestSchema>>

	beforeEach(() => {
		dbName = createTestDbName()
		db = createDatabase<TestSchema>({
			name: dbName,
			version: 1,
			stores: {
				users: {
					indexes: [
						{ name: 'byEmail', keyPath: 'email', unique: true },
						{ name: 'byStatus', keyPath: 'status' },
						{ name: 'byCreatedAt', keyPath: 'createdAt' },
					],
				},
				posts: {
					indexes: [
						{ name: 'byAuthor', keyPath: 'authorId' },
						{ name: 'byPublished', keyPath: 'published' },
					],
				},
				comments: {
					indexes: [
						{ name: 'byPost', keyPath: 'postId' },
						{ name: 'byAuthor', keyPath: 'authorId' },
					],
				},
			},
		})
	})

	afterEach(async() => {
		await db.drop()
	})

	// ─── Complete User Lifecycle ─────────────────────────────

	describe('user lifecycle', () => {
		it('create → read → update → delete', async() => {
			const user = createUser({ id: 'u1', name: 'Alice', email: 'alice@test.com' })

			// Create
			const key = await db.store('users').add(user)
			expect(key).toBe('u1')

			// Read
			const retrieved = await db.store('users').resolve('u1')
			expect(retrieved.name).toBe('Alice')
			expect(retrieved.email).toBe('alice@test.com')

			// Update
			await db.store('users').set({ ...retrieved, name: 'Alice Smith', status: 'inactive' })
			const updated = await db.store('users').get('u1')
			expect(updated?.name).toBe('Alice Smith')
			expect(updated?.status).toBe('inactive')

			// Delete
			await db.store('users').remove('u1')
			expect(await db.store('users').has('u1')).toBe(false)
			expect(await db.store('users').get('u1')).toBeUndefined()
		})

		it('resolve throws NotFoundError for missing user', async() => {
			await expect(db.store('users').resolve('nonexistent')).rejects.toThrow(NotFoundError)
		})

		it('add throws ConstraintError for duplicate', async() => {
			const user = createUser({ id: 'u1' })
			await db.store('users').add(user)

			await expect(db.store('users').add({ ...user, name: 'Different' })).rejects.toThrow(ConstraintError)
		})

		it('unique index prevents duplicate emails', async() => {
			await db.store('users').add(createUser({ id: 'u1', email: 'alice@test.com' }))

			await expect(
				db.store('users').add(createUser({ id: 'u2', email: 'alice@test.com' })),
			).rejects.toThrow(ConstraintError)
		})
	})

	// ─── Batch Operations ────────────────────────────────────

	describe('batch operations', () => {
		it('set multiple users atomically', async() => {
			const users = [
				createUser({ id: 'u1', name: 'Alice' }),
				createUser({ id: 'u2', name: 'Bob' }),
				createUser({ id: 'u3', name: 'Charlie' }),
			]

			const keys = await db.store('users').set(users)
			expect(keys).toHaveLength(3)

			const all = await db.store('users').all()
			expect(all).toHaveLength(3)
		})

		it('get multiple users returns array', async() => {
			await db.store('users').set([
				createUser({ id: 'u1', name: 'Alice' }),
				createUser({ id: 'u2', name: 'Bob' }),
			])

			const results = await db.store('users').get(['u1', 'u2', 'u3'])
			if (!Array.isArray(results)) {
				expect.fail('Expected array')
				return
			}

			expect(results).toHaveLength(3)
			expect(results[0]?.name).toBe('Alice')
			expect(results[1]?.name).toBe('Bob')
			expect(results[2]).toBeUndefined()
		})

		it('remove multiple users', async() => {
			await db.store('users').set([
				createUser({ id: 'u1' }),
				createUser({ id: 'u2' }),
				createUser({ id: 'u3' }),
			])

			await db.store('users').remove(['u1', 'u3'])

			expect(await db.store('users').has('u1')).toBe(false)
			expect(await db.store('users').has('u2')).toBe(true)
			expect(await db.store('users').has('u3')).toBe(false)
		})

		it('clear removes all records', async() => {
			await db.store('users').set([
				createUser({ id: 'u1' }),
				createUser({ id: 'u2' }),
			])

			await db.store('users').clear()

			expect(await db.store('users').count()).toBe(0)
		})
	})

	// ─── Index Queries ───────────────────────────────────────

	describe('index queries', () => {
		beforeEach(async() => {
			await db.store('users').set([
				createUser({ id: 'u1', email: 'alice@test.com', status: 'active' }),
				createUser({ id: 'u2', email: 'bob@test.com', status: 'inactive' }),
				createUser({ id: 'u3', email: 'charlie@test.com', status: 'active' }),
			])
		})

		it('lookup by unique index (email)', async() => {
			const user = await db.store('users').index('byEmail').get('bob@test.com')
			expect(user?.id).toBe('u2')
		})

		it('lookup by non-unique index (status)', async() => {
			const activeUsers = await db.store('users').index('byStatus').all(IDBKeyRange.only('active'))
			expect(activeUsers).toHaveLength(2)
		})

		it('getKey returns primary key', async() => {
			const key = await db.store('users').index('byEmail').getKey('alice@test.com')
			expect(key).toBe('u1')
		})
	})

	// ─── Query Builder ───────────────────────────────────────

	describe('query builder', () => {
		beforeEach(async() => {
			// Create 10 users with varying data
			const users: User[] = []
			for (let i = 1; i <= 10; i++) {
				users.push(createUser({
					id: `u${String(i).padStart(2, '0')}`,
					name: `User ${i}`,
					email: `user${i}@test.com`,
					status: i <= 5 ? 'active' : 'inactive',
					createdAt: Date.now() - (10 - i) * 86400000, // Days ago
				}))
			}
			await db.store('users').set(users)
		})

		it('where().equals() filters by index', async() => {
			const results = await db.store('users').query()
				.where('byStatus').equals('active')
				.toArray()

			expect(results).toHaveLength(5)
			results.forEach(u => expect(u.status).toBe('active'))
		})

		it('filter() applies post-cursor predicate', async() => {
			const results = await db.store('users').query()
				.filter(u => u.email.includes('1'))
				.toArray()

			expect(results.length).toBeGreaterThan(0)
			results.forEach(u => expect(u.email).toContain('1'))
		})

		it('limit() restricts result count', async() => {
			const results = await db.store('users').query()
				.limit(3)
				.toArray()

			expect(results).toHaveLength(3)
		})

		it('offset() skips records', async() => {
			const all = await db.store('users').query().toArray()
			const offset = await db.store('users').query().offset(5).toArray()

			expect(offset).toHaveLength(5)
			expect(offset[0]?.id).toBe(all[5]?.id)
		})

		it('pagination pattern: limit + offset', async() => {
			const pageSize = 3

			const page1 = await db.store('users').query().limit(pageSize).offset(0).toArray()
			const page2 = await db.store('users').query().limit(pageSize).offset(3).toArray()
			const page3 = await db.store('users').query().limit(pageSize).offset(6).toArray()
			const page4 = await db.store('users').query().limit(pageSize).offset(9).toArray()

			expect(page1).toHaveLength(3)
			expect(page2).toHaveLength(3)
			expect(page3).toHaveLength(3)
			expect(page4).toHaveLength(1)

			// Verify no duplicates across pages
			const allIds = [...page1, ...page2, ...page3, ...page4].map(u => u.id)
			const uniqueIds = [...new Set(allIds)]
			expect(uniqueIds).toHaveLength(10)
		})

		it('first() returns single result', async() => {
			const first = await db.store('users').query().first()
			expect(first?.id).toBe('u01')
		})

		it('count() with filter', async() => {
			const count = await db.store('users').query()
				.where('byStatus').equals('active')
				.count()

			expect(count).toBe(5)
		})

		it('combined: where + filter + limit', async() => {
			const results = await db.store('users').query()
				.where('byStatus').equals('active')
				.filter(u => u.email.includes('1'))
				.limit(2)
				.toArray()

			expect(results.length).toBeLessThanOrEqual(2)
			results.forEach(u => {
				expect(u.status).toBe('active')
				expect(u.email).toContain('1')
			})
		})
	})

	// ─── Transactions ────────────────────────────────────────

	describe('transactions', () => {
		it('multi-store atomic operation', async() => {
			const user = createUser({ id: 'u1', name: 'Alice' })
			const post = createPost({ id: 'p1', authorId: 'u1', title: 'First Post' })

			await db.write(['users', 'posts'], async(tx) => {
				await tx.store('users').set(user)
				await tx.store('posts').set(post)
			})

			const savedUser = await db.store('users').get('u1')
			const savedPost = await db.store('posts').get('p1')

			expect(savedUser?.name).toBe('Alice')
			expect(savedPost?.authorId).toBe('u1')
		})

		it('transaction rollback on error', async() => {
			await db.store('users').set(createUser({ id: 'u1', name: 'Original' }))

			await expect(db.write('users', async(tx) => {
				await tx.store('users').set(createUser({ id: 'u1', name: 'Changed' }))
				throw new Error('Abort transaction')
			})).rejects.toThrow('Abort transaction')

			// Verify rollback
			const user = await db.store('users').get('u1')
			expect(user?.name).toBe('Original')
		})

		it('read transaction provides consistent view', async() => {
			await db.store('users').set([
				createUser({ id: 'u1', name: 'Alice' }),
				createUser({ id: 'u2', name: 'Bob' }),
			])

			await db.read('users', async(tx) => {
				const u1 = await tx.store('users').get('u1')
				const u2 = await tx.store('users').get('u2')

				expect(u1?.name).toBe('Alice')
				expect(u2?.name).toBe('Bob')
			})
		})
	})

	// ─── Reactivity ──────────────────────────────────────────

	describe('reactivity', () => {
		it('change events track mutations', async() => {
			const events: ChangeEvent[] = []
			db.onChange((e) => events.push(e))

			await db.store('users').set(createUser({ id: 'u1' }))
			await db.store('users').set(createUser({ id: 'u1', name: 'Updated' }))
			await db.store('users').remove('u1')

			expect(events).toHaveLength(3)
			expect(events[0]?.type).toBe('set')
			expect(events[1]?.type).toBe('set')
			expect(events[2]?.type).toBe('remove')
		})

		it('store-level subscription', async() => {
			const userEvents: ChangeEvent[] = []
			db.store('users').onChange((e) => userEvents.push(e))

			await db.store('posts').set(createPost({ id: 'p1' }))
			await db.store('users').set(createUser({ id: 'u1' }))

			expect(userEvents).toHaveLength(1)
			expect(userEvents[0]?.storeName).toBe('users')
		})

		it('unsubscribe stops events', async() => {
			const events: ChangeEvent[] = []
			const unsubscribe = db.onChange((e) => events.push(e))

			await db.store('users').set(createUser({ id: 'u1' }))
			unsubscribe()
			await db.store('users').set(createUser({ id: 'u2' }))

			expect(events).toHaveLength(1)
		})
	})

	// ─── Cursor Iteration ────────────────────────────────────

	describe('cursor iteration', () => {
		beforeEach(async() => {
			await db.store('users').set([
				createUser({ id: 'u1', name: 'Alice' }),
				createUser({ id: 'u2', name: 'Bob' }),
				createUser({ id: 'u3', name: 'Charlie' }),
			])
		})

		it('iterate() yields all records', async() => {
			const names: string[] = []
			for await (const user of db.store('users').iterate()) {
				names.push(user.name)
			}

			expect(names).toEqual(['Alice', 'Bob', 'Charlie'])
		})

		it('iterate() with direction', async() => {
			const names: string[] = []
			for await (const user of db.store('users').iterate({ direction: 'previous' })) {
				names.push(user.name)
			}

			expect(names).toEqual(['Charlie', 'Bob', 'Alice'])
		})

		it('iterateKeys() yields only keys', async() => {
			const keys: string[] = []
			for await (const key of db.store('users').iterateKeys()) {
				keys.push(key as string)
			}

			expect(keys).toEqual(['u1', 'u2', 'u3'])
		})

		it('early break from iteration', async() => {
			const names: string[] = []
			for await (const user of db.store('users').iterate()) {
				names.push(user.name)
				if (names.length === 2) break
			}

			expect(names).toHaveLength(2)
		})
	})

	// ─── Complex Scenarios ───────────────────────────────────

	describe('complex scenarios', () => {
		it('blog post with author and comments', async() => {
			// Create author
			const author = createUser({ id: 'author1', name: 'Alice', email: 'alice@blog.com' })
			await db.store('users').add(author)

			// Create post
			const post = createPost({
				id: 'post1',
				title: 'My First Blog Post',
				content: 'Hello world!',
				authorId: 'author1',
				published: true,
			})
			await db.store('posts').add(post)

			// Create comments
			await db.store('comments').set([
				{ id: 'c1', postId: 'post1', authorId: 'user1', text: 'Great post!', timestamp: Date.now() },
				{ id: 'c2', postId: 'post1', authorId: 'user2', text: 'Thanks for sharing', timestamp: Date.now() },
			])

			// Query: Get post with author
			const savedPost = await db.store('posts').resolve('post1')
			const postAuthor = await db.store('users').resolve(savedPost.authorId)

			expect(postAuthor.name).toBe('Alice')

			// Query: Get all comments for post
			const comments = await db.store('comments').index('byPost').all(IDBKeyRange.only('post1'))
			expect(comments).toHaveLength(2)
		})

		it('user activity feed', async() => {
			// Create users
			await db.store('users').set([
				createUser({ id: 'u1', name: 'Alice' }),
				createUser({ id: 'u2', name: 'Bob' }),
			])

			// Create multiple posts
			const posts = [
				createPost({ id: 'p1', authorId: 'u1', title: 'Post 1', published: true, views: 100 }),
				createPost({ id: 'p2', authorId: 'u1', title: 'Post 2', published: true, views: 50 }),
				createPost({ id: 'p3', authorId: 'u2', title: 'Post 3', published: true, views: 200 }),
				createPost({ id: 'p4', authorId: 'u1', title: 'Draft', published: false, views: 0 }),
			]
			await db.store('posts').set(posts)

			// Get Alice's published posts
			const alicePosts = await db.store('posts').query()
				.where('byAuthor').equals('u1')
				.filter(p => p.published)
				.toArray()

			expect(alicePosts).toHaveLength(2)

			// Get all published posts sorted by views (descending)
			// Note: Boolean index with equals() has limitations in IDB,
			// so we use filter for more reliable results
			const publishedPosts = await db.store('posts').query()
				.filter(p => p.published)
				.toArray()

			const sortedByViews = [...publishedPosts].sort((a, b) => b.views - a.views)
			expect(sortedByViews[0]?.title).toBe('Post 3')
		})
	})
})
