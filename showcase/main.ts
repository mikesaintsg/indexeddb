/**
 * IndexedDB Showcase
 *
 * Demonstrates all major features of the @mikesaintsg/indexeddb library
 * through interactive examples with sensible defaults.
 */

import './styles.css'
import { createDatabase } from '~/src/index.js'
import type { DatabaseSchema, ChangeEvent } from '~/src/types.js'

// ============================================================================
// Schema Definition
// ============================================================================

interface Todo {
	readonly id: string
	readonly title: string
	readonly completed: boolean
	readonly priority: 'low' | 'medium' | 'high'
	readonly createdAt: number
}

interface Note {
	readonly id: string
	readonly title: string
	readonly content: string
	readonly color: string
	readonly updatedAt: number
}

interface AppSchema extends DatabaseSchema {
	readonly todos: Todo
	readonly notes: Note
}

// ============================================================================
// Sample Data
// ============================================================================

const SAMPLE_TODOS: readonly Todo[] = [
	{ id: 't1', title: 'Learn IndexedDB basics', completed: true, priority: 'high', createdAt: Date.now() - 86400000 * 3 },
	{ id: 't2', title: 'Build a todo app', completed: true, priority: 'high', createdAt: Date.now() - 86400000 * 2 },
	{ id: 't3', title: 'Implement cross-tab sync', completed: false, priority: 'medium', createdAt: Date.now() - 86400000 },
	{ id: 't4', title: 'Write documentation', completed: false, priority: 'medium', createdAt: Date.now() - 3600000 },
	{ id: 't5', title: 'Add more examples', completed: false, priority: 'low', createdAt: Date.now() },
]

const SAMPLE_NOTES: readonly Note[] = [
	{ id: 'n1', title: 'Meeting Notes', content: 'Discuss Q4 goals and roadmap', color: '#fff3cd', updatedAt: Date.now() - 86400000 },
	{ id: 'n2', title: 'Shopping List', content: 'Milk, Bread, Eggs, Coffee', color: '#d1ecf1', updatedAt: Date.now() - 3600000 },
	{ id: 'n3', title: 'Ideas', content: 'New project concepts for 2026', color: '#d4edda', updatedAt: Date.now() - 1800000 },
	{ id: 'n4', title: 'Reminders', content: 'Call dentist, Pay bills', color: '#f8d7da', updatedAt: Date.now() },
]

// ============================================================================
// Database Setup
// ============================================================================

const db = createDatabase<AppSchema>({
	name: 'showcase-app',
	version: 1,
	stores: {
		todos: {
			indexes: [
				{ name: 'byCompleted', keyPath: 'completed' },
				{ name: 'byPriority', keyPath: 'priority' },
				{ name: 'byCreatedAt', keyPath: 'createdAt' },
			],
		},
		notes: {
			indexes: [
				{ name: 'byColor', keyPath: 'color' },
				{ name: 'byUpdatedAt', keyPath: 'updatedAt' },
			],
		},
	},
	crossTabSync: true,
})

// ============================================================================
// App State
// ============================================================================

let activeTab: 'todos' | 'notes' | 'query' | 'events' = 'todos'
const eventLog: ChangeEvent[] = []

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
	return Math.random().toString(36).slice(2, 11)
}

function escapeHtml(text: string): string {
	const div = document.createElement('div')
	div.textContent = text
	return div.innerHTML
}

function formatTime(timestamp: number): string {
	const date = new Date(timestamp)
	return date.toLocaleString()
}

function getPriorityEmoji(priority: string): string {
	switch (priority) {
		case 'high': return '🔴'
		case 'medium': return '🟡'
		case 'low': return '🟢'
		default: return '⚪'
	}
}

// ============================================================================
// Event Logging
// ============================================================================

function setupEventLogging(): void {
	db.onChange((event) => {
		eventLog.unshift(event)
		if (eventLog.length > 100) eventLog.pop()
		updateEventLogUI()
	})
}

