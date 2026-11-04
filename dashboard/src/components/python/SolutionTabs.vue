<template>
	<Tabs :model-value="active" @update:model-value="active = Number($event)">
		<TabList class="overflow-x-auto">
			<TabTrigger
				v-for="(solution, index) in solutions"
				:key="index"
				:value="index"
				:label="solution.label"
			/>
		</TabList>
		<TabPanel v-for="(solution, index) in solutions" :key="index" :value="index" class="pt-3">
			<div class="max-h-96 overflow-auto rounded-3">
				<PythonEditor :model-value="solution.code" read-only :extensions="wrapLines" />
			</div>
		</TabPanel>
	</Tabs>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { EditorView } from '@codemirror/view'
import { TabList, TabPanel, TabTrigger, Tabs } from 'frappe-ui'
import PythonEditor from '@/components/python/PythonEditor.vue'
import type { PythonSolution } from '@/types'

const props = defineProps<{ solutions: PythonSolution[] }>()

const wrapLines = [EditorView.lineWrapping]
const active = ref(0)

watch(
	() => props.solutions,
	() => {
		active.value = 0
	},
)
</script>
