<template>
	<Dialog :open="open" title="Solutions" size="2xl" @update:open="emit('update:open', $event)">
		<div class="space-y-3">
			<p class="text-p-sm text-ink-gray-5">
				A program can be solved in more than one way. Add each way as its own solution.
			</p>

			<div
				v-for="(solution, index) in solutions"
				:key="index"
				class="space-y-3 rounded-4 border border-outline-gray-1 p-3"
			>
				<div class="flex items-center gap-3">
					<p class="text-base text-ink-gray-8">Solution {{ index + 1 }}</p>
					<div class="ml-auto flex items-center gap-3">
						<TestScoreBadge
							v-if="scores"
							:passed="scores[index]"
							:total="tests.length"
						/>
						<Button
							variant="ghost"
							icon="lucide-trash-2"
							class="hover:!bg-surface-red-3 hover:!text-ink-red-7"
							:aria-label="`Remove solution ${index + 1}`"
							tooltip="Remove"
							@click="
								solutions = solutions.filter((_, position) => position !== index)
							"
						/>
					</div>
				</div>
				<FormControl
					v-model="solution.label"
					type="text"
					label="Label"
					placeholder="Using a for loop"
					maxlength="140"
					required
					:error="missing[index]?.label"
				/>
				<div class="space-y-1.5">
					<div class="h-40 overflow-hidden rounded-3">
						<PythonEditor v-model="solution.code" />
					</div>
					<ErrorMessage :message="missing[index]?.code" />
				</div>
			</div>

			<Button
				icon-left="lucide-plus"
				label="Add solution"
				@click="solutions = [...solutions, { label: '', code: '' }]"
			/>

			<ErrorMessage :message="error" />
		</div>

		<template #actions>
			<div class="flex justify-end gap-3">
				<Button
					icon-left="lucide-list-checks"
					label="Check solutions"
					:loading="checking"
					@click="check"
				/>
				<Button
					variant="solid"
					theme="gray"
					label="Save"
					:loading="save.loading"
					@click="handleSave"
				/>
			</div>
		</template>
	</Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button, Dialog, ErrorMessage, FormControl, toast, useCall } from 'frappe-ui'
import TestScoreBadge from '@/components/faculty/TestScoreBadge.vue'
import PythonEditor from '@/components/python/PythonEditor.vue'
import { toTestResult } from '@/composables/useSubmissionTests'
import { frappeErrorMessage } from '@/lib/frappeError'
import { PythonRunner } from '@/lib/python/runner'
import { runTests } from '@/lib/python/tests'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Assignment, PythonSolution } from '@/types'

const props = defineProps<{ open: boolean; assignment: CS17Assignment }>()

const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [] }>()

const solutions = ref<PythonSolution[]>(
	(props.assignment.solutions ?? []).map((solution) => ({ ...solution })),
)
const missing = ref<{ label: string; code: string }[]>([])
const scores = ref<number[] | null>(null)
const checking = ref(false)
const error = ref('')

const tests = computed(() => props.assignment.test_cases ?? [])

const save = useCall<null, { assignment: string; solutions: PythonSolution[] }>({
	url: '/api/v2/method/cs17_portal.api.save_solutions',
	method: 'POST',
	immediate: false,
})

watch(
	solutions,
	() => {
		missing.value = []
		scores.value = null
		error.value = ''
	},
	{ deep: true },
)

async function check() {
	if (checking.value) return
	if (!solutions.value.length) {
		error.value = 'Add a solution to check.'
		return
	}
	if (!tests.value.length) {
		error.value = 'This assignment has no tests to check the solutions against.'
		return
	}
	checking.value = true
	const codes = solutions.value.map((solution) => solution.code)
	const runner = new PythonRunner()
	try {
		const passed: number[] = []
		for (const code of codes) {
			const results = (await runTests(runner, code, tests.value)).map(toTestResult)
			passed.push(results.filter((result) => result.passed).length)
		}
		const unchanged =
			JSON.stringify(solutions.value.map((solution) => solution.code)) ===
			JSON.stringify(codes)
		if (unchanged) scores.value = passed
	} catch {
		error.value = 'Could not run the tests. Try again.'
	} finally {
		runner.dispose()
		checking.value = false
	}
}

async function handleSave() {
	missing.value = solutions.value.map((solution) => ({
		label: solution.label.trim() ? '' : 'Add a label.',
		code: solution.code.trim() ? '' : 'Write the code.',
	}))
	if (missing.value.some((row) => row.label || row.code)) return
	await trySubmit(save, { assignment: props.assignment.name, solutions: solutions.value })
	if (save.error) {
		error.value = frappeErrorMessage(save.error, 'Could not save the solutions.')
		return
	}
	toast.success('Solutions saved')
	emit('saved')
	emit('update:open', false)
}
</script>