function updateEventLogUI(): void {
	const logEl = document.getElementById('event-log-content')
	if (!logEl) return

	if (eventLog.length === 0) {
		logEl.innerHTML = '<p class="placeholder">No events yet. Make some changes!</p>'
		return
	}

	logEl.innerHTML = `<ul class="event-list">
		${eventLog.slice(0, 20).map((e) => {
		const time = new Date().toLocaleTimeString()
		const cls = e.source === 'remote' ? 'remote' : 'local'
		return `<li class="${cls}">
				<span class="event-time">${time}</span>
				<span class="event-source">${e.source.toUpperCase()}</span>
				<span class="event-type">${e.type}</span>
				<span class="event-store">${e.storeName}</span>
				<span class="event-keys">[${e.keys.slice(0, 3).join(', ')}${e.keys.length > 3 ? '...' : ''}]</span>
			</li>`
	}).join('')}
	</ul>`
}

// ============================================================================
// Rendering Functions
// ============================================================================

function render(): void {
	const app = document.getElementById('app')
	if (!app) return

	app.innerHTML = `
		<div class="container">
			<header>
				<h1>🗄️ IndexedDB Showcase</h1>
				<p>Interactive demo of @mikesaintsg/indexeddb features</p>
			</header>

			<nav class="tabs">
				<button class="tab ${activeTab === 'todos' ? 'active' : ''}" data-tab="todos">📋 Todos</button>
				<button class="tab ${activeTab === 'notes' ? 'active' : ''}" data-tab="notes">📝 Notes</button>
				<button class="tab ${activeTab === 'query' ? 'active' : ''}" data-tab="query">🔍 Query Builder</button>
				<button class="tab ${activeTab === 'events' ? 'active' : ''}" data-tab="events">📡 Live Events</button>
			</nav>

			<main id="content"></main>

			<footer>
				<p>💡 Open this page in another tab to see cross-tab sync in action!</p>
			</footer>
		</div>
	`

	renderContent()
	attachEventListeners()
}

function renderContent(): void {
	const content = document.getElementById('content')
	if (!content) return

	switch (activeTab) {
		case 'todos':
			content.innerHTML = renderTodosTab()
			void loadTodos()
			break
		case 'notes':
			content.innerHTML = renderNotesTab()
			void loadNotes()
			break
		case 'query':
			content.innerHTML = renderQueryTab()
			break
		case 'events':
			content.innerHTML = renderEventsTab()
			break
	}
}

function renderTodosTab(): string {
	return `
		<section class="card">
			<h2>Todo List — CRUD Operations</h2>
			<p class="subtitle">Demonstrates: <code>add()</code>, <code>set()</code>, <code>get()</code>, <code>remove()</code>, <code>all()</code></p>

			<div class="form-row">
				<input type="text" id="todo-title" placeholder="What needs to be done?" />
				<select id="todo-priority">
					<option value="low">🟢 Low</option>
					<option value="medium" selected>🟡 Medium</option>
					<option value="high">🔴 High</option>
				</select>
				<button id="add-todo" class="btn primary">Add Todo</button>
			</div>

			<div class="action-row">
				<button id="load-samples" class="btn secondary">Load Sample Todos</button>
				<button id="clear-completed" class="btn warning">Clear Completed</button>
				<button id="clear-todos" class="btn danger">Clear All</button>
			</div>

			<div class="filter-row">
				<button class="filter-btn active" data-filter="all">All</button>
				<button class="filter-btn" data-filter="active">Active</button>
				<button class="filter-btn" data-filter="completed">Completed</button>
			</div>

			<div id="todo-list" class="todo-list">
				<div class="loading">Loading...</div>
			</div>

			<div class="stats" id="todo-stats"></div>
		</section>
	`
}

