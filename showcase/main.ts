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
// Element References
// ============================================================================

interface AppElements {
	container: HTMLDivElement
	header: HTMLElement
	nav: HTMLElement
	content: HTMLElement
	footer: HTMLElement
}

interface TodoElements {
	titleInput: HTMLInputElement
	prioritySelect: HTMLSelectElement
	addButton: HTMLButtonElement
	loadSamplesButton: HTMLButtonElement
	clearCompletedButton: HTMLButtonElement
	clearAllButton: HTMLButtonElement
	filterAllButton: HTMLButtonElement
	filterActiveButton: HTMLButtonElement
	filterCompletedButton: HTMLButtonElement
	listContainer: HTMLDivElement
	stats: HTMLDivElement
}

interface NoteElements {
	titleInput: HTMLInputElement
	contentInput: HTMLInputElement
	colorSelect: HTMLSelectElement
	addButton: HTMLButtonElement
	loadSamplesButton: HTMLButtonElement
	clearAllButton: HTMLButtonElement
	grid: HTMLDivElement
}

interface QueryElements {
	prioritySelect: HTMLSelectElement
	statusSelect: HTMLSelectElement
	limitInput: HTMLInputElement
	prevButton: HTMLButtonElement
	nextButton: HTMLButtonElement
	pageInfo: HTMLSpanElement
	runButton: HTMLButtonElement
	results: HTMLDivElement
	codeBlock: HTMLElement
}

interface EventsElements {
	triggerAddButton: HTMLButtonElement
	triggerSetButton: HTMLButtonElement
	triggerRemoveButton: HTMLButtonElement
	clearLogButton: HTMLButtonElement
	logContent: HTMLDivElement
}

let appElements: AppElements | null = null
let todoElements: TodoElements | null = null
let noteElements: NoteElements | null = null
let queryElements: QueryElements | null = null
let eventsElements: EventsElements | null = null

// ============================================================================
// Utility Functions
// ============================================================================

function generateId(): string {
	return Math.random().toString(36).slice(2, 11)
}

function createElement<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options?: {
		className?: string
		textContent?: string
		id?: string
		type?: string
		placeholder?: string
		value?: string
		min?: string
		max?: string
		dataset?: Record<string, string>
	},
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag)
	if (options?.className) element.className = options.className
	if (options?.textContent) element.textContent = options.textContent
	if (options?.id) element.id = options.id
	if (options?.type && 'type' in element) (element as HTMLInputElement).type = options.type
	if (options?.placeholder && 'placeholder' in element) (element as HTMLInputElement).placeholder = options.placeholder
	if (options?.value && 'value' in element) (element as HTMLInputElement).value = options.value
	if (options?.min && 'min' in element) (element as HTMLInputElement).min = options.min
	if (options?.max && 'max' in element) (element as HTMLInputElement).max = options.max
	if (options?.dataset) {
		Object.entries(options.dataset).forEach(([key, value]) => {
			element.dataset[key] = value
		})
	}
	return element
}

function createOption(value: string, text: string, selected = false): HTMLOptionElement {
	const option = createElement('option', { value, textContent: text })
	option.selected = selected
	return option
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
	if (!eventsElements) return

	const { logContent } = eventsElements

	// Clear existing content
	logContent.innerHTML = ''

	if (eventLog.length === 0) {
		const placeholder = createElement('p', {
			className: 'placeholder',
			textContent: 'No events yet. Make some changes!',
		})
		logContent.appendChild(placeholder)
		return
	}

	const list = createElement('ul', { className: 'event-list' })

	eventLog.slice(0, 20).forEach((e) => {
		const time = new Date().toLocaleTimeString()
		const cls = e.source === 'remote' ? 'remote' : 'local'

		const li = createElement('li', { className: cls })

		const timeSpan = createElement('span', {
			className: 'event-time',
			textContent: time,
		})

		const sourceSpan = createElement('span', {
			className: 'event-source',
			textContent: e.source.toUpperCase(),
		})

		const typeSpan = createElement('span', {
			className: 'event-type',
			textContent: e.type,
		})

		const storeSpan = createElement('span', {
			className: 'event-store',
			textContent: e.storeName,
		})

		const keysText = e.keys.slice(0, 3).map(k => {
			if (typeof k === 'string') return k
			if (typeof k === 'number') return String(k)
			if (k instanceof Date) return k.toISOString()
			return JSON.stringify(k)
		}).join(', ')
		const keysSpan = createElement('span', {
			className: 'event-keys',
			textContent: `[${keysText}${e.keys.length > 3 ? '...' : ''}]`,
		})

		li.append(timeSpan, sourceSpan, typeSpan, storeSpan, keysSpan)
		list.appendChild(li)
	})

	logContent.appendChild(list)
}

