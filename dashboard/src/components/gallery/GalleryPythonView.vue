<template>
	<div class="flex h-full flex-col">
		<div class="flex shrink-0 justify-end border-b border-outline-gray-1 px-3 py-2">
			<Button
				icon-left="lucide-play"
				label="Run"
				tooltip="Run (Ctrl+Enter)"
				:loading="running"
				@click="run"
			/>
		</div>
		<PythonEditor :model-value="code" class="min-h-0 flex-1" read-only @run="run" />
		<RunPanel
			v-model:stdin="stdin"
			v-model:tab="panelTab"
			class="h-56 shrink-0 border-t border-outline-gray-1"
			:result="result"
			:running="running"
		/>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from 'frappe-ui'
import PythonEditor from '@/components/python/PythonEditor.vue'
import RunPanel from '@/components/python/RunPanel.vue'
import { usePythonRunner, type RunResult } from '@/lib/python/runner'

const props = defineProps<{ code: string }>()

const runner = usePythonRunner()
const stdin = ref('')
const panelTab = ref('output')
const result = ref<RunResult | null>(null)
const running = ref(false)

async function run() {
	if (running.value) return
	running.value = true
	panelTab.value = 'output'
	result.value = await runner.run(props.code, stdin.value)
	running.value = false
}
</script>
