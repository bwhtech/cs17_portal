<template>
	<div ref="root" @click.capture="swallowClickAfterDrop">
		<EmptyState v-if="!loading && !rows.length" :title="empty" />

		<!-- Desktop, when the columns fit: a frappe-ui List in column mode per group. -->
		<!-- `list-row-px-3` is what keeps the header aligned with the rows: an
		     interactive row insets its content by 0.75rem on its own, but the
		     header only picks that up from this public hook. `-mx-3` then lets the
		     hover surface bleed into the page gutter while the text stays lined up
		     with everything above it. -->
		<div v-else-if="showTable" class="space-y-3">
			<section
				v-for="(group, index) in groups"
				:key="group.label"
				:ref="(el) => setGroupElement(group.label, el)"
				:class="
					groupBy && [
						'rounded-4 border transition-colors',
						over === group.label
							? 'border-outline-gray-3 bg-surface-gray-1'
							: 'border-outline-gray-1 bg-surface-base',
					]
				"
				:aria-labelledby="group.label ? `${groupId}-${index}-label` : undefined"
			>
				<GroupHeader
					v-if="group.label"
					class="px-5"
					:label="group.label"
					:count="group.rows.length"
					:expanded="!collapsedGroups.includes(group.label)"
					:label-id="`${groupId}-${index}-label`"
					:controls="`${groupId}-${index}`"
					@toggle="toggleGroup(group.label)"
				>
					<slot name="group-suffix" :rows="group.rows" />
				</GroupHeader>
				<div
					v-show="!collapsedGroups.includes(group.label)"
					:id="`${groupId}-${index}`"
					:class="
						groupBy && ['px-5 py-2', group.label && 'border-t border-outline-gray-1']
					"
				>
					<List
						class="-mx-3 list-row-px-3"
						:columns="trackSizes"
						:selectable="selectable"
						:selection="selection"
						:row-height="rowHeight"
						:divider="divider"
						@update:selection="emit('update:selection', $event)"
					>
						<ListHeader>
							<ListHeaderCell
								v-for="column in columns"
								:key="column.header"
								:class="column.align === 'right' ? 'justify-end' : undefined"
							>
								{{ column.header }}
							</ListHeaderCell>
						</ListHeader>

						<template v-if="loading">
							<ListRow
								v-for="n in skeletonRows"
								:key="`skeleton-${n}`"
								:value="`skeleton-${n}`"
							>
								<ListCell
									v-for="column in columns"
									:key="column.header"
									class="cs17-delay-in"
								>
									<Skeleton class="h-3 w-full max-w-24 rounded-full" />
								</ListCell>
							</ListRow>
						</template>

						<!-- `ListRows`, not a bare `v-for`: it feeds the header's select-all the
					     full set of row keys. -->
						<ListRows
							v-else
							v-slot="{ item }"
							:items="group.selectableRows"
							:row-key="listRowKey"
						>
							<ListRow
								:value="rowKey(item)"
								:class="
									onRowDrop && ['cursor-grab', isDragging(item) && 'opacity-40']
								"
								@click="onRowClick?.(item)"
								@pointerdown="onRowDrop && press($event, item)"
								@dragstart="onRowDrop && $event.preventDefault()"
							>
								<ListCell
									v-for="column in columns"
									:key="column.header"
									class="text-base"
									:class="column.align === 'right' ? 'justify-end' : undefined"
									@click="
										column.variant === 'actions' && $event.stopPropagation()
									"
								>
									<slot :name="`cell-${column.key}`" :row="item">{{
										cellText(item, column)
									}}</slot>
								</ListCell>
							</ListRow>
						</ListRows>

						<template v-if="!loading">
							<ListRow
								v-for="row in group.plainRows"
								:key="rowKey(row)"
								:class="
									onRowDrop && ['cursor-grab', isDragging(row) && 'opacity-40']
								"
								@click="onRowClick?.(row)"
								@pointerdown="onRowDrop && press($event, row)"
								@dragstart="onRowDrop && $event.preventDefault()"
							>
								<ListCell
									v-for="column in columns"
									:key="column.header"
									class="text-base"
									:class="column.align === 'right' ? 'justify-end' : undefined"
								>
									<slot :name="`cell-${column.key}`" :row="row">{{
										cellText(row, column)
									}}</slot>
								</ListCell>
							</ListRow>
						</template>
					</List>
				</div>
			</section>
		</div>

		<!-- Otherwise the same rows become cards: the primary column is the
		     heading, `field` columns are label/value pairs, actions sit at the
		     foot. Same contract as the React ResponsiveTable it replaces. -->
		<div v-else-if="loading" class="cs17-delay-in space-y-3">
			<div
				v-for="n in skeletonRows"
				:key="`skeleton-${n}`"
				class="space-y-2 rounded-4 border border-outline-gray-1 p-4"
			>
				<Skeleton class="h-3.5 w-40 rounded-full" />
				<Skeleton class="h-3 w-24 rounded-full" />
			</div>
		</div>

		<div v-else class="space-y-3">
			<label
				v-if="selectable"
				class="flex items-center gap-2 text-sm text-ink-gray-6"
				@click.prevent="toggleAll"
			>
				<Checkbox :model-value="allSelected" />
				Select all
			</label>

			<section
				v-for="(group, index) in groups"
				:key="group.label"
				:ref="(el) => setGroupElement(group.label, el)"
				class="rounded-4 transition-colors"
				:class="over === group.label && 'bg-surface-gray-2'"
				:aria-labelledby="group.label ? `${groupId}-${index}-label` : undefined"
			>
				<GroupHeader
					v-if="group.label"
					:label="group.label"
					:count="group.rows.length"
					:expanded="!collapsedGroups.includes(group.label)"
					:label-id="`${groupId}-${index}-label`"
					:controls="`${groupId}-${index}`"
					@toggle="toggleGroup(group.label)"
				>
					<slot name="group-suffix" :rows="group.rows" />
				</GroupHeader>
				<div
					v-show="!collapsedGroups.includes(group.label)"
					:id="`${groupId}-${index}`"
					class="space-y-3 pb-3"
				>
					<div
						v-for="row in group.rows"
						:key="rowKey(row)"
						class="space-y-2 rounded-4 border border-outline-gray-1 p-4"
						:class="onRowDrop && ['select-none', isDragging(row) && 'opacity-40']"
						@click="onRowClick?.(row)"
						@pointerdown="onRowDrop && press($event, row)"
						@dragstart="onRowDrop && $event.preventDefault()"
					>
						<div class="flex items-start gap-2">
							<Checkbox
								v-if="selectable && isRowSelectable(row)"
								:model-value="selection.includes(rowKey(row))"
								@click.stop
								@update:model-value="toggleRow(rowKey(row))"
							/>
							<slot
								v-if="avatarColumn"
								:name="`cell-${avatarColumn.key}`"
								:row="row"
							/>
							<div
								data-card-heading
								class="flex min-w-0 flex-1 items-center text-base font-medium text-ink-gray-8 [&>.truncate]:line-clamp-2 [&>.truncate]:whitespace-normal [&>.truncate]:break-words"
							>
								<slot
									v-if="primaryColumn"
									:name="`cell-${primaryColumn.key}`"
									:row="row"
								/>
							</div>
						</div>

						<div
							v-for="column in fieldColumns"
							:key="column.header"
							class="flex items-center justify-between gap-4 text-base"
						>
							<span class="shrink-0 text-ink-gray-5">{{ column.header }}</span>
							<span
								class="flex min-w-0 items-center justify-end text-right text-ink-gray-7"
							>
								<slot :name="`cell-${column.key}`" :row="row">{{
									cellText(row, column)
								}}</slot>
							</span>
						</div>

						<div v-for="column in actionColumns" :key="column.header" class="pt-1">
							<slot :name="`cell-${column.key}`" :row="row" />
						</div>
					</div>
				</div>
			</section>
		</div>

		<RowDragPreview
			v-if="dragging"
			:count="dragging.length"
			:start="start"
			:offset="offset"
			:width="previewWidth"
		>
			<div class="flex items-start gap-2 text-base">
				<slot v-if="avatarColumn" :name="`cell-${avatarColumn.key}`" :row="dragging[0]" />
				<div class="min-w-0 flex-1">
					<slot
						v-if="primaryColumn"
						:name="`cell-${primaryColumn.key}`"
						:row="dragging[0]"
					/>
				</div>
			</div>
		</RowDragPreview>
	</div>
