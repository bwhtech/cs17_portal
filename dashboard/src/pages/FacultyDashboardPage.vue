<template>
	<AppHeader title="Dashboard" />

	<div class="mx-auto max-w-4xl space-y-6 px-3 py-5 pb-10 sm:px-5">
		<div>
			<h1 class="text-3xl text-ink-gray-9">Welcome back, {{ firstName }}.</h1>
			<p class="mt-1 text-sm text-ink-gray-5">{{ today }}</p>
		</div>

		<div
			class="inline-flex min-w-40 flex-col gap-1 rounded-4 border border-outline-gray-1 bg-surface-base px-5 py-4"
		>
			<Skeleton v-if="publishedCount === null" class="h-6 w-10 rounded-full" />
			<p v-else class="text-2xl text-ink-gray-9 tabular-nums">{{ publishedCount }}</p>
			<p class="text-xs text-ink-gray-5">Published assignments</p>
		</div>

		<section class="space-y-4 rounded-4 border border-outline-gray-1 bg-surface-base p-5">
			<h2 class="text-lg-semibold text-ink-gray-8">Assigned to you</h2>

			<div v-if="assignedCall.loading && !assignedCall.data" class="space-y-3">
				<Skeleton v-for="n in 3" :key="n" class="h-8 w-full rounded-4" />
			</div>

			<p v-else-if="!assigned.length" class="text-p-sm text-ink-gray-5">
				No submissions assigned to you yet.
			</p>

			<div v-else class="divide-y divide-outline-gray-1">
				<RouterLink
					v-for="submission in assigned"
					:key="submission.name"
					:to="`/faculty/assignments/${submission.assignment}`"
					class="-mx-2 flex items-center justify-between gap-4 rounded-4 px-2 py-3 hover:bg-surface-gray-2"
				>
					<div class="min-w-0">
						<p class="truncate text-base text-ink-gray-8">{{ submission.full_name }}</p>
						<p class="mt-1 truncate text-sm text-ink-gray-5">
							{{ submission.assignment_title }}
						</p>
					</div>
					<span
						class="shrink-0 text-sm"
						:class="submission.grade ? 'text-ink-gray-5' : 'text-ink-gray-8'"
					>
						{{ submission.grade ? 'Graded' : 'Needs grading' }}
					</span>
				</RouterLink>
			</div>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Skeleton, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import { useSession } from '@/composables/useSession'
import { formatLongDate } from '@/lib/dates'
import type { CS17Submission } from '@/types'

const { profile } = useSession()

const firstName = computed(() => profile.value?.full_name?.split(' ')[0] ?? 'Faculty')
const today = formatLongDate()

const assignedCall = useCall<CS17Submission[], { limit: number }>({
	url: '/api/v2/method/cs17_portal.api.get_assigned_submissions',
	params: { limit: 5 },
})

const assigned = computed(() => assignedCall.data ?? [])

// `useList` answers with rows, never a count, so the one count on this screen
// goes through `frappe.client.get_count`. Its `filters` travel as a JSON
// string — a plain object would serialise to "[object Object]".
const countCall = useCall<number, { doctype: string; filters: string }>({
	url: '/api/v2/method/frappe.client.get_count',
	params: { doctype: 'CS17 Assignment', filters: JSON.stringify({ is_published: 1 }) },
})

const publishedCount = computed(() => (typeof countCall.data === 'number' ? countCall.data : null))
</script>