// ============================================================================
// Rendering Functions
// ============================================================================

function createAppStructure(): AppElements {
	const container = createElement('div', { className: 'container' })

	// Header
	const header = createElement('header')
	const h1 = createElement('h1', { textContent: '🗄️ IndexedDB Showcase' })
	const p = createElement('p', { textContent: 'Interactive demo of @mikesaintsg/indexeddb features' })
	header.append(h1, p)

	// Navigation
	const nav = createElement('nav', { className: 'tabs' })

	// Content area
	const content = createElement('main', { id: 'content' })

	// Footer
	const footer = createElement('footer')
	const footerP = createElement('p', {
		textContent: '💡 Open this page in another tab to see cross-tab sync in action!',
	})
	footer.appendChild(footerP)

	container.append(header, nav, content, footer)

	return { container, header, nav, content, footer }
}

function createTabButtons(elements: AppElements): void {
	const { nav } = elements

	const tabs: { id: typeof activeTab; emoji: string; label: string }[] = [
		{ id: 'todos', emoji: '📋', label: 'Todos' },
		{ id: 'notes', emoji: '📝', label: 'Notes' },
		{ id: 'query', emoji: '🔍', label: 'Query Builder' },
		{ id: 'events', emoji: '📡', label: 'Live Events' },
	]

	tabs.forEach(({ id, emoji, label }) => {
		const button = createElement('button', {
			className: `tab ${activeTab === id ? 'active' : ''}`,
			textContent: `${emoji} ${label}`,
		})
		button.dataset.tab = id
		button.addEventListener('click', () => {
			activeTab = id
			render()
		})
		nav.appendChild(button)
	})
}

function render(): void {
	const app = document.getElementById('app')
	if (!app) return

	// Clear and create structure if needed
	if (!appElements) {
		app.innerHTML = ''
		appElements = createAppStructure()
		createTabButtons(appElements)
		app.appendChild(appElements.container)
	} else {
		// Update tab active states
		const tabs = appElements.nav.querySelectorAll('.tab')
		tabs.forEach(tab => {
			const btn = tab as HTMLButtonElement
			btn.classList.toggle('active', btn.dataset.tab === activeTab)
		})
	}

	renderContent()
}

function renderContent(): void {
	if (!appElements) return
	const { content } = appElements

	content.innerHTML = ''

	switch (activeTab) {
		case 'todos':
			renderTodosTab(content)
			break
		case 'notes':
			renderNotesTab(content)
			break
		case 'query':
			renderQueryTab(content)
			break
		case 'events':
			renderEventsTab(content)
			break
	}
}