</template>

<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, onMounted, ref, useId, type ComponentPublicInstance } from 'vue'
import { Checkbox, Skeleton } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import GroupHeader from '@/components/common/GroupHeader.vue'
import RowDragPreview from '@/components/common/RowDragPreview.vue'
import { List, ListCell, ListHeader, ListHeaderCell, ListRow, ListRows } from 'frappe-ui/list'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useRowDrag } from '@/composables/useRowDrag'

export interface Column {
	/** Column heading, and the label of the field row on mobile. */
	header: string
	/** Names the `cell-<key>` slot, and the row field used when it has none. */
	key: string
	/**
	 * How the column folds into a card below `md`: `primary` is the card's
	 * heading, `field` a label/value row (the default), `actions` the foot.
	 * `avatar` is a leading image or icon cell — it keeps its own column on
	 * desktop and sits beside the heading on a card.
	 */
	variant?: 'avatar' | 'primary' | 'field' | 'actions'
	/** A grid track in rem, e.g. `'8rem'` or `'minmax(6rem,1fr)'`. Defaults to an equal share. */
	width?: string
	align?: 'left' | 'right'
}

const props = withDefaults(
	defineProps<{
		columns: Column[]
		rows: T[]
		rowKey: (row: T) => string
		/** Shown in place of the rows when there are none. */
		empty?: string
		/** Renders skeleton rows instead of `rows`. */
		loading?: boolean
		/** Reveals the checkbox column; pair with `v-model:selection`. */
		selectable?: boolean
		/** The selected row keys. */
		selection?: string[]
		/** Rows it returns false for get no checkbox and sit after the others. */
		isRowSelectable?: (row: T) => boolean
		onRowClick?: (row: T) => void
		/** Taller rows for a two-line primary cell; 44 is the dense default. */
		rowHeight?: number
		groupBy?: (row: T) => string
		onRowDrop?: (rows: T[], group: string) => void
	}>(),
	{
		empty: 'Nothing here yet.',
		selection: () => [],
		isRowSelectable: () => true,
		rowHeight: 44,
	},
)