function renderNotesTab(): string {
	return `
		<section class="card">
			<h2>Sticky Notes — Batch Operations & Transactions</h2>
			<p class="subtitle">Demonstrates: <code>set([...])</code> batching, <code>db.write()</code> transactions</p>

			<div class="form-row">
				<input type="text" id="note-title" placeholder="Note title" />
				<input type="text" id="note-content" placeholder="Note content" />
				<select id="note-color">
					<option value="#fff3cd">🟡 Yellow</option>
					<option value="#d1ecf1">🔵 Blue</option>
					<option value="#d4edda">🟢 Green</option>
					<option value="#f8d7da">🔴 Pink</option>
				</select>
				<button id="add-note" class="btn primary">Add Note</button>
			</div>

			<div class="action-row">
				<button id="load-sample-notes" class="btn secondary">Load Sample Notes (Batch)</button>
				<button id="clear-notes" class="btn danger">Clear All (Transaction)</button>
			</div>

			<div id="notes-grid" class="notes-grid">
				<div class="loading">Loading...</div>
			</div>
		</section>
	`
}

function renderQueryTab(): string {
	return `
		<section class="card">
			<h2>Query Builder — Advanced Queries</h2>
			<p class="subtitle">Demonstrates: <code>query()</code>, <code>where()</code>, <code>filter()</code>, <code>limit()</code>, <code>offset()</code></p>

			<div class="query-builder">
				<div class="query-row">
					<label>Filter by Priority:</label>
					<select id="query-priority">
						<option value="">All Priorities</option>
						<option value="high">🔴 High Only</option>
						<option value="medium">🟡 Medium Only</option>
						<option value="low">🟢 Low Only</option>
					</select>
				</div>

				<div class="query-row">
					<label>Status:</label>
					<select id="query-status">
						<option value="">All Status</option>
						<option value="active">Active Only</option>
						<option value="completed">Completed Only</option>
					</select>
				</div>

				<div class="query-row">
					<label>Pagination:</label>
					<input type="number" id="query-limit" value="3" min="1" max="20" />
					<span>items per page</span>
					<button id="prev-page" class="btn small">← Prev</button>
					<span id="page-info">Page 1</span>
					<button id="next-page" class="btn small">Next →</button>
				</div>

				<button id="run-query" class="btn primary">Run Query</button>
			</div>

			<div id="query-results" class="query-results">
				<p class="placeholder">Click "Run Query" to see results</p>
			</div>

			<div class="code-section">
				<h3>Generated Code</h3>
				<div id="query-code" class="code-block">
					<pre><code>// Query code will appear here</code></pre>
				</div>
			</div>
		</section>
	`
}

function renderEventsTab(): string {
	return `
		<section class="card">
			<h2>Live Events — Cross-Tab Synchronization</h2>
			<p class="subtitle">Demonstrates: <code>onChange()</code>, <code>BroadcastChannel</code> sync</p>

			<div class="info-box">
				<p>📡 <strong>Open this page in another browser tab</strong> and make changes.
				You'll see events appear here in real-time!</p>
				<p>🔵 <strong>LOCAL</strong> events are from this tab. 🟠 <strong>REMOTE</strong> events are from other tabs.</p>
			</div>

			<div class="action-row">
				<button id="trigger-add" class="btn secondary">Trigger Add Event</button>
				<button id="trigger-set" class="btn secondary">Trigger Set Event</button>
				<button id="trigger-remove" class="btn secondary">Trigger Remove Event</button>
				<button id="clear-log" class="btn danger">Clear Log</button>
			</div>

			<div id="event-log-content" class="event-log">
				<p class="placeholder">No events yet. Make some changes!</p>
			</div>
		</section>
	`
}

// ============================================================================
// Data Loading Functions
// ============================================================================

