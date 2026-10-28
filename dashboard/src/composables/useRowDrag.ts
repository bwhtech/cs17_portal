import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { shellScrollContainer } from 'frappe-ui'

const THRESHOLD = 5
const HOLD_MS = 350
const EDGE = 72
const EDGE_SPEED = 18
const CLICK_GRACE_MS = 250
const PREVIEW_MAX_WIDTH = 320
const DRAGGING_CLASSES = ['select-none', 'cursor-grabbing', '[&_*]:pointer-events-none']

export interface RowDragOptions<T> {
	groups: () => Record<string, HTMLElement | null>
	groupOf: (row: T) => string
	pick: (row: T) => T[]
	onDrop: (rows: T[], group: string) => void
}

interface Pending<T> {
	row: T
	x: number
	y: number
	dx: number
	dy: number
	width: number
	held: boolean
}

export function useRowDrag<T>(options: RowDragOptions<T>) {
	const dragging = shallowRef<T[] | null>(null)
	const over = ref<string | null>(null)
	const start = ref({ x: 0, y: 0 })
	const offset = ref({ x: 0, y: 0 })
	const width = ref(0)

	let pending: Pending<T> | null = null
	let pointer = { x: 0, y: 0 }
	let holdTimer: number | undefined
	let frame = 0
	let scrollStep = 0
	let droppedAt = 0

	function isDragging(row: T) {
		return dragging.value?.includes(row) ?? false
	}

	function press(event: PointerEvent, row: T) {
		if (event.button !== 0) return
		const el = event.currentTarget as HTMLElement
		const control = (event.target as HTMLElement).closest('button, [role="checkbox"]')
		if (control && control !== el) return

		const box = el.getBoundingClientRect()
		const previewWidth = Math.min(box.width, PREVIEW_MAX_WIDTH)
		const touch = event.pointerType === 'touch'
		pending = {
			row,
			x: event.clientX,
			y: event.clientY,
			dx: Math.min(event.clientX - box.left, previewWidth / 2),
			dy: event.clientY - box.top,
			width: previewWidth,
			held: !touch,
		}
		pointer = { x: event.clientX, y: event.clientY }

		if (touch) {
			holdTimer = window.setTimeout(() => {
				if (!pending) return
				pending.held = true
				begin()
			}, HOLD_MS)
		}

		window.addEventListener('pointermove', move)
		window.addEventListener('pointerup', release)
		window.addEventListener('pointercancel', end)
	}

	function move(event: PointerEvent) {
		if (!pending) return
		pointer = { x: event.clientX, y: event.clientY }

		if (!dragging.value) {
			const travelled = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
			if (travelled <= THRESHOLD) return
			if (!pending.held) return end()
			begin()
		}

		over.value = groupAt(pointer.x, pointer.y)
		scrollStep = edgeScrollStep(pointer.y)
	}

	function begin() {
		if (!pending || dragging.value) return
		window.clearTimeout(holdTimer)

		start.value = pointer
		width.value = pending.width
		offset.value = { x: pending.dx, y: pending.dy }
		dragging.value = options.pick(pending.row)
		over.value = groupAt(pointer.x, pointer.y)

		document.body.classList.add(...DRAGGING_CLASSES)
		document.addEventListener('touchmove', blockScroll, { passive: false })
		window.addEventListener('keydown', cancelOnEscape)
		frame = requestAnimationFrame(autoScroll)
	}

	function release() {
		const rows = dragging.value
		const group = over.value
		end()
		if (!rows) return
		droppedAt = Date.now()
		if (group) options.onDrop(rows, group)
	}

	function end() {
		window.clearTimeout(holdTimer)
		window.removeEventListener('pointermove', move)
		window.removeEventListener('pointerup', release)
		window.removeEventListener('pointercancel', end)
		window.removeEventListener('keydown', cancelOnEscape)
		document.removeEventListener('touchmove', blockScroll)
		document.body.classList.remove(...DRAGGING_CLASSES)
		cancelAnimationFrame(frame)
		pending = null
		dragging.value = null
		over.value = null
		scrollStep = 0
	}

	function groupAt(x: number, y: number): string | null {
		for (const [group, el] of Object.entries(options.groups())) {
			const box = el?.getBoundingClientRect()
			if (!box || x < box.left || x > box.right || y < box.top || y > box.bottom) continue
			return dragging.value?.every((row) => options.groupOf(row) === group) ? null : group
		}
		return null
	}

	function edgeScrollStep(y: number): number {
		const box = shellScrollContainer.value?.getBoundingClientRect()
		if (!box) return 0
		const depth = Math.max(box.top + EDGE - y, 0) - Math.max(y - (box.bottom - EDGE), 0)
		return -Math.sign(depth) * Math.ceil(EDGE_SPEED * Math.min(Math.abs(depth) / EDGE, 1))
	}

	function autoScroll() {
		frame = requestAnimationFrame(autoScroll)
		if (!scrollStep) return
		shellScrollContainer.value?.scrollBy({ top: scrollStep })
		over.value = groupAt(pointer.x, pointer.y)
	}

	function blockScroll(event: TouchEvent) {
		event.preventDefault()
	}

	function cancelOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') end()
	}

	function swallowClickAfterDrop(event: MouseEvent) {
		if (Date.now() - droppedAt >= CLICK_GRACE_MS) return
		event.preventDefault()
		event.stopPropagation()
	}

	onBeforeUnmount(end)

	return { dragging, over, start, offset, width, isDragging, press, swallowClickAfterDrop }
}