function renderTodosTab(content: HTMLElement): void {
	const section = createElement('section', { className: 'card' })

	// Header
	const h2 = createElement('h2', { textContent: 'Todo List — CRUD Operations' })
	const subtitle = createElement('p', { className: 'subtitle' })
	subtitle.innerHTML = 'Demonstrates: <code>add()</code>, <code>set()</code>, <code>get()</code>, <code>remove()</code>, <code>all()</code>'

	// Form row
	const formRow = createElement('div', { className: 'form-row' })
	const titleInput = createElement('input', {
		type: 'text',
		id: 'todo-title',
		placeholder: 'What needs to be done?',
	})
	const prioritySelect = createElement('select', { id: 'todo-priority' })
	prioritySelect.append(
		createOption('low', '🟢 Low'),
		createOption('medium', '🟡 Medium', true),
		createOption('high', '🔴 High'),
	)
	const addButton = createElement('button', {
		id: 'add-todo',
		className: 'btn primary',
		textContent: 'Add Todo',
	})
	formRow.append(titleInput, prioritySelect, addButton)

	// Action row
	const actionRow = createElement('div', { className: 'action-row' })
	const loadSamplesButton = createElement('button', {
		id: 'load-samples',
		className: 'btn secondary',
		textContent: 'Load Sample Todos',
	})
	const clearCompletedButton = createElement('button', {
		id: 'clear-completed',
		className: 'btn warning',
		textContent: 'Clear Completed',
	})
	const clearAllButton = createElement('button', {
		id: 'clear-todos',
		className: 'btn danger',
		textContent: 'Clear All',
	})
	actionRow.append(loadSamplesButton, clearCompletedButton, clearAllButton)

	// Filter row
	const filterRow = createElement('div', { className: 'filter-row' })
	const filterAllButton = createElement('button', {
		className: 'filter-btn active',
		textContent: 'All',
	})
	filterAllButton.dataset.filter = 'all'
	const filterActiveButton = createElement('button', {
		className: 'filter-btn',
		textContent: 'Active',
	})
	filterActiveButton.dataset.filter = 'active'
	const filterCompletedButton = createElement('button', {
		className: 'filter-btn',
		textContent: 'Completed',
	})
	filterCompletedButton.dataset.filter = 'completed'
	filterRow.append(filterAllButton, filterActiveButton, filterCompletedButton)

	// List container
	const listContainer = createElement('div', {
		id: 'todo-list',
		className: 'todo-list',
	})
	const loading = createElement('div', {
		className: 'loading',
		textContent: 'Loading...',
	})
	listContainer.appendChild(loading)

	// Stats
	const stats = createElement('div', { className: 'stats', id: 'todo-stats' })

	section.append(h2, subtitle, formRow, actionRow, filterRow, listContainer, stats)
	content.appendChild(section)

	// Store element references
	todoElements = {
		titleInput,
		prioritySelect,
		addButton,
		loadSamplesButton,
		clearCompletedButton,
		clearAllButton,
		filterAllButton,
		filterActiveButton,
		filterCompletedButton,
		listContainer,
		stats,
	}

	// Attach handlers and load data
	attachTodoHandlers()
	void loadTodos()
}

function renderNotesTab(content: HTMLElement): void {
	const section = createElement('section', { className: 'card' })

	// Header
	const h2 = createElement('h2', { textContent: 'Sticky Notes — Batch Operations & Transactions' })
	const subtitle = createElement('p', { className: 'subtitle' })
	subtitle.innerHTML = 'Demonstrates: <code>set([...])</code> batching, <code>db.write()</code> transactions'

	// Form row
	const formRow = createElement('div', { className: 'form-row' })
	const titleInput = createElement('input', {
		type: 'text',
		id: 'note-title',
		placeholder: 'Note title',
	})
	const contentInput = createElement('input', {
		type: 'text',
		id: 'note-content',
		placeholder: 'Note content',
	})
	const colorSelect = createElement('select', { id: 'note-color' })
	colorSelect.append(
		createOption('#fff3cd', '🟡 Yellow'),
		createOption('#d1ecf1', '🔵 Blue'),
		createOption('#d4edda', '🟢 Green'),
		createOption('#f8d7da', '🔴 Pink'),
	)
	const addButton = createElement('button', {
		id: 'add-note',
		className: 'btn primary',
		textContent: 'Add Note',
	})
	formRow.append(titleInput, contentInput, colorSelect, addButton)

	// Action row
	const actionRow = createElement('div', { className: 'action-row' })
	const loadSamplesButton = createElement('button', {
		id: 'load-sample-notes',
		className: 'btn secondary',
		textContent: 'Load Sample Notes (Batch)',
	})
	const clearAllButton = createElement('button', {
		id: 'clear-notes',
		className: 'btn danger',
		textContent: 'Clear All (Transaction)',
	})
	actionRow.append(loadSamplesButton, clearAllButton)

	// Grid
	const grid = createElement('div', {
		id: 'notes-grid',
		className: 'notes-grid',
	})
	const loading = createElement('div', {
		className: 'loading',
		textContent: 'Loading...',
	})
	grid.appendChild(loading)

	section.append(h2, subtitle, formRow, actionRow, grid)
	content.appendChild(section)

	// Store element references
	noteElements = {
		titleInput,
		contentInput,
		colorSelect,
		addButton,
		loadSamplesButton,
		clearAllButton,
		grid,
	}

	// Attach handlers and load data
	attachNoteHandlers()
	void loadNotes()
}

