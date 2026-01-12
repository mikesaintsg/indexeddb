/**
 * Interactive Demos for Showcase
 *
 * Real-world mini-applications demonstrating IndexedDB features
 * with interactive UI elements users can manipulate.
 */

import type { DatabaseInterface, ChangeEvent, Unsubscribe } from '~/src/types.js'
import type { AppSchema, User, Setting } from './types.js'

// ============================================================================
// Demo Result Types
// ============================================================================

export interface InteractiveDemoResult {
	readonly html: string
	readonly init?: (container: HTMLElement, db: DatabaseInterface<AppSchema>) => Promise<void> | void
	readonly cleanup?: () => void
}

// ============================================================================
// Store Operations: Contact Manager Demo
// ============================================================================

export function createContactManagerDemo(): InteractiveDemoResult {
	let cleanup: Unsubscribe | undefined

	return {
		html: `
			<div class="demo-app contact-manager">
				<h4>📇 Contact Manager</h4>
				<p class="demo-desc">Add, edit, and delete contacts using <code>set()</code>, <code>get()</code>, and <code>remove()</code></p>

				<div class="demo-form">
					<input type="text" id="contact-name" placeholder="Name" class="demo-input" />
					<input type="email" id="contact-email" placeholder="Email" class="demo-input" />
					<input type="number" id="contact-age" placeholder="Age" class="demo-input" min="1" max="120" />
					<button id="add-contact-btn" class="btn primary">➕ Add Contact</button>
				</div>

				<div class="demo-stats" id="contact-stats">
					<span class="stat">Total: <strong id="total-contacts">0</strong></span>
					<span class="stat">Active: <strong id="active-contacts">0</strong></span>
				</div>

				<div class="demo-list" id="contact-list">
					<p class="placeholder">Loading contacts...</p>
				</div>

				<div class="demo-log" id="contact-log"></div>
			</div>
		`,
		init: async(container, db) => {
			const store = db.store('users')
			const listEl = container.querySelector('#contact-list')!
			const logEl = container.querySelector('#contact-log')!
			const totalEl = container.querySelector('#total-contacts')!
			const activeEl = container.querySelector('#active-contacts')!
			const nameInput = container.querySelector('#contact-name')!
			const emailInput = container.querySelector('#contact-email')!
			const ageInput = container.querySelector('#contact-age')!
			const addBtn = container.querySelector('#add-contact-btn')!

			function log(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
				const entry = document.createElement('div')
				entry.className = `log-entry ${type}`
				entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`
				logEl.insertBefore(entry, logEl.firstChild)
				if (logEl.children.length > 5 && logEl.lastChild) logEl.removeChild(logEl.lastChild)
			}

			async function refreshList(): Promise<void> {
				const users = await store.all()
				const activeCount = users.filter(u => u.status === 'active').length

				totalEl.textContent = String(users.length)
				activeEl.textContent = String(activeCount)

				if (users.length === 0) {
					listEl.innerHTML = '<p class="placeholder">No contacts yet. Add one above!</p>'
					return
				}

				listEl.innerHTML = users.map(user => `
					<div class="list-item" data-id="${user.id}">
						<div class="item-info">
							<strong>${user.name}</strong>
							<span class="item-meta">${user.email} • Age ${user.age} • ${user.status}</span>
						</div>
						<div class="item-actions">
							<button class="btn small toggle-status" data-id="${user.id}" title="Toggle Status">
								${user.status === 'active' ? '✅' : '❌'}
							</button>
							<button class="btn small danger delete-contact" data-id="${user.id}" title="Delete">🗑️</button>
						</div>
					</div>
				`).join('')

				// Attach event handlers
				listEl.querySelectorAll('.toggle-status').forEach(btn => {
					const button = btn as HTMLButtonElement
					button.onclick = (): void => {
						const id = button.dataset.id ?? ''
						void store.get(id).then(async(user) => {
							if (user) {
								const updated: User = { ...user, status: user.status === 'active' ? 'inactive' : 'active' }
								await store.set(updated)
								log(`set() - Toggled ${user.name} to ${updated.status}`, 'success')
							}
						}).catch((err: unknown) => {
							log(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
						})
					}
				})

				listEl.querySelectorAll('.delete-contact').forEach(btn => {
					const button = btn as HTMLButtonElement
					button.onclick = (): void => {
						const id = button.dataset.id ?? ''
						void store.get(id).then(async(user) => {
							await store.remove(id)
							log(`remove() - Deleted ${user?.name ?? id}`, 'success')
						}).catch((err: unknown) => {
							log(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
						})
					}
				})
			}

			// Add contact handler
			addBtn.onclick = (): void => {
				const name = nameInput.value.trim()
				const email = emailInput.value.trim()
				const age = parseInt(ageInput.value, 10)

				if (!name || !email || isNaN(age)) {
					log('Please fill all fields', 'error')
					return
				}

				const newUser: User = {
					id: `u-${Date.now()}`,
					name,
					email,
					age,
					status: 'active',
					role: 'user',
					tags: [],
					createdAt: Date.now(),
				}

				void store.set(newUser).then(() => {
					log(`set() - Added "${name}"`, 'success')
					nameInput.value = ''
					emailInput.value = ''
					ageInput.value = ''
				})
			}

			// Listen for changes
			cleanup = store.onChange(() => {
				void refreshList()
			})

			await refreshList()
			log('Contact Manager ready!', 'info')
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
// Events: Live Activity Monitor Demo
// ============================================================================

export function createActivityMonitorDemo(): InteractiveDemoResult {
	let cleanup: Unsubscribe | undefined

	return {
		html: `
			<div class="demo-app activity-monitor">
				<h4>📡 Live Activity Monitor</h4>
				<p class="demo-desc">Watch <code>onChange</code> events in real-time as data changes</p>

				<div class="monitor-controls">
					<button id="add-random-btn" class="btn primary">➕ Add User</button>
					<button id="update-random-btn" class="btn">✏️ Update User</button>
					<button id="delete-random-btn" class="btn danger">🗑️ Delete User</button>
				</div>

				<div class="monitor-stats">
					<span class="stat">Events: <strong id="event-count">0</strong></span>
					<span class="stat">Last: <strong id="last-event-type">-</strong></span>
				</div>

				<div class="event-feed" id="event-feed">
					<p class="placeholder">Waiting for events...</p>
				</div>

				<p class="demo-tip">💡 Open in another tab to see cross-tab sync!</p>
			</div>
		`,
		init: (container, db) => {
			const feedEl = container.querySelector('#event-feed')!
			const eventCountEl = container.querySelector('#event-count')!
			const lastEventTypeEl = container.querySelector('#last-event-type')!
			const addBtn = container.querySelector('#add-random-btn')!
			const updateBtn = container.querySelector('#update-random-btn')!
			const deleteBtn = container.querySelector('#delete-random-btn')!

			const store = db.store('users')
			let eventCount = 0
			let isFirstEvent = true

			function addEvent(event: ChangeEvent): void {
				eventCount++
				eventCountEl.textContent = String(eventCount)
				lastEventTypeEl.textContent = event.type

				if (isFirstEvent) {
					feedEl.innerHTML = ''
					isFirstEvent = false
				}

				const entry = document.createElement('div')
				entry.className = `event-entry event-${event.type}`
				const crossTabBadge = event.source === 'remote' ? '<span class="event-cross-tab">📡 Cross-Tab</span>' : ''
				entry.innerHTML = `
					<span class="event-time">${new Date().toLocaleTimeString()}</span>
					<span class="event-badge ${event.type}">${event.type.toUpperCase()}</span>
					<span class="event-store">${event.storeName}</span>
					<span class="event-keys">Keys: ${JSON.stringify(event.keys)}</span>
					${crossTabBadge}
				`
				feedEl.insertBefore(entry, feedEl.firstChild)

				while (feedEl.children.length > 10 && feedEl.lastChild) {
					feedEl.removeChild(feedEl.lastChild)
				}
			}

			cleanup = db.onChange((event) => {
				addEvent(event)
			})

			const names = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley']
			const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones']

			addBtn.onclick = (): void => {
				const firstName = names[Math.floor(Math.random() * names.length)]
				const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
				const name = `${firstName} ${lastName}`
				const newUser: User = {
					id: `u-${Date.now()}`,
					name,
					email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
					age: 20 + Math.floor(Math.random() * 40),
					status: 'active',
					role: 'user',
					tags: [],
					createdAt: Date.now(),
				}
				void store.set(newUser).catch(() => { /* ignore */ })
			}

			updateBtn.onclick = (): void => {
				void store.all().then(async(users) => {
					if (users.length === 0) return
					const user = users[Math.floor(Math.random() * users.length)]
					if (user) {
						const updated: User = { ...user, age: user.age + 1 }
						await store.set(updated)
					}
				}).catch(() => { /* ignore */ })
			}

			deleteBtn.onclick = (): void => {
				void store.all().then(async(users) => {
					if (users.length === 0) return
					const user = users[Math.floor(Math.random() * users.length)]
					if (user) {
						await store.remove(user.id)
					}
				}).catch(() => { /* ignore */ })
			}
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
						const total = await store.count()
						const records: unknown[] = []
						let processed = 0

						log(`Exporting ${total} records from "${storeName}"...`)
						const startTime = performance.now()

						for await (const record of store.iterate()) {
							records.push(record)
							processed++

							const percent = Math.round((processed / total) * 100)
							progressFill.style.width = `${percent}%`
							progressText.textContent = `${processed} / ${total}`

							if (processed % 2 === 0) {
								await new Promise(r => setTimeout(r, 30))
							}
						}

						const elapsed = Math.round(performance.now() - startTime)
						log(`Completed: ${processed} records in ${elapsed}ms`, 'success')

						let output: string
						if (format === 'json') {
							output = JSON.stringify(records, null, 2)
						} else {
							if (records.length === 0) {
								output = '(no data)'
							} else {
								const firstRecord = records[0] as Record<string, unknown>
								const headers = Object.keys(firstRecord)
								const rows = records.map(r => {
									const rec = r as Record<string, unknown>
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

			const index = db.store('users').index('byEmail')

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
				})
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
