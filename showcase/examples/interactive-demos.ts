/**
 * Interactive Demos for Showcase
 *
 * Real-world mini-applications demonstrating IndexedDB features
 * with interactive UI elements users can manipulate.
 *
 * Features prominent demos of:
 * - Cross-Tab Sync: Real-time synchronization between browser tabs
 * - Bulk Performance: Insert/query 10,000+ records with timing
 * - Transaction Atomicity: Visual demonstration of atomic operations
 */

import type { DatabaseInterface, ChangeEvent, Unsubscribe } from '~/src/types.js'
import type { AppSchema, User, Setting } from './types.js'
import { SAMPLE_USERS, SAMPLE_POSTS, SAMPLE_SETTINGS } from './types.js'

// ============================================================================
// Demo Result Types
// ============================================================================

export interface InteractiveDemoResult {
	readonly html: string
	readonly init?: (container: HTMLElement, db: DatabaseInterface<AppSchema>) => Promise<void> | void
	readonly cleanup?: () => void
}

// ============================================================================
// Helper: Generate realistic sample data
// ============================================================================

const FIRST_NAMES = ['Alice', 'Bob', 'Carol', 'David', 'Emma', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate', 'Leo', 'Maya', 'Noah', 'Olivia', 'Peter', 'Quinn', 'Rose', 'Sam', 'Tara']
const LAST_NAMES = ['Anderson', 'Brown', 'Clark', 'Davis', 'Evans', 'Foster', 'Garcia', 'Harris', 'Ivanov', 'Jones', 'Kim', 'Lee', 'Miller', 'Nelson', 'Ortiz', 'Park', 'Quinn', 'Roberts', 'Smith', 'Taylor']
const DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me', 'icloud.com']
const ROLES: ('admin' | 'user' | 'guest')[] = ['admin', 'user', 'user', 'user', 'guest']
const STATUSES: ('active' | 'inactive')[] = ['active', 'active', 'active', 'inactive']
const TAGS = ['developer', 'designer', 'manager', 'marketing', 'sales', 'support', 'hr', 'finance', 'ops', 'engineering']

function generateRandomUser(index: number): User {
	const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] ?? 'User'
	const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)] ?? 'Unknown'
	const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)] ?? 'example.com'
	const role = ROLES[Math.floor(Math.random() * ROLES.length)] ?? 'user'
	const status = STATUSES[Math.floor(Math.random() * STATUSES.length)] ?? 'active'
	const tagCount = Math.floor(Math.random() * 4)
	const userTags: string[] = []
	for (let i = 0; i < tagCount; i++) {
		const tag = TAGS[Math.floor(Math.random() * TAGS.length)]
		if (tag && !userTags.includes(tag)) userTags.push(tag)
	}

	return {
		id: `bulk-${index}-${Date.now()}`,
		name: `${firstName} ${lastName}`,
		email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${domain}`,
		age: 18 + Math.floor(Math.random() * 50),
		status,
		role,
		tags: userTags,
		createdAt: Date.now() - Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000),
	}
}

/**
 * Restores sample data to the database.
 * Used after clearing to ensure demos have data to work with.
 */
async function restoreSampleData(db: DatabaseInterface<AppSchema>): Promise<void> {
	// Restore base sample data
	await db.store('users').set([...SAMPLE_USERS])
	await db.store('posts').set([...SAMPLE_POSTS])
	await db.store('settings').set([...SAMPLE_SETTINGS])

	// Add additional users for better demo experience (100 users total)
	const additionalUsers: User[] = []
	for (let i = 0; i < 100; i++) {
		additionalUsers.push(generateRandomUser(i))
	}
	await db.store('users').set(additionalUsers)
}

// ============================================================================
// Store Operations: Bulk Performance Demo (10,000+ records)
// ============================================================================

export function createContactManagerDemo(): InteractiveDemoResult {
	let cleanup: Unsubscribe | undefined

	return {
		html: `
			<div class="demo-app bulk-performance">
				<h4>⚡ Bulk Performance Demo</h4>
				<p class="demo-desc">Insert and query <strong>10,000+ records</strong> with real-time performance metrics. Shows the power of IndexedDB for large datasets.</p>

				<div class="performance-panel">
					<div class="perf-controls">
						<div class="perf-row">
							<label>Records to insert:</label>
							<select id="bulk-count" class="demo-select">
								<option value="1000">1,000</option>
								<option value="5000">5,000</option>
								<option value="10000" selected>10,000</option>
								<option value="25000">25,000</option>
								<option value="50000">50,000</option>
							</select>
							<button id="bulk-insert-btn" class="btn primary">🚀 Bulk Insert</button>
							<button id="bulk-clear-btn" class="btn danger">🗑️ Clear All</button>
						</div>
					</div>

					<div class="perf-stats">
						<div class="perf-stat-card">
							<span class="perf-label">Total Records</span>
							<span class="perf-value" id="total-records">0</span>
						</div>
						<div class="perf-stat-card">
							<span class="perf-label">Insert Time</span>
							<span class="perf-value" id="insert-time">—</span>
						</div>
						<div class="perf-stat-card">
							<span class="perf-label">Records/sec</span>
							<span class="perf-value" id="insert-rate">—</span>
						</div>
						<div class="perf-stat-card">
							<span class="perf-label">Query Time</span>
							<span class="perf-value" id="query-time">—</span>
						</div>
					</div>

					<div class="perf-progress" id="perf-progress" style="display: none;">
						<div class="progress-bar">
							<div class="progress-fill" id="perf-progress-fill" style="width: 0%"></div>
						</div>
						<span id="perf-progress-text">Preparing...</span>
					</div>
				</div>

				<div class="query-section">
					<h5>🔍 Query Performance</h5>
					<div class="query-row">
						<select id="query-type" class="demo-select">
							<option value="all">all() - Get all records</option>
							<option value="count">count() - Count records</option>
							<option value="status">where(status).equals('active')</option>
							<option value="age-range">where(age).between(25, 40)</option>
							<option value="role">where(role).equals('admin')</option>
							<option value="filter">filter(age > 30 AND role='user')</option>
						</select>
						<button id="run-query-btn" class="btn primary">▶ Run Query</button>
					</div>
					<div class="query-results" id="query-results">
						<p class="placeholder">Select a query and click Run</p>
					</div>
				</div>

				<div class="demo-log" id="bulk-log"></div>
			</div>
		`,
		init: async(container, db) => {
			const store = db.store('users')
			const totalEl = container.querySelector('#total-records')!
			const insertTimeEl = container.querySelector('#insert-time')!
			const insertRateEl = container.querySelector('#insert-rate')!
			const queryTimeEl = container.querySelector('#query-time')!
			const progressEl = container.querySelector('#perf-progress')!
			const progressFill = container.querySelector('#perf-progress-fill')!
			const progressText = container.querySelector('#perf-progress-text')!
			const bulkCountSelect = container.querySelector('#bulk-count')!
			const bulkInsertBtn = container.querySelector('#bulk-insert-btn')!
			const bulkClearBtn = container.querySelector('#bulk-clear-btn')!
			const queryTypeSelect = container.querySelector('#query-type')!
			const runQueryBtn = container.querySelector('#run-query-btn')!
			const queryResultsEl = container.querySelector('#query-results')!
			const logEl = container.querySelector('#bulk-log')!

			function log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
				const entry = document.createElement('div')
				entry.className = `log-entry ${type}`
				entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`
				logEl.insertBefore(entry, logEl.firstChild)
				if (logEl.children.length > 8 && logEl.lastChild) logEl.removeChild(logEl.lastChild)
			}

			async function updateCount(): Promise<void> {
				const count = await store.count()
				totalEl.textContent = count.toLocaleString()
			}

			// Bulk insert handler
			bulkInsertBtn.onclick = (): void => {
				const count = parseInt((bulkCountSelect as HTMLSelectElement).value, 10)
				;(bulkInsertBtn as HTMLButtonElement).disabled = true
				;(bulkClearBtn as HTMLButtonElement).disabled = true
				;(progressEl as HTMLElement).style.display = 'block'
				;(progressFill as HTMLElement).style.width = '0%'
				progressText.textContent = `Generating ${count.toLocaleString()} records...`

				log(`Starting bulk insert of ${count.toLocaleString()} records...`, 'info')

				void (async() => {
					try {
						// Generate all records
						const users: User[] = []
						for (let i = 0; i < count; i++) {
							users.push(generateRandomUser(i))
						}

						progressText.textContent = 'Inserting into IndexedDB...'
						const startTime = performance.now()

						// Use progress callback feature for real-time updates
						await store.set(users, {
							onProgress: (current, total) => {
								const percent = Math.round((current / total) * 100)
								;(progressFill as HTMLElement).style.width = `${percent}%`
								// Update text every 5%
								if (current % Math.ceil(total / 20) === 0 || current === total) {
									progressText.textContent = `Inserted ${current.toLocaleString()} of ${total.toLocaleString()} (${percent}%)...`
								}
							},
						})

						const elapsed = performance.now() - startTime
						const rate = Math.round(count / (elapsed / 1000))

						insertTimeEl.textContent = `${elapsed.toFixed(0)}ms`
						insertRateEl.textContent = rate.toLocaleString()

						log(`✅ Inserted ${count.toLocaleString()} records in ${elapsed.toFixed(0)}ms (${rate.toLocaleString()}/sec)`, 'success')

						await updateCount()
						;(progressEl as HTMLElement).style.display = 'none'
					} catch (err) {
						log(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
						;(progressEl as HTMLElement).style.display = 'none'
					} finally {
						;(bulkInsertBtn as HTMLButtonElement).disabled = false
						;(bulkClearBtn as HTMLButtonElement).disabled = false
					}
				})()
			}

			// Clear handler
			;(bulkClearBtn as HTMLButtonElement).onclick = (): void => {
				void (async() => {
					try {
						const count = await store.count()
						await store.clear()
						log(`Cleared ${count.toLocaleString()} records`, 'info')

						// Restore sample data so other demos have data to work with
						log('Restoring sample data for other demos...', 'info')
						await restoreSampleData(db)
						log('Restored 100+ sample records', 'success')

						await updateCount()
						insertTimeEl.textContent = '—'
						insertRateEl.textContent = '—'
						queryTimeEl.textContent = '—'
					} catch (err) {
						log(`Error during clear: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
					}
				})()
			}

			// Query handler
			;(runQueryBtn as HTMLButtonElement).onclick = (): void => {
				const queryType = (queryTypeSelect as HTMLSelectElement).value
				;(runQueryBtn as HTMLButtonElement).disabled = true

				void (async() => {
					try {
						const startTime = performance.now()
						let result: unknown
						let resultCount = 0
						let queryCode = ''

						switch (queryType) {
							case 'all': {
								const all = await store.all()
								resultCount = all.length
								result = all.slice(0, 5)
								queryCode = 'await store.all()'
								break
							}
							case 'count': {
								resultCount = await store.count()
								result = resultCount
								queryCode = 'await store.count()'
								break
							}
							case 'status': {
								const active = await store.query().where('byStatus').equals('active').toArray()
								resultCount = active.length
								result = active.slice(0, 5)
								queryCode = "await store.query().where('byStatus').equals('active').toArray()"
								break
							}
							case 'age-range': {
								const range = await store.query().where('byAge').between(25, 40).toArray()
								resultCount = range.length
								result = range.slice(0, 5)
								queryCode = "await store.query().where('byAge').between(25, 40).toArray()"
								break
							}
							case 'role': {
								const admins = await store.query().where('byRole').equals('admin').toArray()
								resultCount = admins.length
								result = admins.slice(0, 5)
								queryCode = "await store.query().where('byRole').equals('admin').toArray()"
								break
							}
							case 'filter': {
								const filtered = await store.query()
									.filter(u => u.age > 30 && u.role === 'user')
									.toArray()
								resultCount = filtered.length
								result = filtered.slice(0, 5)
								queryCode = "await store.query().filter(u => u.age > 30 && u.role === 'user').toArray()"
								break
							}
						}

						const elapsed = performance.now() - startTime
						queryTimeEl.textContent = `${elapsed.toFixed(1)}ms`

						queryResultsEl.innerHTML = `
							<div class="query-result-box">
								<div class="query-meta">
									<span class="query-count">Found: <strong>${resultCount.toLocaleString()}</strong> records</span>
									<span class="query-elapsed">Time: <strong>${elapsed.toFixed(1)}ms</strong></span>
								</div>
								<div class="query-code-block">
									<code class="syntax-highlight">${queryCode}</code>
								</div>
								<div class="query-preview">
									<strong>Preview (first 5):</strong>
									<pre>${JSON.stringify(result, null, 2)}</pre>
								</div>
							</div>
						`

						log(`Query returned ${resultCount.toLocaleString()} records in ${elapsed.toFixed(1)}ms`, 'success')
					} catch (err) {
						log(`Query error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
					} finally {
						;(runQueryBtn as HTMLButtonElement).disabled = false
					}
				})()
			}

			// Listen for changes
			cleanup = store.onChange(() => {
				void updateCount()
			})

			await updateCount()
			log('Bulk Performance Demo ready! Try inserting 10,000+ records.', 'info')
		},
		cleanup: () => {
			cleanup?.()
		},
	}
}

