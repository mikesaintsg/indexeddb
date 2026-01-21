/**
 * Events and Reactivity Example
 *
 * Demonstrates:
 * - onChange() - Database-level change events
 * - onChange() - Store-level change events
 * - Cross-tab synchronization via BroadcastChannel
 * - onError() - Error event handling
 * - onVersionChange() - Version change events
 * - onClose() - Close events
 */

import type { Unsubscribe } from '@mikesaintsg/core'
import type { DatabaseInterface } from '@mikesaintsg/indexeddb'
import type { AppSchema, ExampleResult, EventLogEntry } from './types.js'

// Event log for demonstration
const eventLog: EventLogEntry[] = []

/**
 * Demonstrates database-level onChange subscription
 */
export async function demonstrateDatabaseOnChange(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	eventLog.length = 0
	const unsubscribes: Unsubscribe[] = []

	// Subscribe to all changes
	const unsubscribe = db.onChange((event) => {
		eventLog.push({
			...event,
			timestamp: Date.now(),
		})
	})
	unsubscribes.push(unsubscribe)

	// Trigger some changes
	await db.store('settings').set({
		id: 'event-test',
		key: 'test',
		value: 'trigger-change',
		updatedAt: Date.now(),
	})

	await db.store('settings').remove('event-test')

	// Wait a moment for events
	await new Promise(resolve => setTimeout(resolve, 50))

	// Cleanup
	unsubscribes.forEach(u => u())

	return {
		success: true,
		message: 'db.onChange() - Database-level change events',
		data: {
			events: eventLog.map(e => ({
				storeName: e.storeName,
				type: e.type,
				keys: e.keys,
				source: e.source,
			})),
		},
		code: `
// Subscribe to all changes across all stores
const unsubscribe = db.onChange((event) => {
  console.log(\`\${event.storeName}: \${event.type}\`, event.keys)

  if (event.source === 'remote') {
    // Change from another tab
    refreshUI()
  }
})

// Event structure:
// {
//   storeName: string,      // Store that changed
//   type: 'set' | 'add' | 'remove' | 'clear',
//   keys: ValidKey[],       // Affected keys
//   source: 'local' | 'remote'  // Origin
// }

// Cleanup when done
unsubscribe()
`.trim(),
	}
}

/**
 * Demonstrates store-level onChange subscription
 */
export async function demonstrateStoreOnChange(db: DatabaseInterface<AppSchema>): Promise<ExampleResult> {
	eventLog.length = 0
	const unsubscribes: Unsubscribe[] = []

	// Subscribe to specific store changes
	const unsubscribe = db.store('settings').onChange((event) => {
		eventLog.push({
			...event,
			timestamp: Date.now(),
		})
	})
	unsubscribes.push(unsubscribe)

	// Trigger changes
	await db.store('settings').set({
		id: 'store-event-test',
		key: 'test',
		value: 'store-level',
		updatedAt: Date.now(),
	})

	// This should not trigger the settings listener
	await db.store('users').set({
		id: 'no-trigger',
		name: 'No Trigger',
		email: 'no@trigger.com',
		age: 0,
		status: 'inactive',
		role: 'guest',
		tags: [],
		createdAt: Date.now(),
	})

	await new Promise(resolve => setTimeout(resolve, 50))

	// Cleanup
	await db.store('settings').remove('store-event-test')
	await db.store('users').remove('no-trigger')
	unsubscribes.forEach(u => u())

	return {
		success: true,
		message: 'store.onChange() - Store-level change events',
		data: {
			settingsEvents: eventLog.length,
			events: eventLog.map(e => ({
				type: e.type,
				keys: e.keys,
			})),
		},
		code: `
// Subscribe to specific store changes only
const unsubscribe = db.store('users').onChange((event) => {
  if (event.type === 'set') {
    invalidateCache(event.keys)
  }
})

// Only triggers for changes to this store
// More efficient than database-level when targeting one store

unsubscribe()
`.trim(),
	}
}

/**
 * Demonstrates cross-tab synchronization
 */
