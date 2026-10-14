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
				<Button
					:icon="isZen ? 'lucide-minimize-2' : 'lucide-maximize-2'"
					:aria-label="isZen ? 'Exit zen mode' : 'Enter zen mode'"
					:tooltip="isZen ? 'Exit zen mode' : 'Zen mode'"
					@click="toggle"
				/>
				<template v-if="project.data">
					<Button
						:icon-left="isDesktop ? 'lucide-save' : undefined"
						:icon="isDesktop ? undefined : 'lucide-save'"
						label="Save"
						:loading="status === 'saving'"
						@click="save"
					/>
					<Button
						variant="solid"
						theme="gray"
						:icon-left="isDesktop ? 'lucide-play' : undefined"
						:icon="isDesktop ? undefined : 'lucide-play'"
						label="Run"
						tooltip="Run (Ctrl+Enter)"
						:loading="running"
						@click="run"
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

			<div v-else class="flex h-full flex-col">
				<PythonEditor v-model="code" class="min-h-0 flex-1" @run="run" />
				<RunPanel
					v-model:stdin="stdin"
					v-model:tab="panelTab"
					class="h-64 shrink-0 border-t border-outline-gray-1"
					:result="result"
					:running="running"
				/>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Button, LoadingIndicator, toast, useCall } from 'frappe-ui'
import EmptyState from '@/components/common/EmptyState.vue'
import PythonEditor from '@/components/python/PythonEditor.vue'
import RunPanel from '@/components/python/RunPanel.vue'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { useProjectsPath } from '@/composables/useProjectsPath'
import { onBeforeLogout } from '@/composables/useSession'
import { useZenMode, useZenOnMount } from '@/composables/useZenMode'
import { frappeErrorMessage } from '@/lib/frappeError'
import { usePythonRunner, type RunResult } from '@/lib/python/runner'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Project } from '@/types'

const AUTOSAVE_IDLE_MS = 2000

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const props = defineProps<{ id: string }>()

const projectsPath = useProjectsPath()
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
	if (value === savedCode.value) return
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
const panelTab = ref('output')
const result = ref<RunResult | null>(null)
const running = ref(false)

async function run() {
	if (running.value) return
	running.value = true
	panelTab.value = 'output'
	result.value = await runner.run(code.value, stdin.value)
	running.value = false
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