// ============================================================================
// Query Builder: User Search Demo
// ============================================================================

export function createUserSearchDemo(): InteractiveDemoResult {
	return {
		html: `
			<div class="demo-app user-search">
				<h4>🔍 User Search</h4>
				<p class="demo-desc">Search and filter users with <code>where()</code>, <code>filter()</code>, and <code>orderBy()</code></p>

				<div class="demo-filters">
					<input type="text" id="search-name" placeholder="Search by name..." class="demo-input" />
					<select id="filter-status" class="demo-select">
						<option value="">All Statuses</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>
					<select id="filter-role" class="demo-select">
						<option value="">All Roles</option>
						<option value="admin">Admin</option>
						<option value="user">User</option>
						<option value="guest">Guest</option>
					</select>
				</div>

				<div class="demo-stats">
					<span class="stat">Results: <strong id="search-count">0</strong></span>
					<span class="stat">Query time: <strong id="search-time">0</strong>ms</span>
				</div>

				<div class="query-display" id="query-display">
					<strong>Query:</strong> <code id="query-code">store.all()</code>
				</div>

				<div class="demo-list" id="search-results">
					<p class="placeholder">Enter search criteria above...</p>
				</div>
			</div>
		`,
		init: (container, db) => {
			const store = db.store('users')
			const resultsEl = container.querySelector('#search-results')!
			const countEl = container.querySelector('#search-count')!
			const timeEl = container.querySelector('#search-time')!
			const queryCodeEl = container.querySelector('#query-code')!
			const searchInput = container.querySelector('#search-name')!
			const statusSelect = container.querySelector('#filter-status')!
			const roleSelect = container.querySelector('#filter-role')!

			async function runSearch(): Promise<void> {
				const searchText = searchInput.value.toLowerCase().trim()
				const status = statusSelect.value as 'active' | 'inactive' | ''
				const role = roleSelect.value as 'admin' | 'user' | 'guest' | ''

				const start = performance.now()

				// Build query dynamically
				let query = store.query()
				const queryParts: string[] = ['store.query()']

				// Use index for status if specified
				if (status) {
					query = query.where('byStatus').equals(status)
					queryParts.push(`.where('byStatus').equals('${status}')`)
				}

				// Add filters
				if (searchText) {
					query = query.filter(user => user.name.toLowerCase().includes(searchText))
					queryParts.push(`.filter(u => u.name.includes('${searchText}'))`)
				}

				if (role) {
					query = query.filter(user => user.role === role)
					queryParts.push(`.filter(u => u.role === '${role}')`)
				}

				queryParts.push('.toArray()')
				const results = await query.toArray()

				const elapsed = Math.round(performance.now() - start)

				countEl.textContent = String(results.length)
				timeEl.textContent = String(elapsed)
				queryCodeEl.textContent = queryParts.join('\n  ')

				if (results.length === 0) {
					resultsEl.innerHTML = '<p class="placeholder">No users match your criteria</p>'
					return
				}

				resultsEl.innerHTML = results.map(user => `
					<div class="list-item">
						<div class="item-info">
							<strong>${user.name}</strong>
							<span class="item-meta">${user.email} • Age ${user.age} • ${user.status} • ${user.role}</span>
						</div>
					</div>
				`).join('')
			}

			// Debounced search
			let timeout: ReturnType<typeof setTimeout>
			function debouncedSearch(): void {
				clearTimeout(timeout)
				timeout = setTimeout(() => void runSearch(), 150)
			}

			searchInput.oninput = debouncedSearch
			statusSelect.onchange = debouncedSearch
			roleSelect.onchange = debouncedSearch

			void runSearch()
		},
	}
}