export function demonstrateCrossTabSync(_db: DatabaseInterface<AppSchema>): ExampleResult {
	return {
		success: true,
		message: 'Cross-tab synchronization via BroadcastChannel',
		data: {
			crossTabSyncEnabled: true,
			howToTest: 'Open this page in another tab and make changes',
		},
		code: `
// Cross-tab sync is enabled by default
const db = createDatabase<AppSchema>({
  name: 'myApp',
  version: 1,
  stores: { users: {} },
  crossTabSync: true  // Default: true
})

// Changes in Tab 1
await db.store('users').set({ id: 'u1', name: 'Alice' })

// Tab 2 receives change event with source: 'remote'
db.onChange((event) => {
  if (event.source === 'remote') {
    console.log('Another tab made changes:', event)
    refreshUI()
  }
})

// Disable if not needed (saves resources)
const db = createDatabase({
  // ...
  crossTabSync: false
})
`.trim(),
	}
}

/**
 * Demonstrates onError subscription
 */
export function demonstrateOnError(db: DatabaseInterface<AppSchema>): ExampleResult {
	const errors: string[] = []

	const unsubscribe = db.onError((error) => {
		errors.push(error.message)
	})

	// Cleanup
	unsubscribe()

	return {
		success: true,
		message: 'db.onError() - Error event handling',
		data: {
			subscribedToErrors: true,
			note: 'Errors are captured for logging/analytics',
		},
		code: `
// Subscribe to error events
const unsubscribe = db.onError((error) => {
  console.error('Database error:', error)
  reportToAnalytics(error)
})

// Useful for:
// - Centralized error logging
// - Analytics
// - User notifications
// - Error recovery strategies

unsubscribe()
`.trim(),
	}
}

/**
 * Demonstrates onVersionChange subscription
 */
export function demonstrateOnVersionChange(db: DatabaseInterface<AppSchema>): ExampleResult {
	let versionChangeReceived = false

	const unsubscribe = db.onVersionChange(() => {
		versionChangeReceived = true
		// In real app: prompt user or close connection
		// db.close()
	})

	// Cleanup
	unsubscribe()

	return {
		success: true,
		message: 'db.onVersionChange() - Handle version upgrades',
		data: {
			subscribedToVersionChange: true,
			versionChangeReceived,
		},
		code: `
// Triggered when another tab wants to upgrade the database
const unsubscribe = db.onVersionChange((event) => {
  console.log(\`Upgrade requested: v\${event.oldVersion} -> v\${event.newVersion}\`)

  // Typically close connection to allow upgrade
  showNotification('Updating app, please wait...')
  db.close()
})

// Important for:
// - Graceful handling of database upgrades
// - User communication during upgrades
// - Preventing upgrade blocking

unsubscribe()
`.trim(),
	}
}

/**
 * Demonstrates onClose subscription
 */
export function demonstrateOnClose(db: DatabaseInterface<AppSchema>): ExampleResult {
	let closeReceived = false

	const unsubscribe = db.onClose(() => {
		closeReceived = true
	})

	// Cleanup
	unsubscribe()

	return {
		success: true,
		message: 'db.onClose() - Handle connection close',
		data: {
			subscribedToClose: true,
			closeReceived,
		},
		code: `
// Triggered when database connection closes
const unsubscribe = db.onClose(() => {
  console.log('Database connection closed')

  // Reconnect or show offline message
  showOfflineMessage()
})

// Useful for:
// - Cleanup resources
// - Show offline indicators
// - Reconnection logic

unsubscribe()
`.trim(),
	}
}

/**
 * Demonstrates event hooks in options
 */
export function demonstrateEventHooks(): ExampleResult {
	return {
		success: true,
		message: 'Event hooks in database options',
		data: {
			availableHooks: ['onChange', 'onError', 'onBlocked', 'onVersionChange', 'onClose'],
		},
		code: `
// Set up event handlers at creation time
const db = createDatabase<AppSchema>({
  name: 'myApp',
  version: 1,
  stores: { users: {} },

  // Event hooks
  onChange: (event) => {
    console.log('Change:', event)
    syncToUI()
  },

  onError: (error) => {
    console.error('Error:', error)
    reportError(error)
  },

  onBlocked: () => {
    console.warn('Upgrade blocked by other tabs')
    showCloseTabsMessage()
  },

  onVersionChange: (event) => {
    console.log('Version change:', event)
    prepareForUpgrade()
  },

  onClose: () => {
    console.log('Connection closed')
    showOfflineStatus()
  }
})
`.trim(),
	}
}

/**
 * Returns the current event log for display
 */
export function getEventLog(): readonly EventLogEntry[] {
	return eventLog
}

/**
 * Clears the event log
 */
export function clearEventLog(): void {
	eventLog.length = 0
}
