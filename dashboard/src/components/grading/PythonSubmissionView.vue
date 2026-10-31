<template>
	<div v-if="failedCall" class="flex h-full items-center justify-center p-6 text-center">
		<p v-if="isRefusal(failedCall.error)" class="text-p-base text-ink-gray-5">
			{{ frappeErrorMessage(failedCall.error, 'Could not load the submitted program.') }}
		</p>
		<LoadError
			v-else
			class="!py-0"
			title="Could not load the submitted program"
			:loading="failedCall.loading"
			@retry="failedCall.reload()"
		/>
	</div>

	<Skeleton v-else-if="code === null || !assignment.data" class="h-full w-full !rounded-none" />

	<div v-else class="grid h-full max-md:overflow-y-auto md:grid-cols-2">
		<PythonEditor :model-value="code" read-only class="min-h-0 max-md:h-80" />
		<div
			class="min-h-0 space-y-3 overflow-auto border-outline-gray-1 bg-surface-base p-3 max-md:border-t sm:p-5 md:border-l"
		>
			<div class="flex items-center justify-between gap-3">
				<p class="text-base font-medium text-ink-gray-8">Tests</p>
				<Button
					v-if="tests.length"
					icon-left="lucide-rotate-ccw"
					label="Run again"
					:loading="testing"
					@click="check"
				/>
			</div>
			<TestResults
				:runs="runs"
				:running="testing"
				idle-text="This assignment has no tests."
			/>
			<TimeTaken
				v-if="assignment.data?.time_limit"
				class="border-t border-outline-gray-1 pt-3"
				:submission="submission"
				:time-limit="assignment.data.time_limit"
			/>
			<TabLeaves
				v-if="assignment.data?.watch_tab_switches"
				class="border-t border-outline-gray-1 pt-3"
				:submission="submission"
			/>
			<Pastes
				v-if="assignment.data?.watch_tab_switches"
				class="border-t border-outline-gray-1 pt-3"
				:submission="submission"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Skeleton, useCall } from 'frappe-ui'
import LoadError from '@/components/common/LoadError.vue'
import PythonEditor from '@/components/python/PythonEditor.vue'
import TabLeaves from '@/components/grading/TabLeaves.vue'
import TimeTaken from '@/components/grading/TimeTaken.vue'
import Pastes from '@/components/grading/Pastes.vue'
import TestResults from '@/components/python/TestResults.vue'
import { frappeErrorMessage, isRefusal } from '@/lib/frappeError'
import { usePythonRunner } from '@/lib/python/runner'
import { runTests, type TestRun } from '@/lib/python/tests'
import type { CS17Assignment } from '@/types'

const props = defineProps<{ submission: string; assignment: string }>()

const emit = defineEmits<{ score: [score: { passed: number; total: number }] }>()

const program = useCall<string, { submission: string }>({
	url: '/api/v2/method/cs17_portal.api.get_submission_code',
	params: () => ({ submission: props.submission }),
})

const assignment = useCall<CS17Assignment | null, { assignment: string }>({
	url: '/api/v2/method/cs17_portal.api.get_assignment',
	params: () => ({ assignment: props.assignment }),
})

const failedCall = computed(() =>
	program.error && program.data === null
		? program
		: assignment.error && !assignment.data
			? assignment
			: null,
)
const code = computed(() => program.data ?? null)
const tests = computed(() => assignment.data?.test_cases ?? [])

const runner = usePythonRunner()
const runs = ref<TestRun[] | null>(null)
const testing = ref(false)

async function check() {
	if (code.value === null || !tests.value.length || testing.value) return
	testing.value = true
	runs.value = await runTests(runner, code.value, tests.value)
	testing.value = false
	emit('score', {
		passed: runs.value.filter((run) => run.passed).length,
		total: runs.value.length,
	})
}

watch(
	() => code.value !== null && Boolean(assignment.data),
	(ready) => {
		if (ready) check()
	},
	{ immediate: true },
)
</script>
