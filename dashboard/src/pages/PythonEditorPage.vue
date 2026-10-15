<template>
	<div
		class="flex h-full flex-col overflow-hidden bg-surface-base md:absolute md:inset-0"
		:class="{ 'max-md:min-h-[36rem]': !isZen }"
	>
		<div
			class="flex min-h-12 shrink-0 items-center gap-2 border-b border-outline-gray-1 px-3 sm:px-5"
		>
			<Button
				variant="ghost"
				icon="lucide-arrow-left"
				aria-label="Back to projects"
				tooltip="Projects"
				:route="projectsPath"
			/>
			<h1 class="min-w-0 truncate text-base text-ink-gray-8" :title="title">{{ title }}</h1>
			<span
				v-if="statusLabel"
				class="shrink-0 text-sm"
				:class="[statusClass, status === 'error' ? '' : 'hidden sm:inline']"
			>
				{{ statusLabel }}
			</span>

			<div class="ml-auto flex shrink-0 items-center gap-2">
				<TimeLeft
					v-if="timing.data?.ends_at && timing.data.now && canSubmit"
					:key="timing.data.ends_at"
					:ends-at="timing.data.ends_at"
					:now="timing.data.now"
					@end="submitWhenTimeIsUp"
				/>
				<Button
					:icon="isZen ? 'lucide-minimize-2' : 'lucide-maximize-2'"
					:aria-label="isZen ? 'Exit zen mode' : 'Enter zen mode'"
					:tooltip="isZen ? 'Exit zen mode' : 'Zen mode'"
					@click="toggle"
				/>
				<template v-if="project.data">
					<Button
						v-if="!readOnly"
						:icon-left="isDesktop ? 'lucide-save' : undefined"
						:icon="isDesktop ? undefined : 'lucide-save'"
						label="Save"
						:loading="status === 'saving'"
						@click="save"
					/>
					<Button
						v-if="sampleTests.length"
						:icon-left="isDesktop ? 'lucide-list-checks' : undefined"
						:icon="isDesktop ? undefined : 'lucide-list-checks'"
						label="Run tests"
						:loading="testing"
						@click="runSampleTests"
					/>
					<Button
						:variant="canSubmit || canReattempt ? 'subtle' : 'solid'"
						theme="gray"
						:icon-left="isDesktop ? 'lucide-play' : undefined"
						:icon="isDesktop ? undefined : 'lucide-play'"
						label="Run"
						tooltip="Run (Ctrl+Enter)"
						:loading="running"
						@click="run"
					/>
					<Button
						v-if="canReattempt && timing.data"
						variant="solid"
						theme="gray"
						:icon-left="isDesktop ? 'lucide-rotate-ccw' : undefined"
						:icon="isDesktop ? undefined : 'lucide-rotate-ccw'"
						label="Reattempt"
						@click="python.reattempt(timing.data, timing.reload)"
					/>
					<Button
						v-if="canSubmit"
						variant="solid"
						theme="gray"
						:icon-left="isDesktop ? 'lucide-send' : undefined"
						:icon="isDesktop ? undefined : 'lucide-send'"
						label="Submit"
						:loading="status === 'saving'"
						@click="openSubmit"
					/>
				</template>
			</div>
		</div>

		<div class="min-h-0 flex-1">
			<EmptyState
				v-if="failed"
				icon="lucide-triangle-alert"
				title="Could not open this project"
				description="It may have been removed, or it belongs to someone else."
			>
				<template #action>
					<Button label="Back to projects" :route="projectsPath" />
				</template>
			</EmptyState>

			<div v-else-if="!project.data" class="flex h-full items-center justify-center">
				<LoadingIndicator class="size-6 text-ink-gray-5" />
			</div>

			<div v-else class="flex h-full flex-col max-lg:overflow-y-auto lg:flex-row">
				<ProblemPanel
					v-if="assignment.data"
					class="shrink-0 border-outline-gray-1 px-3 py-4 max-lg:border-b sm:px-5 lg:w-[38%] lg:overflow-y-auto lg:border-r"
					:assignment="assignment.data"
				/>
				<div class="flex min-h-0 flex-1 flex-col max-lg:min-h-[36rem]">
					<PythonEditor
						v-model="code"
						class="min-h-0 flex-1"
						:read-only="readOnly"
						@run="run"
					/>
					<RunPanel
						v-model:stdin="stdin"
						v-model:tab="panelTab"
						class="h-64 shrink-0 border-t border-outline-gray-1"
						:result="result"
						:running="running"
						:show-tests="sampleTests.length > 0"
						:test-runs="testRuns"
						:testing="testing"
					/>
				</div>
			</div>
		</div>

		<SubmitProjectDialog
			v-if="canSubmit"
			v-model:open="submitOpen"
			:project="id"
			project-type="Python"
			:preset-assignment="assignmentName"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { Button, LoadingIndicator, toast, useCall } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import SubmitProjectDialog from '@/components/projects/SubmitProjectDialog.vue'
