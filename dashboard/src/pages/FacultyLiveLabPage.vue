<template>
	<AppHeader title="Live">
		<template #left-mobile>
			<PageHeaderBackButton :fallback-route="`/faculty/assignments/${assignmentId}`" />
		</template>
	</AppHeader>

	<PageBody width="wide">
		<LoadError
			v-if="failed"
			title="Could not load the live view"
			:loading="live.loading"
			@retry="live.reload()"
		/>

		<PageSkeleton v-else-if="live.loading && !live.data" />

		<EmptyState
			v-else-if="!live.data"
			icon="lucide-file-question"
			title="Assignment not found"
			description="It may have been deleted."
		/>

		<EmptyState
			v-else-if="!live.data.students.length"
			icon="lucide-users"
			title="No students yet"
		/>

		<div v-else class="space-y-6">
			<h1 class="break-words text-2xl text-ink-gray-9 md:sr-only">{{ live.data.title }}</h1>

			<section v-if="live.data.common_errors.length" class="space-y-3">
				<h2 class="text-lg font-semibold text-ink-gray-8">Common errors</h2>
				<ul
					class="divide-y divide-outline-gray-1 rounded-4 border border-outline-gray-1 bg-surface-base"
				>
					<li
						v-for="error in live.data.common_errors"
						:key="`${error.error_type}:${error.error_line}`"
						class="px-4 py-2.5 text-base text-ink-gray-8"
					>
						{{ errorAt(error) }}: {{ error.students }} students
					</li>
				</ul>
			</section>

			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-ink-gray-8">Students</h2>
				<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<li
						v-for="row in live.data.students"
						:key="row.student"
						class="space-y-2 rounded-4 border border-outline-gray-1 bg-surface-base p-4"
					>
						<div class="flex items-center justify-between gap-2">
							<p class="min-w-0 truncate text-base font-medium text-ink-gray-8">
								{{ row.full_name ?? row.student }}
							</p>
							<Badge
								v-if="status(row)"
								:label="status(row)?.label"
								:theme="status(row)?.theme"
								variant="subtle"
							/>
						</div>
						<p
							v-if="row.total"
							class="flex items-center gap-1.5 text-base text-ink-gray-8"
						>
							<span
								:class="[
									row.passed === row.total
										? 'lucide-circle-check text-ink-green-6'
										: 'lucide-circle-x text-ink-red-6',
									'size-4 shrink-0',
								]"
								aria-hidden="true"
							/>
							{{ row.passed }} of {{ row.total }} tests passed
						</p>
						<p
							v-if="row.error_type"
							class="flex items-center gap-1.5 text-base text-ink-gray-8"
						>
							<span
								class="lucide-circle-alert size-4 shrink-0 text-ink-red-6"
								aria-hidden="true"
							/>
							<span class="min-w-0 truncate">{{ errorAt(row) }}</span>
						</p>
						<p v-if="row.last_active_at" class="text-sm text-ink-gray-5">
							{{ activeSince(row.last_active_at, live.data.now) }}
						</p>
					</li>
				</ul>
			</section>
		</div>
	</PageBody>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { Badge, PageHeaderBackButton } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolledCall, usePolling } from '@/composables/usePolling'
import { formatDateTime, parseDatetime } from '@/lib/dates'
import { isRefusal } from '@/lib/frappeError'

interface CodeError {
	error_type: string | null
	error_line: number | null
}

interface LiveStudent extends CodeError {
	student: string
	full_name: string | null
	submitted: boolean
	last_active_at: string | null
	passed: number | null
	total: number | null
	stuck: boolean
}

interface LiveLab {
	title: string
	now: string
	students: LiveStudent[]
	common_errors: (CodeError & { students: number })[]
}

const LIVE_POLL_MS = 10_000

const props = defineProps<{ assignmentId: string }>()

const breadcrumbs = useBreadcrumbs()

const live = usePolledCall<LiveLab, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.live_lab.get_live_lab',
	params: () => ({ assignment: props.assignmentId }),
})
usePolling(live.reload, LIVE_POLL_MS)
const failed = useLoadFailed(live, { except: isRefusal })

function status(row: LiveStudent): { label: string; theme: 'amber' | 'green' | 'gray' } | null {
	if (row.stuck) return { label: 'Stuck', theme: 'amber' }
	if (row.submitted) return { label: 'Submitted', theme: 'green' }
	if (!row.last_active_at) return { label: 'Not started', theme: 'gray' }
	return null
}

function errorAt(error: CodeError): string {
	return error.error_line
		? `${error.error_type} on line ${error.error_line}`
		: `${error.error_type}`
}

function activeSince(at: string, now: string): string {
	const minutes = Math.floor(
		(parseDatetime(now).valueOf() - parseDatetime(at).valueOf()) / 60_000,
	)
	if (minutes < 1) return 'Active just now'
	if (minutes < 60) return `Active ${minutes} min ago`
	return `Active ${formatDateTime(at)}`
}

watch(
	() => live.data?.title,
	(title) => {
		breadcrumbs.set(
			title
				? [
						{ label: 'Assignments', route: '/faculty/assignments' },
						{ label: title, route: `/faculty/assignments/${props.assignmentId}` },
						{ label: 'Live' },
					]
				: [],
		)
	},
	{ immediate: true },
)
</script>