function renderQueryTab(content: HTMLElement): void {
	const section = createElement('section', { className: 'card' })

	// Header
	const h2 = createElement('h2', { textContent: 'Query Builder — Advanced Queries' })
	const subtitle = createElement('p', { className: 'subtitle' })
	subtitle.innerHTML = 'Demonstrates: <code>query()</code>, <code>where()</code>, <code>filter()</code>, <code>limit()</code>, <code>offset()</code>'

	// Query builder
	const queryBuilder = createElement('div', { className: 'query-builder' })

	// Priority row
	const priorityRow = createElement('div', { className: 'query-row' })
	const priorityLabel = createElement('label', { textContent: 'Filter by Priority:' })
	const prioritySelect = createElement('select', { id: 'query-priority' })
	prioritySelect.append(
		createOption('', 'All Priorities'),
		createOption('high', '🔴 High Only'),
		createOption('medium', '🟡 Medium Only'),
		createOption('low', '🟢 Low Only'),
	)
	priorityRow.append(priorityLabel, prioritySelect)

	// Status row
	const statusRow = createElement('div', { className: 'query-row' })
	const statusLabel = createElement('label', { textContent: 'Status:' })
	const statusSelect = createElement('select', { id: 'query-status' })
	statusSelect.append(
		createOption('', 'All Status'),
		createOption('active', 'Active Only'),
		createOption('completed', 'Completed Only'),
	)
	statusRow.append(statusLabel, statusSelect)

	// Pagination row
	const paginationRow = createElement('div', { className: 'query-row' })
	const paginationLabel = createElement('label', { textContent: 'Pagination:' })
	const limitInput = createElement('input', {
		type: 'number',
		id: 'query-limit',
		value: '3',
		min: '1',
		max: '20',
	})
	const itemsSpan = createElement('span', { textContent: 'items per page' })
	const prevButton = createElement('button', {
		id: 'prev-page',
		className: 'btn small',
		textContent: '← Prev',
	})
	const pageInfo = createElement('span', {
		id: 'page-info',
		textContent: 'Page 1',
	})
	const nextButton = createElement('button', {
		id: 'next-page',
		className: 'btn small',
		textContent: 'Next →',
	})
	paginationRow.append(paginationLabel, limitInput, itemsSpan, prevButton, pageInfo, nextButton)

	// Run button
	const runButton = createElement('button', {
		id: 'run-query',
		className: 'btn primary',
		textContent: 'Run Query',
	})

	queryBuilder.append(priorityRow, statusRow, paginationRow, runButton)

	// Results
	const results = createElement('div', {
		id: 'query-results',
		className: 'query-results',
	})
	const placeholder = createElement('p', {
		className: 'placeholder',
		textContent: 'Click "Run Query" to see results',
	})
	results.appendChild(placeholder)

	// Code section
	const codeSection = createElement('div', { className: 'code-section' })
	const codeH3 = createElement('h3', { textContent: 'Generated Code' })
	const codeBlock = createElement('div', {
		id: 'query-code',
		className: 'code-block',
	})
	const codePre = createElement('pre')
	const code = createElement('code', {
		textContent: '// Query code will appear here',
	})
	codePre.appendChild(code)
	codeBlock.appendChild(codePre)
	codeSection.append(codeH3, codeBlock)

	section.append(h2, subtitle, queryBuilder, results, codeSection)
	content.appendChild(section)

	// Store element references
	queryElements = {
		prioritySelect,
		statusSelect,
		limitInput,
		prevButton,
		nextButton,
		pageInfo,
		runButton,
		results,
		codeBlock,
	}

	// Attach handlers
	attachQueryHandlers()
}

