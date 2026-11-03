<template>
	<div class="flex h-full flex-col">
		<div
			class="flex min-h-11 shrink-0 items-center gap-2 border-b border-outline-gray-1 px-3 sm:px-5"
		>
			<h2 class="min-w-0 truncate text-base text-ink-gray-8 max-md:sr-only" :title="title">
				{{ title }}
			</h2>
			<span
				v-if="statusLabel"
				class="shrink-0 text-sm"
				:class="status === 'error' ? 'text-ink-red-6' : 'text-ink-gray-5'"
			>
				{{ statusLabel }}
			</span>

			<div v-if="project.data" class="ml-auto flex shrink-0 items-center gap-2">
				<Button
					v-if="!readOnly"
					:icon-left="isDesktop ? 'lucide-save' : undefined"
					:icon="isDesktop ? undefined : 'lucide-save'"
					label="Save"
					:tooltip="isDesktop ? undefined : 'Save'"
					:loading="status === 'saving'"
					@click="save"
				/>
				<Button
					v-if="sampleTests.length"
					:icon-left="isDesktop ? 'lucide-list-checks' : undefined"
					:icon="isDesktop ? undefined : 'lucide-list-checks'"
					label="Run tests"
					:tooltip="isDesktop ? undefined : 'Run tests'"
					:loading="testing"
					@click="runSampleTests"
				/>
				<Button
					:icon-left="isDesktop ? 'lucide-play' : undefined"
					:icon="isDesktop ? undefined : 'lucide-play'"
					label="Run"
					tooltip="Run (Ctrl+Enter)"
					:loading="running"
					@click="run"
				/>
				<template v-if="!readOnly">
					<Button
						v-if="canSkip"
						:icon-left="isDesktop ? 'lucide-skip-forward' : undefined"
						:icon="isDesktop ? undefined : 'lucide-skip-forward'"
						label="Skip"
						:tooltip="isDesktop ? undefined : 'Skip'"
						:loading="skipCall.loading"
						@click="confirmSkip"
					/>
					<Button
						:icon-left="isDesktop ? 'lucide-send' : undefined"
						:icon="isDesktop ? undefined : 'lucide-send'"
						label="Submit"
						:tooltip="isDesktop ? undefined : 'Submit'"
						:loading="submitCall.loading"
						@click="confirmSubmit"
					/>
				</template>
			</div>
		</div>

		<LoadError
			v-if="failed"
			title="Could not open this question"
			:loading="project.loading"
			@retry="project.reload()"
		/>

		<div v-else-if="!project.data" class="flex flex-1 items-center justify-center">
			<LoadingIndicator class="size-6 text-ink-gray-5" />
		</div>

		<div v-else class="flex min-h-0 flex-1 flex-col max-lg:overflow-y-auto lg:flex-row">
			<ProblemPanel
				v-if="problem"
				class="shrink-0 border-outline-gray-1 px-3 py-4 max-lg:border-b sm:px-5 lg:w-[38%] lg:overflow-y-auto lg:border-r"
				:assignment="problem"
				@copy="emit('copyQuestion')"
			/>
			<div class="flex min-h-0 flex-1 flex-col max-lg:min-h-[36rem]">
				<PythonEditor
					v-model="code"
					class="min-h-0 flex-1"
					:read-only="readOnly"
					@run="run"
					@paste="recordPaste"
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
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Button, LoadingIndicator, dialog, toast, useCall } from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import ProblemPanel from '@/components/python/ProblemPanel.vue'
import PythonEditor from '@/components/python/PythonEditor.vue'
import RunPanel from '@/components/python/RunPanel.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useCodeRunRecorder } from '@/composables/useCodeRunRecorder'
import { usePasteWatch } from '@/composables/usePasteWatch'
import { useTabLeaveWatch } from '@/composables/useTabLeaveWatch'
import { onBeforeLogout } from '@/composables/useSession'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { PythonRunner, RunResult } from '@/lib/python/runner'
import { runTests, type TestRun } from '@/lib/python/tests'
import { STORAGE_KEYS, readJSON, removeKey, writeJSON } from '@/lib/storage'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Assignment, CS17Project } from '@/types'

const AUTOSAVE_IDLE_MS = 2000

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
type LocalCopy = { code: string; lastSavedAt: string | null }

const props = defineProps<{
	exam: string
	assignment: string
	project: string
	title: string
	runner: PythonRunner
	readOnly?: boolean
	canSkip?: boolean
	canComeBack?: boolean
}>()

const emit = defineEmits<{ changed: []; copyQuestion: [] }>()

const { isDesktop } = useBreakpoint()

const project = useCall<CS17Project, { project: string }>({
	url: '/api/v2/method/cs17_portal.api.get_project',
	params: () => ({ project: props.project }),
})
const failed = computed(() => Boolean(project.error) && !project.data)

const assignmentCall = useCall<CS17Assignment, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.get_student_assignment',
	params: () => ({ assignment: props.assignment }),
})
const problem = computed(() => assignmentCall.data && { ...assignmentCall.data, due_date: '' })
const sampleTests = computed(() => assignmentCall.data?.sample_tests ?? [])

const isActive = ref(true)
onActivated(() => {
	isActive.value = true
})
onDeactivated(() => {
	isActive.value = false
	if (!props.readOnly && hasUnsavedEdits()) save()
})

