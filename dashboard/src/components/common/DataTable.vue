<template>
	<!-- Desktop: one frappe-ui List in column mode. -->
	<List
		v-if="isDesktop"
		:columns="trackSizes"
		:selectable="selectable"
		:selection="selection"
		:row-height="rowHeight"
		divider="full"
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
			<ListRow v-for="n in skeletonRows" :key="`skeleton-${n}`" :value="`skeleton-${n}`">
				<ListCell v-for="column in columns" :key="column.header">
					<Skeleton class="h-3 w-full max-w-24 rounded-full" />
				</ListCell>
			</ListRow>
		</template>

		<!-- `ListRows`, not a bare `v-for`: it feeds the header's select-all the
		     full set of row keys. -->
		<ListRows v-else-if="rows.length" v-slot="{ item }" :items="rows" :row-key="listRowKey">
			<ListRow :value="rowKey(item)" @click="onRowClick?.(item)">
				<ListCell
					v-for="column in columns"
					:key="column.header"
					:class="column.align === 'right' ? 'justify-end' : undefined"
				>
					<slot :name="`cell-${column.key}`" :row="item">{{
						cellText(item, column)
					}}</slot>
				</ListCell>
			</ListRow>
		</ListRows>

		<p v-else class="py-8 text-center text-base text-ink-gray-5">{{ empty }}</p>
	</List>

	<!-- Below `md` the same rows become cards: the primary column is the
	     heading, `field` columns are label/value pairs, actions sit at the
	     foot. Same contract as the React ResponsiveTable it replaces. -->
	<div v-else-if="loading" class="space-y-3">
		<div
			v-for="n in skeletonRows"
			:key="`skeleton-${n}`"
			class="space-y-2 rounded-4 border border-outline-gray-1 p-4"
		>
			<Skeleton class="h-3.5 w-40 rounded-full" />
			<Skeleton class="h-3 w-24 rounded-full" />
		</div>
	</div>

	<p v-else-if="!rows.length" class="py-8 text-center text-base text-ink-gray-5">{{ empty }}</p>

	<div v-else class="space-y-3">
		<label
			v-if="selectable"
			class="flex items-center gap-2 text-sm text-ink-gray-6"
			@click.prevent="toggleAll"
		>
			<Checkbox :model-value="allSelected" />
			Select all
		</label>

		<div
			v-for="row in rows"
			:key="rowKey(row)"
			class="space-y-2 rounded-4 border border-outline-gray-1 p-4"
			@click="onRowClick?.(row)"
		>
			<div class="flex items-start gap-2">
				<Checkbox
					v-if="selectable"
					:model-value="selection.includes(rowKey(row))"
					@click.stop
					@update:model-value="toggleRow(rowKey(row))"
				/>
				<div class="min-w-0 flex-1 text-base font-medium text-ink-gray-8">
					<slot v-if="primaryColumn" :name="`cell-${primaryColumn.key}`" :row="row" />
				</div>
			</div>

			<div
				v-for="column in fieldColumns"
				:key="column.header"
				class="flex items-center justify-between gap-4 text-base"
			>
				<span class="shrink-0 text-ink-gray-5">{{ column.header }}</span>
				<span class="min-w-0 text-right text-ink-gray-7">
					<slot :name="`cell-${column.key}`" :row="row">{{ cellText(row, column) }}</slot>
				</span>
			</div>

			<div v-for="column in actionColumns" :key="column.header" class="pt-1">
				<slot :name="`cell-${column.key}`" :row="row" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts" generic="T">
import { computed } from 'vue'
import { Checkbox, Skeleton } from 'frappe-ui'
import { List, ListCell, ListHeader, ListHeaderCell, ListRow, ListRows } from 'frappe-ui/list'
import { useBreakpoint } from '@/composables/useBreakpoint'

export interface Column {
	/** Column heading, and the label of the field row on mobile. */
	header: string
	/** Names the `cell-<key>` slot, and the row field used when it has none. */
	key: string
	/**
	 * How the column folds into a card below `md`: `primary` is the card's
	 * heading, `field` a label/value row (the default), `actions` the foot.
	 */
	variant?: 'primary' | 'field' | 'actions'
	/** A grid track size, e.g. `'8rem'`. Defaults to an equal share. */
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
		onRowClick?: (row: T) => void
		/** Taller rows for a two-line primary cell; 44 is the dense default. */
		rowHeight?: number
	}>(),
	{ empty: 'Nothing here yet.', selection: () => [], rowHeight: 44 },
)

const emit = defineEmits<{ 'update:selection': [value: string[]] }>()

const skeletonRows = 4

const { isDesktop } = useBreakpoint()

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

const primaryColumn = computed(() => props.columns.find((c) => c.variant === 'primary'))
const fieldColumns = computed(() => props.columns.filter((c) => (c.variant ?? 'field') === 'field'))
const actionColumns = computed(() => props.columns.filter((c) => c.variant === 'actions'))

const allSelected = computed(
	() => props.rows.length > 0 && props.selection.length === props.rows.length,
)

function toggleRow(key: string) {
	const next = props.selection.includes(key)
		? props.selection.filter((value) => value !== key)
		: [...props.selection, key]
	emit('update:selection', next)
}

function toggleAll() {
	emit('update:selection', allSelected.value ? [] : props.rows.map(props.rowKey))
}
</script>
