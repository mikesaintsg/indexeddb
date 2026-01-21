/**
 * Shared types and utilities for showcase examples
 */

import type { DatabaseSchema, ChangeEvent } from '@mikesaintsg/indexeddb'

// ============================================================================
// Schema Definition
// ============================================================================

export interface User {
	readonly id: string
	readonly name: string
	readonly email: string
	readonly age: number
	readonly status: 'active' | 'inactive'
	readonly role: 'admin' | 'user' | 'guest'
	readonly tags: readonly string[]
	readonly createdAt: number
}

export interface Post {
	readonly id: string
	readonly title: string
	readonly content: string
	readonly authorId: string
	readonly published: boolean
	readonly views: number
	readonly createdAt: number
}

export interface Setting {
	readonly id: string
	readonly key: string
	readonly value: string
	readonly updatedAt: number
}

export interface AppSchema extends DatabaseSchema {
	readonly users: User
	readonly posts: Post
	readonly settings: Setting
}

// ============================================================================
// Sample Data
// ============================================================================

export const SAMPLE_USERS: readonly User[] = [
	{ id: 'u1', name: 'Alice Johnson', email: 'alice@example.com', age: 28, status: 'active', role: 'admin', tags: ['developer', 'leader'], createdAt: Date.now() - 86400000 * 30 },
	{ id: 'u2', name: 'Bob Smith', email: 'bob@example.com', age: 35, status: 'active', role: 'user', tags: ['developer'], createdAt: Date.now() - 86400000 * 20 },
	{ id: 'u3', name: 'Carol White', email: 'carol@example.com', age: 42, status: 'inactive', role: 'user', tags: ['designer'], createdAt: Date.now() - 86400000 * 15 },
	{ id: 'u4', name: 'David Brown', email: 'david@example.com', age: 25, status: 'active', role: 'guest', tags: ['intern'], createdAt: Date.now() - 86400000 * 10 },
	{ id: 'u5', name: 'Eva Green', email: 'eva@example.com', age: 31, status: 'active', role: 'user', tags: ['developer', 'tester'], createdAt: Date.now() - 86400000 * 5 },
]

export const SAMPLE_POSTS: readonly Post[] = [
	{ id: 'p1', title: 'Getting Started with IndexedDB', content: 'IndexedDB is a powerful browser API...', authorId: 'u1', published: true, views: 1200, createdAt: Date.now() - 86400000 * 10 },
	{ id: 'p2', title: 'Advanced Queries', content: 'Learn how to use the query builder...', authorId: 'u1', published: true, views: 800, createdAt: Date.now() - 86400000 * 8 },
	{ id: 'p3', title: 'Draft: New Features', content: 'This post is still being written...', authorId: 'u2', published: false, views: 50, createdAt: Date.now() - 86400000 * 5 },
	{ id: 'p4', title: 'Cross-Tab Sync', content: 'Keep data synchronized across tabs...', authorId: 'u2', published: true, views: 500, createdAt: Date.now() - 86400000 * 3 },
	{ id: 'p5', title: 'Error Handling Best Practices', content: 'How to handle errors properly...', authorId: 'u5', published: true, views: 300, createdAt: Date.now() - 86400000 },
]

export const SAMPLE_SETTINGS: readonly Setting[] = [
	{ id: 's1', key: 'theme', value: 'dark', updatedAt: Date.now() - 3600000 },
	{ id: 's2', key: 'language', value: 'en', updatedAt: Date.now() - 7200000 },
	{ id: 's3', key: 'notifications', value: 'enabled', updatedAt: Date.now() },
]

// ============================================================================
// Utility Types
// ============================================================================

export interface ExampleResult {
	readonly success: boolean
	readonly message: string
	readonly data?: unknown
	readonly code?: string
}

export interface ExampleSection {
	readonly id: string
	readonly title: string
	readonly description: string
	readonly run: () => Promise<ExampleResult>
}

// ============================================================================
// UI Helper Types
// ============================================================================

export interface LogEntry {
	readonly timestamp: number
	readonly type: 'info' | 'success' | 'error' | 'event'
	readonly message: string
	readonly data?: unknown
}

export interface EventLogEntry extends ChangeEvent {
	readonly timestamp: number
}
