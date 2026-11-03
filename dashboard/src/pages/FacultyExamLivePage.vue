<template>
	<AppHeader title="Live">
		<template #left-mobile>
			<PageHeaderBackButton :fallback-route="`/faculty/exams/${examId}`" />
		</template>
	</AppHeader>

	<PageBody>
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
			title="Exam not found"
			description="It may have been deleted."
		/>

		<div v-else class="flex flex-col gap-6 lg:flex-row lg:items-start">
			<section class="min-w-0 flex-1 space-y-3">
				<h1 class="break-words text-2xl text-ink-gray-9 md:sr-only">
					{{ live.data.title }}
				</h1>
				<h2 class="text-lg font-semibold text-ink-gray-8">Students</h2>
				<EmptyState
					v-if="!live.data.students.length"
					icon="lucide-users"
					title="No students in this cohort yet"
				/>
				<ul
					v-else
					class="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3"
				>
					<ExamLiveStudentCard
						v-for="student in live.data.students"
						:key="student.student"
						:student="student"
						:questions="live.data.questions"
						:now="live.data.now"
						@view-code="openCode(student)"
					/>
				</ul>
			</section>

			<ExamAlertFeed
				class="w-full shrink-0 lg:w-80"
				:exam-title="live.data.title"
				:events="events"
				:questions="live.data.questions"
			/>
		</div>
	</PageBody>

	<ExamCodeDialog
		v-if="codeOpen && codeStudent"
		v-model:open="codeOpen"
		:exam="examId"
		:student="codeStudent"
		:questions="live.data?.questions ?? []"
	/>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { PageHeaderBackButton } from 'frappe-ui'
import AppHeader from '@/components/shell/AppHeader.vue'
import PageBody from '@/components/common/PageBody.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import LoadError from '@/components/common/LoadError.vue'
import PageSkeleton from '@/components/common/PageSkeleton.vue'
import ExamAlertFeed from '@/components/exams/live/ExamAlertFeed.vue'
import ExamCodeDialog from '@/components/exams/live/ExamCodeDialog.vue'
import ExamLiveStudentCard from '@/components/exams/live/ExamLiveStudentCard.vue'
import type { ExamEvent, ExamLive, LiveStudent } from '@/components/exams/live/examLive'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { useLoadFailed } from '@/composables/useLoadFailed'
import { usePolledCall } from '@/composables/usePolling'
import { isRefusal } from '@/lib/frappeError'

const LIVE_POLL_MS = 10_000

const props = defineProps<{ examId: string }>()

const breadcrumbs = useBreadcrumbs()

const events = ref<ExamEvent[]>([])
const since = computed(() =>
	events.value.reduce<string | undefined>(
		(newest, event) => (newest && newest > event.modified ? newest : event.modified),
		undefined,
	),
)

const live = usePolledCall<ExamLive, { exam: string; since?: string }>({
	url: '/api/v2/method/cs17_portal.exam_live.get_exam_live',
	method: 'GET',
	params: () => ({ exam: props.examId, since: since.value }),
	onSuccess: (data) => {
		if (!data.events.length) return
		const byName = new Map(events.value.map((event) => [event.name, event]))
		for (const event of data.events) byName.set(event.name, event)
		events.value = [...byName.values()].sort((a, b) =>
			b.occurred_at.localeCompare(a.occurred_at),
		)
	},
})
const failed = useLoadFailed(live, { except: isRefusal })

// Polls in a hidden tab too, unlike usePolling, so a background notification can fire.
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => (timer = setInterval(live.reload, LIVE_POLL_MS)))
onUnmounted(() => clearInterval(timer))

const codeOpen = ref(false)
const codeStudent = ref<LiveStudent | null>(null)

function openCode(student: LiveStudent) {
	codeStudent.value = student
	codeOpen.value = true
}

watch(
	() => live.data?.title,
	(title) => {
		breadcrumbs.set(
			title
				? [
						{ label: 'Exams', route: '/faculty/exams' },
						{ label: title, route: `/faculty/exams/${props.examId}` },
						{ label: 'Live' },
					]
				: [],
		)
	},
	{ immediate: true },
)
</script>
