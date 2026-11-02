<template>
	<article class="space-y-5 rounded-4 border border-outline-gray-1 bg-surface-base p-5">
		<div class="flex items-center gap-3">
			<Avatar
				class="shrink-0"
				size="xl"
				:image="child.profile_picture ?? undefined"
				:label="child.full_name"
			/>
			<div class="min-w-0 flex-1">
				<h2 class="truncate text-base-medium text-ink-gray-8">
					<RouterLink
						:to="childRoute"
						class="rounded-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
					>
						{{ child.full_name }}
					</RouterLink>
				</h2>
				<p v-if="child.cohort" class="truncate text-sm text-ink-gray-5">
					{{ child.cohort }}
				</p>
			</div>
			<div v-if="child.average !== null" class="shrink-0 text-right">
				<p class="text-xs text-ink-gray-5">Average</p>
				<p class="text-base-medium text-ink-gray-8">{{ averageLabel(child) }}</p>
			</div>
		</div>

		<section v-for="list in lists" :key="list.title" class="space-y-1">
			<h3 class="text-sm text-ink-gray-5">{{ list.title }}</h3>
			<ul v-if="list.rows.length" class="divide-y divide-outline-gray-1">
				<li
					v-for="row in list.rows.slice(0, LIST_LIMIT)"
					:key="row.name"
					class="flex items-baseline justify-between gap-3 py-1.5 text-base"
				>
					<span class="min-w-0 truncate text-ink-gray-8">{{ row.title }}</span>
					<span class="shrink-0" :class="list.valueClass">{{ list.value(row) }}</span>
				</li>
			</ul>
			<p v-else class="text-p-sm text-ink-gray-5">{{ list.empty }}</p>
			<RouterLink
				v-if="list.rows.length > LIST_LIMIT"
				:to="childRoute"
				class="inline-block rounded-2 text-sm text-ink-gray-5 hover:text-ink-gray-8 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
			>
				{{ list.rows.length - LIST_LIMIT }} more →
			</RouterLink>
		</section>
	</article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Avatar } from 'frappe-ui'
import { formatDate, formatDateTime } from '@/lib/dates'
import {
	averageLabel,
	gradeLabel,
	type GuardianAssignment,
	type GuardianChild,
} from '@/lib/guardian'

export interface GuardianChildSummary extends GuardianChild {
	due: GuardianAssignment[]
	missing: GuardianAssignment[]
	graded: GuardianAssignment[]
}

const LIST_LIMIT = 5

const props = defineProps<{ child: GuardianChildSummary }>()

const childRoute = computed(() => `/guardian/students/${props.child.student}`)

const lists = computed(() => [
	{
		title: 'Due in the next 7 days',
		rows: props.child.due,
		empty: 'Nothing due.',
		value: (row: GuardianAssignment) => formatDateTime(row.due_date),
		valueClass: 'text-ink-gray-6',
	},
	{
		title: 'Missing',
		rows: props.child.missing,
		empty: 'Nothing missing.',
		value: (row: GuardianAssignment) => `Due ${formatDate(row.due_date)}`,
		valueClass: 'text-ink-red-6',
	},
	{
		title: 'Latest grades',
		rows: props.child.graded,
		empty: 'No grades yet.',
		value: gradeLabel,
		valueClass: 'text-ink-gray-8',
	},
])
</script>
