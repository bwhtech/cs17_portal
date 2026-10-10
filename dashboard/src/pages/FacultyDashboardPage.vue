<template>
	<AppHeader title="Dashboard" />

	<PageBody width="narrow" class="space-y-6">
		<div>
			<h1 class="text-2xl text-ink-gray-9">Welcome back, {{ firstName }}.</h1>
			<p class="mt-1 text-sm text-ink-gray-5">{{ today }}</p>
		</div>

		<section class="space-y-4 rounded-4 border border-outline-gray-1 bg-surface-base p-5">
			<h2 class="text-lg-semibold text-ink-gray-8">Assigned to you</h2>

			<ErrorMessage v-if="failed" message="Could not load your assigned submissions." />

			<div
				v-else-if="assignedCall.loading && !assignedCall.data"
				class="cs17-delay-in space-y-3"
			>
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
					class="-mx-2 flex items-center justify-between gap-4 rounded-4 px-2 py-3 hover:bg-surface-gray-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
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
	</PageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { ErrorMessage, Skeleton, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
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
const failed = computed(() => Boolean(assignedCall.error) && !assignedCall.data)
</script>