// ============================================================================
// Transactions: Shopping Cart Demo
// ============================================================================

export function createShoppingCartDemo(): InteractiveDemoResult {
	return {
		html: `
			<div class="demo-app shopping-cart">
				<h4>🛒 Shopping Cart</h4>
				<p class="demo-desc">Atomic checkout with <code>write()</code> transaction - all operations succeed or all fail</p>

				<div class="cart-layout">
					<div class="cart-products">
						<h5>Products</h5>
						<div class="product-list">
							<div class="product-item" data-id="prod1">
								<span class="product-name">📱 Smartphone</span>
								<span class="product-price">$599</span>
								<button class="btn small add-to-cart" data-id="prod1" data-name="Smartphone" data-price="599">Add</button>
							</div>
							<div class="product-item" data-id="prod2">
								<span class="product-name">💻 Laptop</span>
								<span class="product-price">$1299</span>
								<button class="btn small add-to-cart" data-id="prod2" data-name="Laptop" data-price="1299">Add</button>
							</div>
							<div class="product-item" data-id="prod3">
								<span class="product-name">🎧 Headphones</span>
								<span class="product-price">$199</span>
								<button class="btn small add-to-cart" data-id="prod3" data-name="Headphones" data-price="199">Add</button>
							</div>
						</div>
					</div>

					<div class="cart-summary">
						<h5>Cart</h5>
						<div id="cart-items" class="cart-items">
							<p class="placeholder">Cart is empty</p>
						</div>
						<div class="cart-total">
							Total: <strong>$<span id="cart-total">0</span></strong>
						</div>
						<button id="checkout-btn" class="btn primary" disabled>✅ Checkout (Atomic)</button>
						<button id="checkout-fail-btn" class="btn danger" disabled>❌ Simulate Failure</button>
					</div>
				</div>

				<div class="demo-log" id="cart-log"></div>
			</div>
		`,
		init: (container, db) => {
			const cartItemsEl = container.querySelector('#cart-items')!
			const cartTotalEl = container.querySelector('#cart-total')!
			const logEl = container.querySelector('#cart-log')!
			const checkoutBtn = container.querySelector('#checkout-btn')!
			const checkoutFailBtn = container.querySelector('#checkout-fail-btn')!

			interface CartItem {
				id: string
				name: string
				price: number
				quantity: number
			}

			const cart = new Map<string, CartItem>()

			function log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
				const entry = document.createElement('div')
				entry.className = `log-entry ${type}`
				entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`
				logEl.insertBefore(entry, logEl.firstChild)
				if (logEl.children.length > 8 && logEl.lastChild) logEl.removeChild(logEl.lastChild)
			}

			function renderCart(): void {
				const items = Array.from(cart.values())
				const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

				cartTotalEl.textContent = String(total)
				checkoutBtn.disabled = items.length === 0
				checkoutFailBtn.disabled = items.length === 0

				if (items.length === 0) {
					cartItemsEl.innerHTML = '<p class="placeholder">Cart is empty</p>'
					return
				}

				cartItemsEl.innerHTML = items.map(item => `
					<div class="cart-item">
						<span>${item.name} x${item.quantity}</span>
						<span>$${item.price * item.quantity}</span>
						<button class="btn small danger remove-item" data-id="${item.id}">×</button>
					</div>
				`).join('')

				cartItemsEl.querySelectorAll('.remove-item').forEach(btn => {
					const button = btn as HTMLButtonElement
					button.onclick = (): void => {
						const id = button.dataset.id ?? ''
						const item = cart.get(id)
						if (item && item.quantity > 1) {
							cart.set(id, { ...item, quantity: item.quantity - 1 })
						} else {
							cart.delete(id)
						}
						renderCart()
						log(`Removed ${item?.name ?? 'item'} from cart`)
					}
				})
			}

			// Add to cart handlers
			container.querySelectorAll('.add-to-cart').forEach(btn => {
				const button = btn as HTMLButtonElement
				button.onclick = (): void => {
					const id = button.dataset.id ?? ''
					const name = button.dataset.name ?? ''
					const price = parseInt(button.dataset.price ?? '0', 10)

					const existing = cart.get(id)
					if (existing) {
						cart.set(id, { ...existing, quantity: existing.quantity + 1 })
					} else {
						cart.set(id, { id, name, price, quantity: 1 })
					}
					renderCart()
					log(`Added ${name} to cart`)
				}
			})

			// Successful checkout
			checkoutBtn.onclick = (): void => {
				log('Starting atomic transaction...', 'info')

				void db.write(['settings'], async(tx) => {
					const settingsStore = tx.store('settings')
					const items = Array.from(cart.values())

					const orderId = `order-${Date.now()}`
					const orderSetting: Setting = {
						id: orderId,
						key: 'lastOrder',
						value: JSON.stringify({
							items: items.map(i => ({ name: i.name, qty: i.quantity })),
							total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
						}),
						updatedAt: Date.now(),
					}

					await settingsStore.set(orderSetting)
					log(`TX: Created order ${orderId}`, 'info')
				}).then(() => {
					log('✅ Transaction committed!', 'success')
					cart.clear()
					renderCart()
				}).catch((error: unknown) => {
					const message = error instanceof Error ? error.message : 'Unknown error'
					log(`❌ Transaction failed: ${message}`, 'error')
				})
			}

			// Failed checkout
			checkoutFailBtn.onclick = (): void => {
				log('Starting transaction with failure...', 'info')

				void db.write(['settings'], async(tx) => {
					const settingsStore = tx.store('settings')

					const tempSetting: Setting = {
						id: 'temp-checkout',
						key: 'checkoutInProgress',
						value: 'true',
						updatedAt: Date.now(),
					}
					await settingsStore.set(tempSetting)
					log('TX: First operation succeeded', 'info')

					log('TX: Aborting...', 'error')
					tx.abort()
				}).catch(() => {
					log('❌ Transaction aborted! All changes rolled back.', 'error')
				})
			}

			renderCart()
			log('Shopping Cart ready!', 'info')
		},
	}
}

// ============================================================================
// Events: Cross-Tab Sync Demo (FEATURED - Most Powerful Feature)
// ============================================================================

export function createActivityMonitorDemo(): InteractiveDemoResult {
	let cleanup: Unsubscribe | undefined

	return {
		html: `
			<div class="demo-app cross-tab-sync featured-demo">
				<div class="featured-banner">
					<span class="featured-icon">🌐</span>
					<span class="featured-text">REAL-TIME CROSS-TAB SYNC</span>
				</div>

				<h4>📡 Cross-Tab Synchronization Demo</h4>
				<p class="demo-desc">
					<strong>The most powerful browser storage feature!</strong> Changes made in one tab are <strong>instantly synchronized</strong>
					to all other open tabs via <code>BroadcastChannel</code>. Try it now:
				</p>

				<div class="cross-tab-instruction">
					<div class="instruction-step">
						<span class="step-number">1</span>
						<span class="step-text">Open this page in <strong>2+ browser tabs</strong></span>
						<button id="open-new-tab" class="btn small">🔗 Open New Tab</button>
					</div>
					<div class="instruction-step">
						<span class="step-number">2</span>
						<span class="step-text">Click a button below in <strong>this tab</strong></span>
					</div>
					<div class="instruction-step">
						<span class="step-number">3</span>
						<span class="step-text">Watch the event appear in the <strong>other tab</strong> instantly!</span>
					</div>
				</div>

				<div class="sync-controls">
					<button id="sync-add-btn" class="btn primary large-btn">➕ Add User (triggers cross-tab event)</button>
					<button id="sync-update-btn" class="btn large-btn">✏️ Update Random User</button>
					<button id="sync-delete-btn" class="btn danger large-btn">🗑️ Delete Random User</button>
				</div>

				<div class="sync-stats">
					<div class="sync-stat-card local">
						<span class="sync-stat-label">Local Events</span>
						<span class="sync-stat-value" id="local-event-count">0</span>
						<span class="sync-stat-desc">Changes made in this tab</span>
					</div>
					<div class="sync-stat-card remote">
						<span class="sync-stat-label">📡 Remote Events</span>
						<span class="sync-stat-value" id="remote-event-count">0</span>
						<span class="sync-stat-desc">Changes from other tabs</span>
					</div>
					<div class="sync-stat-card total">
						<span class="sync-stat-label">Total Events</span>
						<span class="sync-stat-value" id="total-event-count">0</span>
						<span class="sync-stat-desc">All synchronized changes</span>
					</div>
				</div>

				<h5>📜 Live Event Feed</h5>
				<div class="event-feed enhanced-feed" id="sync-event-feed">
					<p class="placeholder">Make a change or wait for events from other tabs...</p>
				</div>

				<div class="code-example-box">
					<h5>💻 How It Works</h5>
					<pre class="syntax-code"><code><span class="keyword">const</span> db = <span class="function">createDatabase</span>({
  name: <span class="string">'myApp'</span>,
  version: <span class="number">1</span>,
  stores: { users: {} }
})

<span class="comment">// Subscribe to ALL changes (local + remote)</span>
db.<span class="function">onChange</span>((event) =&gt; {
  <span class="keyword">if</span> (event.source === <span class="string">'remote'</span>) {
    <span class="comment">// This change came from another tab!</span>
    console.<span class="function">log</span>(<span class="string">'📡 Cross-tab:'</span>, event.type, event.keys)
  }
})</code></pre>
				</div>

				<div class="demo-log" id="sync-log"></div>
			</div>
		`,
		init: (container, db) => {
			const feedEl = container.querySelector('#sync-event-feed')!
			const localCountEl = container.querySelector('#local-event-count')!
			const remoteCountEl = container.querySelector('#remote-event-count')!
			const totalCountEl = container.querySelector('#total-event-count')!
			const addBtn = container.querySelector('#sync-add-btn')!
			const updateBtn = container.querySelector('#sync-update-btn')!
			const deleteBtn = container.querySelector('#sync-delete-btn')!
			const openTabBtn = container.querySelector('#open-new-tab')!
			const logEl = container.querySelector('#sync-log')!

			const store = db.store('users')
			let localCount = 0
			let remoteCount = 0
			let isFirstEvent = true

			function log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
				const entry = document.createElement('div')
				entry.className = `log-entry ${type}`
				entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`
				logEl.insertBefore(entry, logEl.firstChild)
				if (logEl.children.length > 6 && logEl.lastChild) logEl.removeChild(logEl.lastChild)
			}

			function addEvent(event: ChangeEvent): void {
				const isRemote = event.source === 'remote'

				if (isRemote) {
					remoteCount++
					remoteCountEl.textContent = String(remoteCount)
					// Flash the remote counter for visual emphasis
					remoteCountEl.parentElement?.classList.add('flash')
					setTimeout(() => remoteCountEl.parentElement?.classList.remove('flash'), 500)
				} else {
					localCount++
					localCountEl.textContent = String(localCount)
				}

				totalCountEl.textContent = String(localCount + remoteCount)

				if (isFirstEvent) {
					feedEl.innerHTML = ''
					isFirstEvent = false
				}

				const entry = document.createElement('div')
				entry.className = `event-entry enhanced ${isRemote ? 'remote-event' : 'local-event'} event-${event.type}`

				const sourceLabel = isRemote
					? '<span class="source-badge remote">📡 FROM OTHER TAB</span>'
					: '<span class="source-badge local">🏠 This Tab</span>'

				const typeBadgeMap: Record<string, string> = {
					set: '<span class="type-badge set">SET</span>',
					add: '<span class="type-badge add">ADD</span>',
					remove: '<span class="type-badge remove">DELETE</span>',
				}
				const typeBadge = typeBadgeMap[event.type] ?? `<span class="type-badge">${event.type.toUpperCase()}</span>`

				entry.innerHTML = `
					<div class="event-header">
						${sourceLabel}
						${typeBadge}
						<span class="event-time">${new Date().toLocaleTimeString()}</span>
					</div>
					<div class="event-details">
						<span class="event-store">Store: <strong>${event.storeName}</strong></span>
						<span class="event-keys">Keys: <code>${JSON.stringify(event.keys)}</code></span>
					</div>
				`

				// Add animation class
				entry.classList.add('slide-in')
				feedEl.insertBefore(entry, feedEl.firstChild)

				while (feedEl.children.length > 15 && feedEl.lastChild) {
					feedEl.removeChild(feedEl.lastChild)
				}

				if (isRemote) {
					log(`📡 CROSS-TAB: ${event.type} on ${event.storeName}`, 'success')
				}
			}

			cleanup = db.onChange((event) => {
				addEvent(event)
			})

			// Open new tab button
			openTabBtn.onclick = (): void => {
				window.open(window.location.href, '_blank')
				log('Opened new tab - try making changes there!', 'info')
			}

			addBtn.onclick = (): void => {
				const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] ?? 'User'
				const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)] ?? 'Test'
				const domain = DOMAINS[Math.floor(Math.random() * DOMAINS.length)] ?? 'example.com'
				const name = `${firstName} ${lastName}`
				const newUser: User = {
					id: `sync-${Date.now()}`,
					name,
					email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
					age: 20 + Math.floor(Math.random() * 40),
					status: 'active',
					role: 'user',
					tags: [],
					createdAt: Date.now(),
				}
				void store.set(newUser).then(() => {
					log(`Added "${name}" - check other tabs!`, 'success')
				}).catch(() => { /* ignore */ })
			}

			updateBtn.onclick = (): void => {
				void store.all().then(async(users) => {
					if (users.length === 0) {
						log('No users to update. Add some first!', 'error')
						return
					}
					const user = users[Math.floor(Math.random() * users.length)]
					if (user) {
						const updated: User = { ...user, age: user.age + 1 }
						await store.set(updated)
						log(`Updated "${user.name}" age to ${updated.age}`, 'success')
					}
				}).catch(() => { /* ignore */ })
			}

			deleteBtn.onclick = (): void => {
				void store.all().then(async(users) => {
					if (users.length === 0) {
						log('No users to delete. Add some first!', 'error')
						return
					}
					const user = users[Math.floor(Math.random() * users.length)]
					if (user) {
						await store.remove(user.id)
						log(`Deleted "${user.name}"`, 'success')
					}
				}).catch(() => { /* ignore */ })
			}

			log('Cross-Tab Sync Demo ready! Open another tab to test.', 'info')
		},
		cleanup: () => {
			cleanup?.()
		},
	}
}