import ProblemPanel from '@/components/python/ProblemPanel.vue'
import PythonEditor from '@/components/python/PythonEditor.vue'
import RunPanel from '@/components/python/RunPanel.vue'
import TimeLeft from '@/components/python/TimeLeft.vue'
import { usePythonAssignment } from '@/components/assignments/pythonEditor'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { usePolling } from '@/composables/usePolling'
import { useProjectsPath } from '@/composables/useProjectsPath'
import { useTabLeaveWatch } from '@/composables/useTabLeaveWatch'
import { onBeforeLogout, useSession } from '@/composables/useSession'
import { useZenMode, useZenOnMount } from '@/composables/useZenMode'
import { parseDatetime } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { usePythonRunner, type RunResult } from '@/lib/python/runner'
import { runTests, type TestRun } from '@/lib/python/tests'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Assignment, CS17Project } from '@/types'

const AUTOSAVE_IDLE_MS = 2000

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const props = defineProps<{ id: string }>()

const route = useRoute()
const projectsPath = useProjectsPath()
const { isStudent } = useSession()
const { isDesktop } = useBreakpoint()
const { isZen, toggle } = useZenMode()
useZenOnMount()

const project = useCall<CS17Project, { project: string }>({
	url: '/api/v2/method/cs17_portal.api.get_project',
	params: () => ({ project: props.id }),
	refetch: true,
})
const failed = computed(() => Boolean(project.error) && !project.data)
const title = computed(() => project.data?.project_title ?? 'Project')

const assignmentName = computed(
	() => (route.query.assignment as string) || project.data?.assignment || null,
)

const assignment = useCall<CS17Assignment, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_assignment',
	params: () => ({ assignment: assignmentName.value ?? '' }),
	immediate: false,
})

const timing = useCall<CS17Assignment, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_assignment',
	params: () => ({ assignment: assignmentName.value ?? '' }),
	immediate: false,
})

const assignmentClosed = useCall<boolean, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.is_assignment_closed',
	params: () => ({ assignment: assignmentName.value ?? '' }),
	immediate: false,
})

watch(
	assignmentName,
	(name) => {
		if (!name || !isStudent.value) return
		assignment.reload()
		timing.reload()
		assignmentClosed.reload()
	},
	{ immediate: true },
)

usePolling(() => {
	if (assignment.data?.time_limit) timing.reload()
})

const timeIsUp = ref(false)

watch(
	() => timing.data?.ends_at,
	(endsAt, previous) => {
		const now = timing.data?.now
		if (!endsAt || !previous || !now || parseDatetime(endsAt) <= parseDatetime(now)) return
		timeIsUp.value = false
		assignmentClosed.reload()
	},
)
const readOnly = computed(
	() => route.query.readonly === '1' || assignmentClosed.data === true || timeIsUp.value,
)
const canSubmit = computed(() => isStudent.value && Boolean(assignment.data) && !readOnly.value)
const canReattempt = computed(
	() => isStudent.value && readOnly.value && Boolean(timing.data?.next_attempt),
)
const python = usePythonAssignment()
const sampleTests = computed(() => assignment.data?.sample_tests ?? [])