const emit = defineEmits<{ 'update:selection': [value: string[]] }>()

const skeletonRows = 4

const { isDesktop } = useBreakpoint()

const FLEXIBLE_COLUMN_REM = 6
const COLUMN_GAP_PX = 8
const CHECKBOX_PX = 32

const root = ref<HTMLElement | null>(null)
const width = ref(0)
const resizeObserver = new ResizeObserver(([entry]) => {
	width.value = entry.contentRect.width
})
onMounted(() => root.value && resizeObserver.observe(root.value))
onBeforeUnmount(() => resizeObserver.disconnect())

const tableMinWidth = computed(() => {
	const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
	const tracks = props.columns.reduce(
		(total, column) =>
			total +
			(parseFloat(column.width?.match(/[\d.]+rem/)?.[0] ?? '') || FLEXIBLE_COLUMN_REM),
		0,
	)
	return (
		tracks * rem +
		(props.columns.length - 1) * COLUMN_GAP_PX +
		(props.selectable ? CHECKBOX_PX : 0)
	)
})

const showTable = computed(
	() => isDesktop.value && (!width.value || width.value >= tableMinWidth.value),
)

// `auto` tracks size per row and would let the columns drift between rows, so
// a column without an explicit width takes an equal, shrinkable share.
const trackSizes = computed(() => props.columns.map((column) => column.width ?? 'minmax(0,1fr)'))

/** The default cell rendering: the row's own value for that column's key. */
function cellText(row: T, column: Column): string {
	const value = (row as Record<string, unknown>)[column.key]
	return value === null || value === undefined ? '' : String(value)
}

/** `ListRows` wants `(item, index)`; the app-facing prop takes only the row. */
const listRowKey = (item: T) => props.rowKey(item)

const avatarColumn = computed(() => props.columns.find((c) => c.variant === 'avatar'))
const primaryColumn = computed(() => props.columns.find((c) => c.variant === 'primary'))

/**
 * A leading avatar cell wants the divider to start at the text edge, the way
 * the frappe-ui list recipes draw one; without it the rule runs under the
 * avatar column too.
 */
const divider = computed(() => (avatarColumn.value ? 'inset' : 'full'))
const fieldColumns = computed(() => props.columns.filter((c) => (c.variant ?? 'field') === 'field'))
const actionColumns = computed(() => props.columns.filter((c) => c.variant === 'actions'))

const selectableRows = computed(() => props.rows.filter(props.isRowSelectable))

const groupId = useId()

const groups = computed(() => {
	const rowsByLabel = new Map<string, T[]>()
	for (const row of props.rows) {
		const label = props.groupBy?.(row) ?? ''
		if (!rowsByLabel.has(label)) rowsByLabel.set(label, [])
		rowsByLabel.get(label)!.push(row)
	}
	if (!rowsByLabel.size) rowsByLabel.set('', [])
	return [...rowsByLabel].map(([label, rows]) => ({
		label,
		rows,
		selectableRows: rows.filter(props.isRowSelectable),
		plainRows: rows.filter((row) => !props.isRowSelectable(row)),
	}))
})

const collapsedGroups = defineModel<string[]>('collapsedGroups', { default: () => [] })

function toggleGroup(label: string) {
	collapsedGroups.value = collapsedGroups.value.includes(label)
		? collapsedGroups.value.filter((collapsed) => collapsed !== label)
		: [...collapsedGroups.value, label]
}

const groupElements: Record<string, HTMLElement | null> = {}

function setGroupElement(label: string, el: Element | ComponentPublicInstance | null) {
	groupElements[label] = el as HTMLElement | null
}

const {
	dragging,
	over,
	start,
	offset,
	width: previewWidth,
	isDragging,
	press,
	swallowClickAfterDrop,
} = useRowDrag<T>({
	groups: () => groupElements,
	groupOf: (row) => props.groupBy?.(row) ?? '',
	pick: (row) =>
		props.selection.length > 1 && props.selection.includes(props.rowKey(row))
			? props.rows.filter((selected) => props.selection.includes(props.rowKey(selected)))
			: [row],
	onDrop: (rows, group) => {
		if (rows.length > 1) emit('update:selection', [])
		props.onRowDrop?.(rows, group)
	},
})

const allSelected = computed(
	() => selectableRows.value.length > 0 && props.selection.length === selectableRows.value.length,
)

function toggleRow(key: string) {
	const next = props.selection.includes(key)
		? props.selection.filter((value) => value !== key)
		: [...props.selection, key]
	emit('update:selection', next)
}

function toggleAll() {
	emit('update:selection', allSelected.value ? [] : selectableRows.value.map(props.rowKey))
}
</script>
