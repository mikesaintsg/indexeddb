/**
 * IndexedDB Showcase
 *
 * Comprehensive demonstration of ALL features of the @mikesaintsg/indexeddb library.
 * Each tab showcases a specific category of functionality with interactive examples.
 *
 * Features covered:
 * - Database Operations: createDatabase, accessors, native access
 * - Store Operations: get, resolve, set, add, remove, has, all, keys, count, clear
 * - Index Operations: index queries, multi-entry, unique constraints
 * - Query Builder: where, filter, orderBy, limit, offset, terminal operations
 * - Transactions: read, write, durability, abort, commit
 * - Cursors: iterate, iterateKeys, openCursor, navigation, mutation
 * - Events: onChange, onError, onVersionChange, onClose, cross-tab sync
 * - Error Handling: error classes, type guards, comprehensive patterns
 */

import './styles.css'
import type { DatabaseInterface, ChangeEvent, Unsubscribe } from '~/src/types.js'
import type { ExampleResult, AppSchema, EventLogEntry, User } from './examples/types.js'
import { SAMPLE_USERS, SAMPLE_POSTS, SAMPLE_SETTINGS } from './examples/types.js'
import { createShowcaseDatabase } from './examples/database-setup.js'
import * as storeOps from './examples/store-operations.js'
import * as indexOps from './examples/index-operations.js'
import * as queryOps from './examples/query-builder.js'
import * as txOps from './examples/transactions.js'
import * as cursorOps from './examples/cursors.js'
import * as eventOps from './examples/events.js'
import * as errorOps from './examples/error-handling.js'
import type { InteractiveDemoResult } from './examples/interactive-demos.js'
import {
	createContactManagerDemo,
	createUserSearchDemo,
	createShoppingCartDemo,
	createActivityMonitorDemo,
	createDataExportDemo,
	createEmailLookupDemo,
	createRegistrationDemo,
} from './examples/interactive-demos.js'

// ============================================================================
// App State
// ============================================================================

type TabId = 'store' | 'index' | 'query' | 'transactions' | 'cursors' | 'events' | 'errors'

let db: DatabaseInterface<AppSchema>
let activeTab: TabId = 'store'
const eventLog: EventLogEntry[] = []
const unsubscribes: Unsubscribe[] = []
const demoCleanups: (() => void)[] = []

// ============================================================================
// Tab Definitions
// ============================================================================

interface TabDefinition {
	readonly id: TabId
	readonly emoji: string
	readonly label: string
	readonly description: string
	readonly demo?: () => InteractiveDemoResult
}

const TABS: readonly TabDefinition[] = [
	{ id: 'store', emoji: '⚡', label: 'Bulk Performance', description: 'Insert 10,000+ records with real-time metrics, query performance benchmarks', demo: createContactManagerDemo },
	{ id: 'index', emoji: '🔖', label: 'Index Operations', description: 'O(1) lookups, multi-entry indexes, unique constraints', demo: createEmailLookupDemo },
	{ id: 'query', emoji: '🔍', label: 'Query Builder', description: 'where, filter, orderBy, limit, offset, terminal operations', demo: createUserSearchDemo },
	{ id: 'transactions', emoji: '💳', label: 'Transactions', description: 'Atomic multi-store operations, durability options, abort/rollback', demo: createShoppingCartDemo },
	{ id: 'cursors', emoji: '📁', label: 'Cursors', description: 'Memory-efficient streaming, iterate, iterateKeys, navigation', demo: createDataExportDemo },
	{ id: 'events', emoji: '🌐', label: 'Cross-Tab Sync', description: 'FEATURED: Real-time synchronization between browser tabs', demo: createActivityMonitorDemo },
	{ id: 'errors', emoji: '⚠️', label: 'Error Handling', description: 'Error classes, type guards, comprehensive patterns', demo: createRegistrationDemo },
]

// ============================================================================
// Example Definitions
// ============================================================================

interface ExampleDefinition {
	readonly id: string
	readonly title: string
	readonly description: string
	readonly run: () => Promise<ExampleResult> | ExampleResult
}