// ============================================================================
// Cursors: Data Export Demo
// ============================================================================

export function createDataExportDemo(): InteractiveDemoResult {
	return {
		html: `
			<div class="demo-app data-export">
				<h4>📁 Data Export Tool</h4>
				<p class="demo-desc">Stream records with <code>iterate()</code> - memory efficient</p>

				<div class="export-controls">
					<select id="export-store" class="demo-select">
						<option value="users">Users</option>
						<option value="posts">Posts</option>
						<option value="settings">Settings</option>
					</select>
					<select id="export-format" class="demo-select">
						<option value="json">JSON</option>
						<option value="csv">CSV</option>
					</select>
					<button id="export-btn" class="btn primary">📤 Export</button>
				</div>

				<div class="export-progress" id="export-progress" style="display: none;">
					<div class="progress-bar">
						<div class="progress-fill" id="progress-fill" style="width: 0%"></div>
					</div>
					<span id="progress-text">0 records</span>
				</div>

				<div class="export-output">
					<h5>Preview</h5>
					<pre id="export-preview" class="code-preview"><code>Click Export to generate...</code></pre>
				</div>

				<div class="demo-log" id="export-log"></div>
			</div>
		`,
		init: (container, db) => {
			const storeSelect = container.querySelector('#export-store')!
			const formatSelect = container.querySelector('#export-format')!
			const exportBtn = container.querySelector('#export-btn')!
			const progressEl = container.querySelector('#export-progress')!
			const progressFill = container.querySelector('#progress-fill')!
			const progressText = container.querySelector('#progress-text')!
			const previewEl = container.querySelector('#export-preview code')!
			const logEl = container.querySelector('#export-log')!

			function log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
				const entry = document.createElement('div')
				entry.className = `log-entry ${type}`
				entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`
				logEl.insertBefore(entry, logEl.firstChild)
				if (logEl.children.length > 5 && logEl.lastChild) logEl.removeChild(logEl.lastChild)
			}

			exportBtn.onclick = (): void => {
				const storeName = storeSelect.value as 'users' | 'posts' | 'settings'
				const format = formatSelect.value as 'json' | 'csv'

				exportBtn.disabled = true
				progressEl.style.display = 'block'
				progressFill.style.width = '0%'

				const store = db.store(storeName)

				void (async() => {
					try {
						// First, get total count and all records in one go
						// This avoids the transaction timeout issue with iterate()
						const total = await store.count()
						log(`Exporting ${total} records from "${storeName}"...`)
						const startTime = performance.now()

						// Use all() to get records in a single transaction
						const records = await store.all()
						const processed = records.length

						// Update progress to 100%
						progressFill.style.width = '100%'
						progressText.textContent = `${processed} / ${total}`

						const elapsed = Math.round(performance.now() - startTime)
						log(`Completed: ${processed} records in ${elapsed}ms`, 'success')

						let output: string
						if (format === 'json') {
							output = JSON.stringify(records, null, 2)
						} else {
							if (records.length === 0) {
								output = '(no data)'
							} else {
								const firstRecord = records[0] as unknown as Record<string, unknown>
								const headers = Object.keys(firstRecord)
								const rows = records.map(r => {
									const rec = r as unknown as Record<string, unknown>
									return headers.map(h => JSON.stringify(rec[h] ?? '')).join(',')
								})
								output = [headers.join(','), ...rows].join('\n')
							}
						}

						previewEl.textContent = output.length > 1500
							? output.substring(0, 1500) + '\n... (truncated)'
							: output

						exportBtn.disabled = false
					} catch (err) {
						log(`Export failed: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
						exportBtn.disabled = false
					}
				})()
			}
		},
	}
}