function renderEventsTab(content: HTMLElement): void {
	const section = createElement('section', { className: 'card' })

	// Header
	const h2 = createElement('h2', { textContent: 'Live Events — Cross-Tab Synchronization' })
	const subtitle = createElement('p', { className: 'subtitle' })
	subtitle.innerHTML = 'Demonstrates: <code>onChange()</code>, <code>BroadcastChannel</code> sync'

	// Info box
	const infoBox = createElement('div', { className: 'info-box' })
	const infoP1 = createElement('p')
	infoP1.innerHTML = '📡 <strong>Open this page in another browser tab</strong> and make changes. You\'ll see events appear here in real-time!'
	const infoP2 = createElement('p')
	infoP2.innerHTML = '🔵 <strong>LOCAL</strong> events are from this tab. 🟠 <strong>REMOTE</strong> events are from other tabs.'
	infoBox.append(infoP1, infoP2)

	// Action row
	const actionRow = createElement('div', { className: 'action-row' })
	const triggerAddButton = createElement('button', {
		id: 'trigger-add',
		className: 'btn secondary',
		textContent: 'Trigger Add Event',
	})
	const triggerSetButton = createElement('button', {
		id: 'trigger-set',
		className: 'btn secondary',
		textContent: 'Trigger Set Event',
	})
	const triggerRemoveButton = createElement('button', {
		id: 'trigger-remove',
		className: 'btn secondary',
		textContent: 'Trigger Remove Event',
	})
	const clearLogButton = createElement('button', {
		id: 'clear-log',
		className: 'btn danger',
		textContent: 'Clear Log',
	})
	actionRow.append(triggerAddButton, triggerSetButton, triggerRemoveButton, clearLogButton)

	// Log content
	const logContent = createElement('div', {
		id: 'event-log-content',
		className: 'event-log',
	})
	const logPlaceholder = createElement('p', {
		className: 'placeholder',
		textContent: 'No events yet. Make some changes!',
	})
	logContent.appendChild(logPlaceholder)

	section.append(h2, subtitle, infoBox, actionRow, logContent)
	content.appendChild(section)

	// Store element references
	eventsElements = {
		triggerAddButton,
		triggerSetButton,
		triggerRemoveButton,
		clearLogButton,
		logContent,
	}

	// Attach handlers and update UI
	attachEventHandlers()
	updateEventLogUI()
}

// ============================================================================
// Data Loading Functions
// ============================================================================

function createTodoElement(todo: Todo): HTMLDivElement {
	const item = createElement('div', {
		className: `todo-item ${todo.completed ? 'completed' : ''}`,
		dataset: { id: todo.id },
	})

	const checkbox = createElement('input', { type: 'checkbox' })
	checkbox.className = 'todo-toggle'
	checkbox.checked = todo.completed

	const priority = createElement('span', {
		className: 'priority',
		textContent: getPriorityEmoji(todo.priority),
	})

	const title = createElement('span', {
		className: 'todo-title',
		textContent: todo.title,
	})

	const date = createElement('span', {
		className: 'todo-date',
		textContent: formatTime(todo.createdAt),
	})

	const deleteBtn = createElement('button', {
		className: 'delete-btn',
		textContent: '×',
	})
	deleteBtn.title = 'Delete'

	item.append(checkbox, priority, title, date, deleteBtn)
	return item
}

async function loadTodos(filter: 'all' | 'active' | 'completed' = 'all'): Promise<void> {
	if (!todoElements) return

	const { listContainer, stats } = todoElements

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

		// Clear container
		listContainer.innerHTML = ''

		if (sorted.length === 0) {
			const empty = createElement('p', {
				className: 'empty',
				textContent: filter === 'all' ? 'No todos yet. Add one above or load samples!' : `No ${filter} todos.`,
			})
			listContainer.appendChild(empty)
		} else {
			sorted.forEach(todo => {
				listContainer.appendChild(createTodoElement(todo))
			})
		}

		// Update stats
		const completed = allTodos.filter((t) => t.completed).length
		stats.innerHTML = ''

		const totalSpan = createElement('span')
		totalSpan.innerHTML = '📊 Total: <strong>' + allTodos.length + '</strong>'
		const completedSpan = createElement('span')
		completedSpan.innerHTML = '✅ Completed: <strong>' + completed + '</strong>'
		const activeSpan = createElement('span')
		activeSpan.innerHTML = '⏳ Active: <strong>' + (allTodos.length - completed) + '</strong>'

		stats.append(totalSpan, completedSpan, activeSpan)
	} catch (error) {
		listContainer.innerHTML = ''
		const errorP = createElement('p', {
			className: 'error',
			textContent: `Error loading todos: ${String(error)}`,
		})
		listContainer.appendChild(errorP)
	}
}