function getExamplesForTab(tab: TabId): readonly ExampleDefinition[] {
	switch (tab) {
		case 'store':
			return [
				{ id: 'get', title: 'get() - Optional Lookup', description: 'Returns undefined for missing records', run: () => storeOps.demonstrateGet(db) },
				{ id: 'resolve', title: 'resolve() - Required Lookup', description: 'Throws NotFoundError for missing records', run: () => storeOps.demonstrateResolve(db) },
				{ id: 'set', title: 'set() - Upsert (single or batch)', description: 'Insert or update records, supports arrays', run: () => storeOps.demonstrateSet(db) },
				{ id: 'add', title: 'add() - Insert Only', description: 'Throws ConstraintError if key exists', run: () => storeOps.demonstrateAdd(db) },
				{ id: 'remove', title: 'remove() - Delete', description: 'Silently succeeds for missing keys', run: () => storeOps.demonstrateRemove(db) },
				{ id: 'has', title: 'has() - Existence Check', description: 'Check if records exist', run: () => storeOps.demonstrateHas(db) },
				{ id: 'bulk', title: 'Bulk Operations', description: 'all(), keys(), count(), clear()', run: () => storeOps.demonstrateBulkOperations(db) },
				{ id: 'accessors', title: 'Store Accessors', description: 'getName, getKeyPath, getIndexNames', run: () => storeOps.demonstrateStoreAccessors(db) },
			]
		case 'index':
			return [
				{ id: 'accessors', title: 'Index Accessors', description: 'getName, getKeyPath, isUnique, isMultiEntry', run: () => indexOps.demonstrateIndexAccessors(db) },
				{ id: 'lookup', title: 'Index Lookup', description: 'get, resolve, getKey by index', run: () => indexOps.demonstrateIndexLookup(db) },
				{ id: 'nonunique', title: 'Non-Unique Index', description: 'Query non-unique index values', run: () => indexOps.demonstrateNonUniqueIndex(db) },
				{ id: 'multientry', title: 'Multi-Entry Index', description: 'Index array elements separately', run: () => indexOps.demonstrateMultiEntryIndex(db) },
				{ id: 'range', title: 'Range Queries', description: 'Numeric range queries on index', run: () => indexOps.demonstrateIndexRangeQueries(db) },
				{ id: 'native', title: 'Native Access', description: 'Access native IDBIndex', run: () => indexOps.demonstrateNativeIndexAccess(db) },
			]
		case 'query':
			return [
				{ id: 'equals', title: 'where().equals()', description: 'Fast indexed equality query', run: () => queryOps.demonstrateWhereEquals(db) },
				{ id: 'comparison', title: 'Comparison Queries', description: 'greaterThan, lessThan, between', run: () => queryOps.demonstrateComparisonQueries(db) },
				{ id: 'startswith', title: 'startsWith()', description: 'String prefix queries', run: () => queryOps.demonstrateStartsWith(db) },
				{ id: 'anyof', title: 'anyOf()', description: 'Multiple value queries', run: () => queryOps.demonstrateAnyOf(db) },
				{ id: 'filter', title: 'filter()', description: 'Post-cursor filtering', run: () => queryOps.demonstrateFilter(db) },
				{ id: 'combined', title: 'Combined Query', description: 'where() + filter() for optimal performance', run: () => queryOps.demonstrateCombinedQuery(db) },
				{ id: 'ordering', title: 'Ordering & Pagination', description: 'orderBy, limit, offset', run: () => queryOps.demonstrateOrderingAndPagination(db) },
				{ id: 'terminal', title: 'Terminal Operations', description: 'toArray, first, count, keys, iterate', run: () => queryOps.demonstrateTerminalOperations(db) },
				{ id: 'iterate', title: 'iterate()', description: 'Memory-efficient async generator', run: () => queryOps.demonstrateQueryIterate(db) },
				{ id: 'boolean', title: 'Boolean Queries', description: 'Automatic fallback for non-indexable types', run: () => queryOps.demonstrateBooleanQueries(db) },
			]
		case 'transactions':
			return [
				{ id: 'read', title: 'Read Transaction', description: 'Consistent reads across stores', run: () => txOps.demonstrateReadTransaction(db) },
				{ id: 'write', title: 'Write Transaction', description: 'Atomic multi-store modifications', run: () => txOps.demonstrateWriteTransaction(db) },
				{ id: 'durability', title: 'Durability Options', description: 'default, strict, relaxed', run: () => txOps.demonstrateDurabilityOptions(db) },
				{ id: 'accessors', title: 'Transaction Accessors', description: 'getMode, getStoreNames, isActive', run: () => txOps.demonstrateTransactionAccessors(db) },
				{ id: 'abort', title: 'Transaction Abort', description: 'Roll back all changes', run: () => txOps.demonstrateTransactionAbort(db) },
				{ id: 'native', title: 'Native Access', description: 'Access native IDBTransaction', run: () => txOps.demonstrateNativeTransactionAccess(db) },
			]
		case 'cursors':
			return [
				{ id: 'iterate', title: 'iterate()', description: 'Async generator for records', run: () => cursorOps.demonstrateCursorIterate(db) },
				{ id: 'iteratekeys', title: 'iterateKeys()', description: 'Key-only iteration', run: () => cursorOps.demonstrateIterateKeys(db) },
				{ id: 'manual', title: 'Manual Cursor', description: 'openCursor() for full control', run: () => cursorOps.demonstrateManualCursor(db) },
				{ id: 'mutation', title: 'Cursor Mutation', description: 'Update and delete during iteration', run: () => cursorOps.demonstrateCursorMutation(db) },
				{ id: 'navigation', title: 'Cursor Navigation', description: 'continue, advance methods', run: () => cursorOps.demonstrateCursorNavigation(db) },
				{ id: 'directions', title: 'Cursor Directions', description: 'next, previous, unique variants', run: () => cursorOps.demonstrateCursorDirections(db) },
				{ id: 'keycursor', title: 'Key Cursor', description: 'Efficient key-only cursor', run: () => cursorOps.demonstrateKeyCursor(db) },
				{ id: 'indexcursor', title: 'Index Cursor', description: 'Iterate through index', run: () => cursorOps.demonstrateIndexCursor(db) },
			]
		case 'events':
			return [
				{ id: 'dbchange', title: 'Database onChange', description: 'All store changes', run: () => eventOps.demonstrateDatabaseOnChange(db) },
				{ id: 'storechange', title: 'Store onChange', description: 'Specific store changes', run: () => eventOps.demonstrateStoreOnChange(db) },
				{ id: 'crosstab', title: 'Cross-Tab Sync', description: 'BroadcastChannel synchronization', run: () => eventOps.demonstrateCrossTabSync(db) },
				{ id: 'onerror', title: 'onError', description: 'Error event handling', run: () => eventOps.demonstrateOnError(db) },
				{ id: 'versionchange', title: 'onVersionChange', description: 'Handle version upgrades', run: () => eventOps.demonstrateOnVersionChange(db) },
				{ id: 'onclose', title: 'onClose', description: 'Handle connection close', run: () => eventOps.demonstrateOnClose(db) },
				{ id: 'hooks', title: 'Event Hooks', description: 'Configure hooks at creation', run: () => eventOps.demonstrateEventHooks() },
			]
		case 'errors':
			return [
				{ id: 'notfound', title: 'NotFoundError', description: 'resolve() for missing records', run: () => errorOps.demonstrateNotFoundError(db) },
				{ id: 'constraint', title: 'ConstraintError', description: 'add() for duplicate keys', run: () => errorOps.demonstrateConstraintError(db) },
				{ id: 'codes', title: 'Error Codes', description: 'All error code enumeration', run: () => errorOps.demonstrateErrorCodes() },
				{ id: 'guards', title: 'Type Guards', description: 'Safe error type checking', run: () => errorOps.demonstrateTypeGuards(db) },
				{ id: 'hierarchy', title: 'Error Hierarchy', description: 'Error class structure', run: () => errorOps.demonstrateErrorHierarchy() },
				{ id: 'comprehensive', title: 'Comprehensive Handling', description: 'Best practices pattern', run: () => errorOps.demonstrateComprehensiveErrorHandling(db) },
			]
	}
}