async function loadTodos(filter: 'all' | 'active' | 'completed' = 'all'): Promise<void> {
	const listEl = document.getElementById('todo-list')
	const statsEl = document.getElementById('todo-stats')
	if (!listEl) return

	try {
		const allTodos = await db.store('todos').all()

		let todos: readonly Todo[]
		if (filter === 'all') {
			todos = allTodos
		} else if (filter === 'completed') {
			todos = allTodos.filter((t) => t.completed)
		} else {
			todos = allTodos.filter((t) => !t.completed)
		}

		// Sort by createdAt descending
		const sorted = [...todos].sort((a, b) => b.createdAt - a.createdAt)

		if (sorted.length === 0) {
			listEl.innerHTML = `<p class="empty">${filter === 'all' ? 'No todos yet. Add one above or load samples!' : `No ${filter} todos.`}</p>`
		} else {
			listEl.innerHTML = sorted.map((todo) => `
				<div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
					<input type="checkbox" ${todo.completed ? 'checked' : ''} class="todo-toggle" />
					<span class="priority">${getPriorityEmoji(todo.priority)}</span>
					<span class="todo-title">${escapeHtml(todo.title)}</span>
					<span class="todo-date">${formatTime(todo.createdAt)}</span>
					<button class="delete-btn" title="Delete">×</button>
				</div>
			`).join('')
		}

		// Update stats
		const completed = allTodos.filter((t) => t.completed).length
		if (statsEl) {
			statsEl.innerHTML = `
				<span>📊 Total: <strong>${allTodos.length}</strong></span>
				<span>✅ Completed: <strong>${completed}</strong></span>
				<span>⏳ Active: <strong>${allTodos.length - completed}</strong></span>
			`
		}
	} catch (error) {
		listEl.innerHTML = `<p class="error">Error loading todos: ${String(error)}</p>`
	}
}

async function loadNotes(): Promise<void> {
	const gridEl = document.getElementById('notes-grid')
	if (!gridEl) return

	try {
		const notes = await db.store('notes').all()
		const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)

		if (sorted.length === 0) {
			gridEl.innerHTML = '<p class="empty">No notes yet. Add one above or load samples!</p>'
		} else {
			gridEl.innerHTML = sorted.map((note) => `
				<div class="note-card" style="background-color: ${note.color}" data-id="${note.id}">
					<h3>${escapeHtml(note.title)}</h3>
					<p>${escapeHtml(note.content)}</p>
					<div class="note-footer">
						<span>${formatTime(note.updatedAt)}</span>
						<button class="delete-note-btn" title="Delete">×</button>
					</div>
				</div>
			`).join('')
		}
	} catch (error) {
		gridEl.innerHTML = `<p class="error">Error loading notes: ${String(error)}</p>`
	}
}

// ============================================================================
// Event Handlers
// ============================================================================

function attachEventListeners(): void {
	// Tab navigation
	document.querySelectorAll('.tab').forEach((tab) => {
		tab.addEventListener('click', (e) => {
			const target = e.currentTarget as HTMLElement
			activeTab = target.dataset.tab as typeof activeTab
			render()
		})
	})

	// Tab-specific handlers
	switch (activeTab) {
		case 'todos':
			attachTodoHandlers()
			break
		case 'notes':
			attachNoteHandlers()
			break
		case 'query':
			attachQueryHandlers()
			break
		case 'events':
			attachEventHandlers()
			updateEventLogUI()
			break
	}
}