function createNoteCard(note: Note): HTMLDivElement {
	const card = createElement('div', {
		className: 'note-card',
		dataset: { id: note.id },
	})
	card.style.backgroundColor = note.color

	const h3 = createElement('h3', { textContent: note.title })
	const p = createElement('p', { textContent: note.content })

	const footer = createElement('div', { className: 'note-footer' })
	const timestamp = createElement('span', {
		textContent: formatTime(note.updatedAt),
	})
	const deleteBtn = createElement('button', {
		className: 'delete-note-btn',
		textContent: '×',
	})
	deleteBtn.title = 'Delete'
	footer.append(timestamp, deleteBtn)

	card.append(h3, p, footer)
	return card
}

async function loadNotes(): Promise<void> {
	if (!noteElements) return

	const { grid } = noteElements

	try {
		const notes = await db.store('notes').all()
		const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)

		// Clear grid
		grid.innerHTML = ''

		if (sorted.length === 0) {
			const empty = createElement('p', {
				className: 'empty',
				textContent: 'No notes yet. Add one above or load samples!',
			})
			grid.appendChild(empty)
		} else {
			sorted.forEach(note => {
				grid.appendChild(createNoteCard(note))
			})
		}
	} catch (error) {
		grid.innerHTML = ''
		const errorP = createElement('p', {
			className: 'error',
			textContent: `Error loading notes: ${String(error)}`,
		})
		grid.appendChild(errorP)
	}
}

// ============================================================================
// Event Handlers
// ============================================================================

function attachTodoHandlers(): void {
	if (!todoElements) return

	const {
		titleInput,
		prioritySelect,
		addButton,
		loadSamplesButton,
		clearCompletedButton,
		clearAllButton,
		filterAllButton,
		filterActiveButton,
		filterCompletedButton,
		listContainer,
	} = todoElements

	// Add todos
	const addTodo = async(): Promise<void> => {
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

	addButton.addEventListener('click', () => void addTodo())
	titleInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') void addTodo()
	})

	// Load samples
	loadSamplesButton.addEventListener('click', () => {
		void (async() => {
			await db.store('todos').set([...SAMPLE_TODOS])
			void loadTodos()
		})()
	})

	// Clear completed
	clearCompletedButton.addEventListener('click', () => {
		void (async() => {
			const todos = await db.store('todos').all()
			const completedIds = todos.filter((t) => t.completed).map((t) => t.id)
			if (completedIds.length > 0) {
				await db.store('todos').remove(completedIds)
			}
			void loadTodos()
		})()
	})

	// Clear all
	clearAllButton.addEventListener('click', () => {
		void (async() => {
			await db.store('todos').clear()
			void loadTodos()
		})()
	})

	// Filter buttons
	const setActiveFilter = (button: HTMLButtonElement) => {
		filterAllButton.classList.remove('active')
		filterActiveButton.classList.remove('active')
		filterCompletedButton.classList.remove('active')
		button.classList.add('active')
	}

	filterAllButton.addEventListener('click', () => {
		setActiveFilter(filterAllButton)
		void loadTodos('all')
	})
	filterActiveButton.addEventListener('click', () => {
		setActiveFilter(filterActiveButton)
		void loadTodos('active')
	})
	filterCompletedButton.addEventListener('click', () => {
		setActiveFilter(filterCompletedButton)
		void loadTodos('completed')
	})

	// Toggle and delete (event delegation)
	listContainer.addEventListener('click', (e) => {
		const target = e.target as HTMLElement
		const todoItem = target.closest<HTMLDivElement>('.todo-item')
		if (!todoItem) return

		const id = todoItem.dataset.id
		if (!id) return

		void (async() => {
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
		})()
	})
}