// ============================================================================
// UI Helpers
// ============================================================================

function createElement<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options?: {
		className?: string
		textContent?: string
		id?: string
	},
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag)
	if (options?.className) element.className = options.className
	if (options?.textContent) element.textContent = options.textContent
	if (options?.id) element.id = options.id
	return element
}

function formatData(data: unknown): string {
	if (data === undefined) return 'undefined'
	if (data === null) return 'null'
	try {
		return JSON.stringify(data, null, 2)
	} catch {
		if (typeof data === 'object' && data !== null) {
			return '[Object]'
		}
		return typeof data === 'string' ? data : '[Unknown]'
	}
}

// ============================================================================
// Rendering
// ============================================================================

function renderApp(): void {
	// Cleanup previous demos
	demoCleanups.forEach(cleanup => cleanup())
	demoCleanups.length = 0

	const app = document.getElementById('app')
	if (!app) return

	app.innerHTML = ''

	const container = createElement('div', { className: 'container' })

	// Header
	const header = createElement('header')
	const h1 = createElement('h1', { textContent: '🗄️ IndexedDB Showcase' })
	const subtitle = createElement('p', { textContent: 'Comprehensive demonstration of ALL @mikesaintsg/indexeddb features' })
	header.append(h1, subtitle)

	// Navigation
	const nav = createElement('nav', { className: 'tabs' })
	TABS.forEach(tab => {
		const button = createElement('button', {
			className: `tab ${activeTab === tab.id ? 'active' : ''}`,
			textContent: `${tab.emoji} ${tab.label}`,
		})
		button.title = tab.description
		button.addEventListener('click', () => {
			activeTab = tab.id
			renderApp()
		})
		nav.appendChild(button)
	})

	// Content
	const content = createElement('main', { id: 'content' })
	void renderTabContent(content)

	// Footer
	const footer = createElement('footer')
	const footerP = createElement('p')
	footerP.innerHTML = '💡 <strong>Open this page in another tab</strong> to see cross-tab sync in action!'
	footer.appendChild(footerP)

	container.append(header, nav, content, footer)
	app.appendChild(container)
}

