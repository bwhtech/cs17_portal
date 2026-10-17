<template>
	<AppHeader title="Dashboard" />

	<PageBody width="narrow" class="space-y-6">
		<div>
			<h1 class="break-words text-2xl text-ink-gray-9">Welcome back, {{ firstName }}.</h1>
			<p class="mt-1 text-sm text-ink-gray-5">{{ today }}</p>
		</div>

		<section class="space-y-4 rounded-4 border border-outline-gray-1 bg-surface-base p-5">
			<div class="flex items-center justify-between gap-3">
				<h2 class="text-lg-semibold text-ink-gray-8">Assigned to you</h2>
				<Button
					v-if="total > assigned.length"
					:label="`View all (${total.toLocaleString()})`"
					route="/faculty/submissions"
				/>
			</div>

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
				<div
					v-for="submission in assigned"
					:key="submission.name"
					class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
				>
					<div class="min-w-0">
						<p class="truncate text-base text-ink-gray-8" :title="submission.full_name">
							{{ submission.full_name }}
						</p>
						<RouterLink
							:to="`/faculty/assignments/${submission.assignment}`"
							class="mt-1 block truncate rounded-1 text-sm text-ink-gray-5 hover:text-ink-gray-8 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-outline-gray-3"
							:title="submission.assignment_title"
						>
							{{ submission.assignment_title }}
						</RouterLink>
					</div>
					<div class="flex shrink-0 items-center gap-2">
						<Badge
							v-if="submission.grade"
							label="Graded"
							theme="green"
							variant="subtle"
						/>
						<Button
							:label="submission.grade ? 'Edit grade' : 'Grade'"
							icon-right="lucide-arrow-right"
							:route="`/faculty/submissions/${submission.name}`"
						/>
					</div>
				</div>
			</div>
		</section>
	</PageBody>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Badge, Button, ErrorMessage, Skeleton, useCall } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import { useSession } from '@/composables/useSession'
import { formatLongDate } from '@/lib/dates'
import type { CS17Submission } from '@/types'

const { profile } = useSession()

const firstName = computed(() => profile.value?.full_name?.split(' ')[0] ?? 'Faculty')
const today = formatLongDate()

const assignedCall = useCall<{ submissions: CS17Submission[]; total: number }, { limit: number }>({
	url: '/api/v2/method/cs17_portal.api.get_assigned_submission_summary',
	params: { limit: 5 },
})

const total = computed(() => assignedCall.data?.total ?? 0)
const assigned = computed(() => assignedCall.data?.submissions ?? [])
const failed = computed(() => Boolean(assignedCall.error) && !assignedCall.data)
</script>