function attachNoteHandlers(): void {
	if (!noteElements) return

	const {
		titleInput,
		contentInput,
		colorSelect,
		addButton,
		loadSamplesButton,
		clearAllButton,
		grid,
	} = noteElements

	// Add note
	const addNote = async(): Promise<void> => {
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

	addButton.addEventListener('click', () => void addNote())

	// Load sample notes (batch operation)
	loadSamplesButton.addEventListener('click', () => {
		void (async() => {
			await db.store('notes').set([...SAMPLE_NOTES])
			void loadNotes()
		})()
	})

	// Clear all notes (transaction demo)
	clearAllButton.addEventListener('click', () => {
		void (async() => {
			await db.write('notes', async(tx) => {
				await tx.store('notes').clear()
			})
			void loadNotes()
		})()
	})

	// Delete note (event delegation)
	grid.addEventListener('click', (e) => {
		const target = e.target as HTMLElement
		if (!target.classList.contains('delete-note-btn')) return

		const noteCard = target.closest<HTMLDivElement>('.note-card')
		if (!noteCard) return

		const id = noteCard.dataset.id
		if (!id) return

		void (async() => {
			await db.store('notes').remove(id)
			void loadNotes()
		})()
	})
}

let currentPage = 0
let lastQueryTotal = 0

function createQueryResultsTable(results: readonly Todo[]): HTMLTableElement {
	const table = createElement('table')

	const thead = createElement('thead')
	const headerRow = createElement('tr')
	headerRow.append(
		createElement('th', { textContent: 'Title' }),
		createElement('th', { textContent: 'Priority' }),
		createElement('th', { textContent: 'Status' }),
		createElement('th', { textContent: 'Created' }),
	)
	thead.appendChild(headerRow)

	const tbody = createElement('tbody')
	results.forEach((todo) => {
		const row = createElement('tr', {
			className: todo.completed ? 'completed' : '',
		})

		const titleCell = createElement('td', { textContent: todo.title })
		const priorityCell = createElement('td', {
			textContent: `${getPriorityEmoji(todo.priority)} ${todo.priority}`,
		})
		const statusCell = createElement('td', {
			textContent: todo.completed ? '✅ Done' : '⏳ Active',
		})
		const createdCell = createElement('td', {
			textContent: formatTime(todo.createdAt),
		})

		row.append(titleCell, priorityCell, statusCell, createdCell)
		tbody.appendChild(row)
	})

	table.append(thead, tbody)
	return table
}

function attachQueryHandlers(): void {
	if (!queryElements) return

	const {
		prioritySelect,
		statusSelect,
		limitInput,
		prevButton,
		nextButton,
		pageInfo,
		runButton,
		results,
		codeBlock,
	} = queryElements

	const runQuery = async(): Promise<void> => {
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
		const queryResults = await query.toArray()

		// Clear and update results
		results.innerHTML = ''

		if (queryResults.length === 0 && currentPage === 0) {
			const empty = createElement('p', {
				className: 'empty',
				textContent: 'No results found. Try loading sample todos first!',
			})
			results.appendChild(empty)
		} else if (queryResults.length === 0) {
			const empty = createElement('p', {
				className: 'empty',
				textContent: 'No more results on this page.',
			})
			results.appendChild(empty)
		} else {
			const table = createQueryResultsTable(queryResults)
			const resultCount = createElement('p', {
				className: 'result-count',
				textContent: `Showing ${queryResults.length} of ${lastQueryTotal} total results`,
			})
			results.append(table, resultCount)
		}

		// Update page info
		const totalPages = Math.ceil(lastQueryTotal / limit) || 1
		pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`

		// Display generated code
		const pre = createElement('pre')
		const code = createElement('code', {
			textContent: codeLines.join('\n'),
		})
		pre.appendChild(code)
		codeBlock.innerHTML = ''
		codeBlock.appendChild(pre)
	}

	runButton.addEventListener('click', () => {
		currentPage = 0
		void runQuery()
	})

	prevButton.addEventListener('click', () => {
		if (currentPage > 0) {
			currentPage--
			void runQuery()
		}
	})

	nextButton.addEventListener('click', () => {
		currentPage++
		void runQuery()
	})

	// Auto-run initial query
	void runQuery()
}

function attachEventHandlers(): void {
	if (!eventsElements) return

	const {
		triggerAddButton,
		triggerSetButton,
		triggerRemoveButton,
		clearLogButton,
	} = eventsElements

	triggerAddButton.addEventListener('click', () => {
		void (async() => {
			await db.store('todos').add({
				id: generateId(),
				title: `Event Test ${new Date().toLocaleTimeString()}`,
				completed: false,
				priority: 'low',
				createdAt: Date.now(),
			})
		})()
	})

	triggerSetButton.addEventListener('click', () => {
		void (async() => {
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
		})()
	})

	triggerRemoveButton.addEventListener('click', () => {
		void (async() => {
			const todos = await db.store('todos').all()
			if (todos.length > 0 && todos[0]) {
				await db.store('todos').remove(todos[0].id)
			}
		})()
	})

	clearLogButton.addEventListener('click', () => {
		eventLog.length = 0
		updateEventLogUI()
	})
}

// ============================================================================
// Initialize App
// ============================================================================

setupEventLogging()
render()