function attachTodoHandlers(): void {
	// Add todos
	const addTodo = async(): Promise<void> => {
		const titleInput = document.getElementById('todo-title') as HTMLInputElement
		const prioritySelect = document.getElementById('todo-priority') as HTMLSelectElement

		const title = titleInput.value.trim()
		if (!title) return

		await db.store('todos').add({
			id: generateId(),
			title,
			completed: false,
			priority: prioritySelect.value as Todo['priority'],
			createdAt: Date.now(),
		})

		titleInput.value = ''
		void loadTodos()
	}

	document.getElementById('add-todo')?.addEventListener('click', () => void addTodo())
	document.getElementById('todo-title')?.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') void addTodo()
	})

	// Load samples
	document.getElementById('load-samples')?.addEventListener('click', async() => {
		await db.store('todos').set([...SAMPLE_TODOS])
		void loadTodos()
	})

	// Clear completed
	document.getElementById('clear-completed')?.addEventListener('click', async() => {
		const todos = await db.store('todos').all()
		const completedIds = todos.filter((t) => t.completed).map((t) => t.id)
		if (completedIds.length > 0) {
			await db.store('todos').remove(completedIds)
		}
		void loadTodos()
	})

	// Clear all
	document.getElementById('clear-todos')?.addEventListener('click', async() => {
		await db.store('todos').clear()
		void loadTodos()
	})

	// Filter buttons
	document.querySelectorAll('.filter-btn').forEach((btn) => {
		btn.addEventListener('click', (e) => {
			const target = e.currentTarget as HTMLElement
			document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'))
			target.classList.add('active')
			void loadTodos(target.dataset.filter as 'all' | 'active' | 'completed')
		})
	})

	// Toggle and delete (event delegation)
	document.getElementById('todo-list')?.addEventListener('click', async(e) => {
		const target = e.target as HTMLElement
		const todoItem = target.closest('.todo-item') as HTMLElement | null
		if (!todoItem) return

		const id = todoItem.dataset.id
		if (!id) return

		if (target.classList.contains('todo-toggle')) {
			const todo = await db.store('todos').get(id)
			if (todo) {
				await db.store('todos').set({ ...todo, completed: !todo.completed })
				void loadTodos()
			}
		} else if (target.classList.contains('delete-btn')) {
			await db.store('todos').remove(id)
			void loadTodos()
		}
	})
}

function attachNoteHandlers(): void {
	// Add note
	const addNote = async(): Promise<void> => {
		const titleInput = document.getElementById('note-title') as HTMLInputElement
		const contentInput = document.getElementById('note-content') as HTMLInputElement
		const colorSelect = document.getElementById('note-color') as HTMLSelectElement

		const title = titleInput.value.trim() || 'Untitled'
		const content = contentInput.value.trim() || ''

		await db.store('notes').add({
			id: generateId(),
			title,
			content,
			color: colorSelect.value,
			updatedAt: Date.now(),
		})

		titleInput.value = ''
		contentInput.value = ''
		void loadNotes()
	}

	document.getElementById('add-note')?.addEventListener('click', () => void addNote())

	// Load sample notes (batch operation)
	document.getElementById('load-sample-notes')?.addEventListener('click', async() => {
		// Batch operation - single transaction
		await db.store('notes').set([...SAMPLE_NOTES])
		void loadNotes()
	})

	// Clear all notes (transaction demo)
	document.getElementById('clear-notes')?.addEventListener('click', async() => {
		await db.write('notes', async(tx) => {
			await tx.store('notes').clear()
		})
		void loadNotes()
	})

	// Delete note (event delegation)
	document.getElementById('notes-grid')?.addEventListener('click', async(e) => {
		const target = e.target as HTMLElement
		if (!target.classList.contains('delete-note-btn')) return

		const noteCard = target.closest('.note-card') as HTMLElement | null
		if (!noteCard?.dataset.id) return

		await db.store('notes').remove(noteCard.dataset.id)
		void loadNotes()
	})
}

let currentPage = 0
let lastQueryTotal = 0