// ============================================================================
// Index Operations: Email Lookup Demo
// ============================================================================

export function createEmailLookupDemo(): InteractiveDemoResult {
	return {
		html: `
			<div class="demo-app email-lookup">
				<h4>📧 Email Lookup</h4>
				<p class="demo-desc">Fast O(1) lookups with <code>index().get()</code></p>

				<div class="lookup-form">
					<input type="email" id="lookup-email" placeholder="Enter email..." class="demo-input" list="email-suggestions" />
					<datalist id="email-suggestions">
						<option value="alice@example.com">
						<option value="bob@example.com">
						<option value="carol@example.com">
					</datalist>
					<button id="lookup-btn" class="btn primary">🔍 Lookup</button>
				</div>

				<div class="lookup-stats" id="lookup-stats" style="display: none;">
					<span class="stat">Time: <strong id="lookup-time">0</strong>ms</span>
				</div>

				<div class="lookup-result" id="lookup-result">
					<p class="placeholder">Enter an email to search...</p>
				</div>

				<div class="lookup-code">
					<h5>💻 Code</h5>
					<pre><code>// O(1) index lookup
const user = await store.index('byEmail').get('alice@example.com')</code></pre>
				</div>
			</div>
		`,
		init: (container, db) => {
			const emailInput = container.querySelector('#lookup-email')!
			const lookupBtn = container.querySelector('#lookup-btn')!
			const resultEl = container.querySelector('#lookup-result')!
			const statsEl = container.querySelector('#lookup-stats')!
			const timeEl = container.querySelector('#lookup-time')!
			const datalist = container.querySelector('#email-suggestions')!

			const store = db.store('users')
			const index = store.index('byEmail')

			// Populate email suggestions from existing data
			void store.all().then((users) => {
				const emails = users.slice(0, 10).map(u => u.email)
				datalist.innerHTML = emails.map(email => `<option value="${email}">`).join('')
			}).catch(() => { /* ignore */ })

			function doLookup(): void {
				const email = emailInput.value.trim()
				if (!email) {
					resultEl.innerHTML = '<p class="placeholder">Enter an email to search...</p>'
					statsEl.style.display = 'none'
					return
				}

				const start = performance.now()
				void index.get(email).then((user) => {
					const elapsed = performance.now() - start

					statsEl.style.display = 'flex'
					timeEl.textContent = elapsed.toFixed(2)

					if (user) {
						resultEl.innerHTML = `
							<div class="user-card found">
								<h5>✅ User Found</h5>
								<div class="user-details">
									<p><strong>Name:</strong> ${user.name}</p>
									<p><strong>Email:</strong> ${user.email}</p>
									<p><strong>Age:</strong> ${user.age}</p>
									<p><strong>Status:</strong> ${user.status}</p>
								</div>
							</div>
						`
					} else {
						resultEl.innerHTML = `
							<div class="user-card not-found">
								<h5>❌ Not Found</h5>
								<p>No user with email "${email}"</p>
							</div>
						`
					}
				}).catch(() => { /* ignore */ })
			}

			lookupBtn.onclick = doLookup
			emailInput.onkeypress = (e: KeyboardEvent): void => {
				if (e.key === 'Enter') doLookup()
			}
		},
	}
}