async function renderTabContent(content: HTMLElement): Promise<void> {
	const currentTab = TABS.find(t => t.id === activeTab)
	if (!currentTab) return

	const section = createElement('section', { className: 'card' })

	// Tab header
	const h2 = createElement('h2', { textContent: `${currentTab.emoji} ${currentTab.label}` })
	const tabDesc = createElement('p', { className: 'subtitle', textContent: currentTab.description })
	section.append(h2, tabDesc)

	// Interactive Demo (if available)
	if (currentTab.demo) {
		const demo = currentTab.demo()
		const demoContainer = createElement('div', { className: 'interactive-demo-container' })
		demoContainer.innerHTML = demo.html

		section.appendChild(demoContainer)

		// Initialize demo after DOM is ready
		if (demo.init) {
			try {
				await demo.init(demoContainer, db)
			} catch (err) {
				console.error('Demo init error:', err)
			}
		}

		// Register cleanup
		if (demo.cleanup) {
			demoCleanups.push(demo.cleanup)
		}

		// Add separator before API examples
		const separator = createElement('div', { className: 'demo-separator' })
		separator.innerHTML = '<h3 style="margin: 24px 0 16px; color: #6b7280; font-size: 0.95rem;">📚 API Reference Examples</h3>'
		section.appendChild(separator)
	}

	// Examples list
	const examples = getExamplesForTab(activeTab)
	const examplesContainer = createElement('div', { className: 'examples-container' })

	examples.forEach(example => {
		const exampleCard = createExampleCard(example)
		examplesContainer.appendChild(exampleCard)
	})

	section.appendChild(examplesContainer)
	content.appendChild(section)
}

function createExampleCard(example: ExampleDefinition): HTMLElement {
	const card = createElement('div', { className: 'example-card' })

	const header = createElement('div', { className: 'example-header' })
	const title = createElement('h3', { textContent: example.title })
	const desc = createElement('p', { className: 'example-desc', textContent: example.description })
	header.append(title, desc)

	const runButton = createElement('button', { className: 'btn primary', textContent: '▶ Run Example' })
	const resultArea = createElement('div', { className: 'example-result' })
	resultArea.style.display = 'none'

	runButton.addEventListener('click', () => {
		void runExample(example, runButton, resultArea)
	})

	card.append(header, runButton, resultArea)
	return card
}

async function runExample(
	example: ExampleDefinition,
	button: HTMLButtonElement,
	resultArea: HTMLElement,
): Promise<void> {
	button.disabled = true
	button.textContent = '⏳ Running...'
	resultArea.style.display = 'block'
	resultArea.innerHTML = '<p class="loading">Running example...</p>'

	try {
		const result = await example.run()

		resultArea.innerHTML = ''

		// Result message
		const statusClass = result.success ? 'success' : 'error'
		const statusEmoji = result.success ? '✅' : '❌'
		const message = createElement('p', {
			className: `result-message ${statusClass}`,
			textContent: `${statusEmoji} ${result.message}`,
		})
		resultArea.appendChild(message)

		// Data output
		if (result.data !== undefined) {
			const dataSection = createElement('div', { className: 'result-data' })
			const dataLabel = createElement('h4', { textContent: '📊 Result Data' })
			const dataContent = createElement('pre')
			const code = createElement('code', { textContent: formatData(result.data) })
			dataContent.appendChild(code)
			dataSection.append(dataLabel, dataContent)
			resultArea.appendChild(dataSection)
		}

		// Code example
		if (result.code) {
			const codeSection = createElement('div', { className: 'result-code' })
			const codeLabel = createElement('h4', { textContent: '💻 Code Example' })
			const codeBlock = createElement('div', { className: 'code-block' })
			const pre = createElement('pre')
			const code = createElement('code', { textContent: result.code })
			pre.appendChild(code)
			codeBlock.appendChild(pre)
			codeSection.append(codeLabel, codeBlock)
			resultArea.appendChild(codeSection)
		}
	} catch (error) {
		resultArea.innerHTML = ''
		const errorMsg = createElement('p', {
			className: 'result-message error',
			textContent: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
		})
		resultArea.appendChild(errorMsg)
	} finally {
		button.disabled = false
		button.textContent = '▶ Run Example'
	}
}