function attachQueryHandlers(): void {
	const runQuery = async(): Promise<void> => {
		const prioritySelect = document.getElementById('query-priority') as HTMLSelectElement
		const statusSelect = document.getElementById('query-status') as HTMLSelectElement
		const limitInput = document.getElementById('query-limit') as HTMLInputElement
		const resultsEl = document.getElementById('query-results')
		const codeEl = document.getElementById('query-code')

		const priority = prioritySelect.value
		const status = statusSelect.value
		const limit = parseInt(limitInput.value, 10) || 3

		// Build query
		let query = db.store('todos').query()
		const codeLines: string[] = ["db.store('todos').query()"]

		if (priority) {
			query = query.where('byPriority').equals(priority)
			codeLines.push(`  .where('byPriority').equals('${priority}')`)
		}

		if (status) {
			const isCompleted = status === 'completed'
			query = query.filter((t) => t.completed === isCompleted)
			codeLines.push(`  .filter(t => t.completed === ${String(isCompleted)})`)
		}

		// Get total before pagination
		const allResults = await query.toArray()
		lastQueryTotal = allResults.length

		// Apply pagination
		query = db.store('todos').query()
		if (priority) query = query.where('byPriority').equals(priority)
		if (status) {
			const isCompleted = status === 'completed'
			query = query.filter((t) => t.completed === isCompleted)
		}
		query = query.limit(limit).offset(currentPage * limit)
		codeLines.push(`  .limit(${limit}).offset(${currentPage * limit})`)
		codeLines.push('  .toArray()')

		// Execute and display
		const results = await query.toArray()

		if (resultsEl) {
			if (results.length === 0 && currentPage === 0) {
				resultsEl.innerHTML = '<p class="empty">No results found. Try loading sample todos first!</p>'
			} else if (results.length === 0) {
				resultsEl.innerHTML = '<p class="empty">No more results on this page.</p>'
			} else {
				resultsEl.innerHTML = `
					<table>
						<thead>
							<tr>
								<th>Title</th>
								<th>Priority</th>
								<th>Status</th>
								<th>Created</th>
							</tr>
						</thead>
						<tbody>
							${results.map((todo) => `
								<tr class="${todo.completed ? 'completed' : ''}">
									<td>${escapeHtml(todo.title)}</td>
									<td>${getPriorityEmoji(todo.priority)} ${todo.priority}</td>
									<td>${todo.completed ? '✅ Done' : '⏳ Active'}</td>
									<td>${formatTime(todo.createdAt)}</td>
								</tr>
							`).join('')}
						</tbody>
					</table>
					<p class="result-count">Showing ${results.length} of ${lastQueryTotal} total results</p>
				`
			}
		}

		// Update page info
		const pageInfo = document.getElementById('page-info')
		if (pageInfo) {
			const totalPages = Math.ceil(lastQueryTotal / limit) || 1
			pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`
		}

		// Display generated code
		if (codeEl) {
			codeEl.innerHTML = `<pre><code>${codeLines.join('\n')}</code></pre>`
		}
	}

	document.getElementById('run-query')?.addEventListener('click', () => {
		currentPage = 0
		void runQuery()
	})
	document.getElementById('prev-page')?.addEventListener('click', () => {
		if (currentPage > 0) {
			currentPage--
			void runQuery()
		}
	})
	document.getElementById('next-page')?.addEventListener('click', () => {
		currentPage++
		void runQuery()
	})

	// Auto-run initial query
	void runQuery()
}

function attachEventHandlers(): void {
	document.getElementById('trigger-add')?.addEventListener('click', async() => {
		await db.store('todos').add({
			id: generateId(),
			title: `Event Test ${new Date().toLocaleTimeString()}`,
			completed: false,
			priority: 'low',
			createdAt: Date.now(),
		})
	})

	document.getElementById('trigger-set')?.addEventListener('click', async() => {
		const todos = await db.store('todos').all()
		if (todos.length > 0) {
			const todo = todos[0]
			if (todo) {
				await db.store('todos').set({ ...todo, title: `Updated ${new Date().toLocaleTimeString()}` })
			}
		} else {
			await db.store('todos').set({
				id: generateId(),
				title: `Set Event ${new Date().toLocaleTimeString()}`,
				completed: false,
				priority: 'medium',
				createdAt: Date.now(),
			})
		}
	})

	document.getElementById('trigger-remove')?.addEventListener('click', async() => {
		const todos = await db.store('todos').all()
		if (todos.length > 0 && todos[0]) {
			await db.store('todos').remove(todos[0].id)
		}
	})

	document.getElementById('clear-log')?.addEventListener('click', () => {
		eventLog.length = 0
		updateEventLogUI()
	})
}

// ============================================================================
// Initialize App
// ============================================================================

setupEventLogging()
render()

