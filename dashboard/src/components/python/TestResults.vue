<template>
	<div class="space-y-3">
		<p v-if="!runs" class="text-p-sm text-ink-gray-5">
			{{ running ? 'Running tests…' : idleText }}
		</p>
		<template v-else>
			<p class="text-base" :class="allPassed ? 'text-ink-green-6' : 'text-ink-gray-8'">
				{{ passedCount }} of {{ runs.length }} {{ runs.length === 1 ? 'test' : 'tests' }}
				passed
			</p>
			<div
				v-for="(run, index) in runs"
				:key="index"
				class="rounded-4 border border-outline-gray-1"
			>
				<div class="flex items-center gap-2 px-3 py-2">
					<span
						:class="[
							run.passed
								? 'lucide-circle-check text-ink-green-6'
								: 'lucide-circle-x text-ink-red-6',
							'size-4 shrink-0',
						]"
						aria-hidden="true"
					/>
					<span class="text-base text-ink-gray-8">Test {{ index + 1 }}</span>
					<Badge v-if="run.test.is_hidden" label="Hidden" />
					<span class="ml-auto text-sm text-ink-gray-5">{{ verdict(run) }}</span>
				</div>
				<div
					v-if="!run.passed"
					class="grid gap-3 border-t border-outline-gray-1 p-3 sm:grid-cols-3"
				>
					<ProgramText label="Input" :text="run.test.input" />
					<ProgramText label="Expected output" :text="run.test.expected_output" />
					<ProgramText label="Output" v-bind="output(run.result)" />
				</div>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from 'frappe-ui'
import ProgramText from '@/components/python/ProgramText.vue'
import type { RunResult } from '@/lib/python/runner'
import type { TestRun } from '@/lib/python/tests'

const props = defineProps<{
	runs: TestRun[] | null
	running?: boolean
	idleText: string
}>()

const passedCount = computed(() => props.runs?.filter((run) => run.passed).length ?? 0)
const allPassed = computed(
	() => Boolean(props.runs?.length) && passedCount.value === props.runs?.length,
)

function verdict(run: TestRun): string {
	if (run.passed) return 'Passed'
	if (run.result.status === 'timed-out') return 'Timed out'
	if (run.result.status === 'unavailable') return 'Not run'
	return run.result.error ? 'Error' : 'Wrong output'
}

function output(result: RunResult): { text: string; isError: boolean } {
	if (result.status === 'finished') {
		return {
			text: `${result.stdout}${result.stderr}${result.error ?? ''}`,
			isError: Boolean(result.error),
		}
	}
	if (result.status === 'timed-out') {
		return { text: `Stopped after ${result.timeoutMs / 1000} seconds.`, isError: true }
	}
	return { text: 'Could not start Python.', isError: true }
}
</script>