const isWatching = computed(
	() => Boolean(assignmentCall.data?.watch_tab_switches) && !props.readOnly && isActive.value,
)
useTabLeaveWatch(
	() => props.project,
	() => isWatching.value,
)
const recordPaste = usePasteWatch(
	() => props.project,
	() => isWatching.value,
)
const codeRuns = useCodeRunRecorder(
	() => props.project,
	() => !props.readOnly,
)

const saveCall = useCall<{ last_saved_at: string }, { project: string; code: string }>({
	url: '/api/v2/method/cs17_portal.api.save_python_project',
	method: 'POST',
	immediate: false,
})

const code = ref('')
const savedCode = ref('')
const status = ref<SaveStatus>('idle')
let opened = false
let lastSavedAt: string | null = null
let localCopyChecked = false
let autosaveTimer: ReturnType<typeof setTimeout> | undefined
let saving: Promise<boolean> = Promise.resolve(true)
let saveBeforeLeaveFailed = false

const statusLabel = computed(
	() => ({ idle: '', saving: 'Saving…', saved: 'Saved', error: 'Save failed' })[status.value],
)

watch(
	() => project.data,
	(doc) => {
		if (!doc || opened) return
		opened = true
		code.value = doc.code ?? ''
		savedCode.value = code.value
		lastSavedAt = doc.last_saved_at
		restoreLocalCopy()
	},
	{ immediate: true },
)

watch(
	() => props.readOnly,
	(readOnly) => {
		clearTimeout(autosaveTimer)
		if (readOnly) return
		restoreLocalCopy()
		if (hasUnsavedEdits()) autosaveTimer = setTimeout(save, AUTOSAVE_IDLE_MS)
	},
)

function restoreLocalCopy() {
	if (!opened || props.readOnly || localCopyChecked) return
	localCopyChecked = true
	const copy = readJSON<LocalCopy | null>(STORAGE_KEYS.unsavedPythonCode(props.project), null)
	if (copy?.lastSavedAt === lastSavedAt) code.value = copy.code
	else updateLocalCopy()
}

function updateLocalCopy() {
	if (!localCopyChecked) return
	const key = STORAGE_KEYS.unsavedPythonCode(props.project)
	if (code.value === savedCode.value) removeKey(key)
	else writeJSON(key, { code: code.value, lastSavedAt } satisfies LocalCopy)
}

watch(code, (value) => {
	clearTimeout(autosaveTimer)
	if (props.readOnly) return
	updateLocalCopy()
	if (value === savedCode.value) return
	saveBeforeLeaveFailed = false
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
	const saved = await trySubmit(saveCall, { project: props.project, code: content })
	if (saveCall.error || !saved) {
		status.value = 'error'
		toast.error(frappeErrorMessage(saveCall.error, 'Could not save your code.'))
		return false
	}
	savedCode.value = content
	lastSavedAt = saved.last_saved_at
	status.value = code.value === content ? 'saved' : 'idle'
	updateLocalCopy()
	return true
}

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
	result.value = await props.runner.run(code.value, stdin.value)
	running.value = false
	codeRuns.recordRun(result.value)
}

async function runSampleTests() {
	if (running.value || testing.value) return
	testing.value = true
	panelTab.value = 'tests'
	testRuns.value = null
	testRuns.value = await runTests(props.runner, code.value, sampleTests.value)
	testing.value = false
	codeRuns.recordTests(testRuns.value)
}

const submitCall = useCall<{ name: string }, { assignment: string; project: string }>({
	url: '/api/v2/method/cs17_portal.api.submit_python_project',
	method: 'POST',
	immediate: false,
})

function confirmSubmit() {
	if (props.canComeBack) {
		submit()
		return
	}
	dialog.confirm({
		title: 'Submit this question?',
		message: 'You cannot come back to it after this.',
		confirmLabel: 'Submit',
		onConfirm: submit,
	})
}

async function submit() {
	if (!(await save())) return
	await trySubmit(submitCall, { assignment: props.assignment, project: props.project })
	if (submitCall.error) {
		toast.error(frappeErrorMessage(submitCall.error, 'Could not submit this question.'))
		return
	}
	toast.success('Question submitted')
	emit('changed')
}

const skipCall = useCall<null, { exam: string; assignment: string }>({
	url: '/api/v2/method/cs17_portal.coding_exam.skip_exam_question',
	method: 'POST',
	immediate: false,
})

function confirmSkip() {
	dialog.confirm({
		title: 'Skip this question?',
		message: props.canComeBack
			? 'You can come back to it later.'
			: 'You cannot come back to it after this.',
		confirmLabel: 'Skip',
		onConfirm: skip,
	})
}

async function skip() {
	if (!(await save())) return
	await trySubmit(skipCall, { exam: props.exam, assignment: props.assignment })
	if (skipCall.error) {
		toast.error(frappeErrorMessage(skipCall.error, 'Could not skip this question.'))
		return
	}
	emit('changed')
}

async function saveBeforeLeave() {
	if (!hasUnsavedEdits() || saveBeforeLeaveFailed) return true
	saveBeforeLeaveFailed = !(await save())
	return !saveBeforeLeaveFailed
}

onBeforeRouteLeave(saveBeforeLeave)
onBeforeLogout(saveBeforeLeave)

function warnBeforeUnload(event: BeforeUnloadEvent) {
	if (hasUnsavedEdits()) event.preventDefault()
}

onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
onBeforeUnmount(() => {
	clearTimeout(autosaveTimer)
	window.removeEventListener('beforeunload', warnBeforeUnload)
})

defineExpose({ save })
</script>