useTabLeaveWatch(
	() => props.id,
	() => Boolean(assignment.data?.watch_tab_switches) && canSubmit.value,
)
const submitOpen = ref(false)

const saveCall = useCall<{ last_saved_at: string }, { project: string; code: string }>({
	url: '/api/v2/method/cs17_portal.api.save_python_project',
	method: 'POST',
	immediate: false,
})

const code = ref('')
const savedCode = ref('')
const status = ref<SaveStatus>('idle')
let opened = false
let autosaveTimer: ReturnType<typeof setTimeout> | undefined
let saving: Promise<boolean> = Promise.resolve(true)

const statusLabel = computed(
	() => ({ idle: '', saving: 'Saving…', saved: 'Saved', error: 'Save failed' })[status.value],
)
const statusClass = computed(() =>
	status.value === 'error' ? 'text-ink-red-6' : 'text-ink-gray-5',
)

watch(
	() => project.data,
	(doc) => {
		if (!doc || opened) return
		opened = true
		code.value = doc.code ?? ''
		savedCode.value = code.value
	},
	{ immediate: true },
)

watch(code, (value) => {
	clearTimeout(autosaveTimer)
	if (value === savedCode.value || readOnly.value) return
	status.value = 'idle'
	autosaveTimer = setTimeout(save, AUTOSAVE_IDLE_MS)
})

function hasUnsavedEdits() {
	return opened && code.value !== savedCode.value
}

function save(): Promise<boolean> {
	clearTimeout(autosaveTimer)
	saving = saving.then(saveLatest)
	return saving
}

async function saveLatest(): Promise<boolean> {
	const content = code.value
	if (content === savedCode.value) return true
	status.value = 'saving'
	const saved = await trySubmit(saveCall, { project: props.id, code: content })
	if (saveCall.error || !saved) {
		status.value = 'error'
		toast.error(frappeErrorMessage(saveCall.error, 'Could not save the project.'))
		return false
	}
	savedCode.value = content
	status.value = code.value === content ? 'saved' : 'idle'
	return true
}

const runner = usePythonRunner()
const stdin = ref('')
watch(
	() => sampleTests.value[0]?.input,
	(input) => {
		if (input && !stdin.value) stdin.value = input
	},
	{ immediate: true },
)
const panelTab = ref('output')
const result = ref<RunResult | null>(null)
const running = ref(false)

const testRuns = ref<TestRun[] | null>(null)
const testing = ref(false)

async function run() {
	if (running.value || testing.value) return
	running.value = true
	panelTab.value = 'output'
	result.value = await runner.run(code.value, stdin.value)
	running.value = false
}

async function runSampleTests() {
	if (running.value || testing.value) return
	testing.value = true
	panelTab.value = 'tests'
	testRuns.value = null
	testRuns.value = await runTests(runner, code.value, sampleTests.value)
	testing.value = false
}

async function openSubmit() {
	if (await save()) submitOpen.value = true
}

const submitCall = useCall<{ name: string }, { assignment: string; project: string }>({
	url: '/api/v2/method/cs17_portal.api.submit_python_project',
	method: 'POST',
	immediate: false,
})

async function submitWhenTimeIsUp() {
	timeIsUp.value = true
	if (!code.value.trim() || !assignmentName.value) {
		toast.info('Time is up.')
		timing.reload()
		return
	}
	if (!(await save())) return
	await trySubmit(submitCall, { assignment: assignmentName.value, project: props.id })
	if (submitCall.error) {
		toast.error(frappeErrorMessage(submitCall.error, 'Could not submit your code.'))
		return
	}
	toast.success('Time is up. Your code was submitted.')
	timing.reload()
}

onBeforeRouteLeave(() => !hasUnsavedEdits() || save())
onBeforeLogout(() => !hasUnsavedEdits() || save())

function warnBeforeUnload(event: BeforeUnloadEvent) {
	if (hasUnsavedEdits()) event.preventDefault()
}

onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => {
	clearTimeout(autosaveTimer)
	window.removeEventListener('beforeunload', warnBeforeUnload)
})
</script>