// ============================================================================
// Error Handling: Registration Demo
// ============================================================================

export function createRegistrationDemo(): InteractiveDemoResult {
	return {
		html: `
			<div class="demo-app registration">
				<h4>📝 User Registration</h4>
				<p class="demo-desc">Handle <code>ConstraintError</code> and <code>NotFoundError</code></p>

				<div class="registration-form">
					<input type="text" id="reg-name" placeholder="Full Name" class="demo-input" />
					<input type="email" id="reg-email" placeholder="Email (try alice@example.com)" class="demo-input" />
					<button id="reg-submit" class="btn primary">Create Account</button>
				</div>

				<div class="registration-result" id="reg-result"></div>

				<div class="error-demo-section">
					<h5>Try These Scenarios:</h5>
					<button class="btn small scenario-btn" data-scenario="duplicate">1. Duplicate Email</button>
					<button class="btn small scenario-btn" data-scenario="notfound">2. Missing User</button>
					<button class="btn small scenario-btn" data-scenario="success">3. Success</button>
				</div>

				<div class="demo-log" id="reg-log"></div>
			</div>
		`,
		init: (container, db) => {
			const nameInput = container.querySelector('#reg-name')!
			const emailInput = container.querySelector('#reg-email')!
			const submitBtn = container.querySelector('#reg-submit')!
			const resultEl = container.querySelector('#reg-result')!
			const logEl = container.querySelector('#reg-log')!

			const store = db.store('users')

			function log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
				const entry = document.createElement('div')
				entry.className = `log-entry ${type}`
				entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`
				logEl.insertBefore(entry, logEl.firstChild)
				if (logEl.children.length > 6 && logEl.lastChild) logEl.removeChild(logEl.lastChild)
			}

			function showResult(html: string, success: boolean): void {
				resultEl.innerHTML = `<div class="result-box ${success ? 'success' : 'error'}">${html}</div>`
			}

			async function tryRegister(name: string, email: string): Promise<void> {
				try {
					const existing = await store.index('byEmail').get(email)
					if (existing) {
						log(`Email "${email}" already registered`, 'error')
					}

					const newUser: User = {
						id: `u-${Date.now()}`,
						name,
						email,
						age: 25,
						status: 'active',
						role: 'user',
						tags: [],
						createdAt: Date.now(),
					}

					await store.add(newUser)
					log(`User "${name}" registered!`, 'success')
					showResult(`<h5>✅ Success!</h5><p>Welcome, ${name}!</p>`, true)
				} catch (error) {
					if (error instanceof Error && error.name === 'ConstraintError') {
						log('ConstraintError: Duplicate key', 'error')
						showResult(`<h5>❌ Failed</h5><p>Email "${email}" already exists.</p>`, false)
					} else {
						const message = error instanceof Error ? error.message : 'Unknown'
						log(`Error: ${message}`, 'error')
						showResult(`<h5>❌ Error</h5><p>${message}</p>`, false)
					}
				}
			}

			submitBtn.onclick = (): void => {
				const name = nameInput.value.trim()
				const email = emailInput.value.trim()
				if (!name || !email) {
					log('Please fill all fields', 'error')
					return
				}
				void tryRegister(name, email)
			}

			container.querySelectorAll('.scenario-btn').forEach(btn => {
				const button = btn as HTMLButtonElement
				button.onclick = (): void => {
					const scenario = button.dataset.scenario

					switch (scenario) {
						case 'duplicate':
							nameInput.value = 'Test User'
							emailInput.value = 'alice@example.com'
							void tryRegister('Test User', 'alice@example.com')
							break

						case 'notfound':
							log('Calling resolve() for missing user...', 'info')
							void store.resolve('nonexistent-id').catch((error: unknown) => {
								if (error instanceof Error && error.name === 'NotFoundError') {
									log('NotFoundError: User not found', 'error')
									showResult('<h5>❌ NotFoundError</h5><p>User not found.</p>', false)
								}
							})
							break

						case 'success': {
							const uniqueEmail = `user-${Date.now()}@example.com`
							nameInput.value = 'New User'
							emailInput.value = uniqueEmail
							void tryRegister('New User', uniqueEmail)
							break
						}
					}
				}
			})

			log('Registration demo ready!', 'info')
		},
	}
}