// ============================================================================
// Database Initialization
// ============================================================================

// Generate additional sample users for better demo experience
function generateAdditionalUsers(count: number): User[] {
	const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 'Maya', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Rose', 'Sam', 'Tara']
	const LAST_NAMES = ['Anderson', 'Brown', 'Clark', 'Davis', 'Evans', 'Foster', 'Garcia', 'Harris', 'Ivanov', 'Jones', 'Kim', 'Lee', 'Miller', 'Nelson', 'Ortiz', 'Park', 'Quinn', 'Roberts', 'Smith', 'Taylor']
	const DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me', 'icloud.com']
	const ROLES: ('admin' | 'user' | 'guest')[] = ['admin', 'user', 'user', 'user', 'guest']
	const STATUSES: ('active' | 'inactive')[] = ['active', 'active', 'active', 'inactive']
	const TAGS = ['developer', 'designer', 'manager', 'marketing', 'sales', 'support', 'hr', 'finance', 'ops', 'engineering']

	const users: User[] = []
	for (let i = 0; i < count; i++) {
		const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] ?? 'User'
		const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)] ?? 'Unknown'
		const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)] ?? 'example.com'
		const role = ROLES[Math.floor(Math.random() * ROLES.length)] ?? 'user'
		const status = STATUSES[Math.floor(Math.random() * STATUSES.length)] ?? 'active'
		const tagCount = Math.floor(Math.random() * 4)
		const userTags: string[] = []
		for (let j = 0; j < tagCount; j++) {
			const tag = TAGS[Math.floor(Math.random() * TAGS.length)]
			if (tag && !userTags.includes(tag)) userTags.push(tag)
		}

		users.push({
			id: `sample-${i}-${Date.now()}`,
			name: `${firstName} ${lastName}`,
			email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@${domain}`,
			age: 18 + Math.floor(Math.random() * 50),
			status,
			role,
			tags: userTags,
			createdAt: Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000),
		})
	}
	return users
}

async function initializeDatabase(): Promise<void> {
	try {
		db = createShowcaseDatabase()

		// Load sample data - always ensure we have enough data for demos
		const existingUsers = await db.store('users').count()
		if (existingUsers < 50) {
			await ensureSampleData()
		}

		// Set up event logging
		const unsubscribe = db.onChange((event: ChangeEvent) => {
			eventLog.unshift({
				...event,
				timestamp: Date.now(),
			})
			if (eventLog.length > 100) eventLog.pop()
		})
		unsubscribes.push(unsubscribe)
	} catch (error) {
		console.error('Failed to initialize database:', error)
		// Show error in UI
		const app = document.getElementById('app')
		if (app) {
			app.innerHTML = `
				<div style="max-width: 600px; margin: 50px auto; padding: 20px; background: #fee2e2; border-radius: 8px; text-align: center;">
					<h2 style="color: #dc2626;">⚠️ Database Error</h2>
					<p style="color: #991b1b;">Failed to initialize IndexedDB. This might happen if you're in private browsing mode or storage is full.</p>
					<p style="color: #991b1b; font-size: 0.9rem;">${error instanceof Error ? error.message : 'Unknown error'}</p>
					<button onclick="window.location.reload()" style="margin-top: 16px; padding: 8px 24px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">
						🔄 Retry
					</button>
				</div>
			`
		}
		throw error
	}
}

/**
 * Ensures sample data exists in all stores.
 * Called on init and after clearing data.
 */
async function ensureSampleData(): Promise<void> {
	// Add base sample users first
	await db.store('users').set([...SAMPLE_USERS])
	await db.store('posts').set([...SAMPLE_POSTS])
	await db.store('settings').set([...SAMPLE_SETTINGS])

	// Add additional users for better demo experience (100 users total)
	const additionalUsers = generateAdditionalUsers(100)
	await db.store('users').set(additionalUsers)
}

// Export for use in interactive demos
export { ensureSampleData }

// ============================================================================
// Initialize App
// ============================================================================

void initializeDatabase().then(() => {
	renderApp()
})

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
	unsubscribes.forEach(u => u())
})

// Export for potential external access
export { db, eventLog }
