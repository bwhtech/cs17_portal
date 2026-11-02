import { ref, type Ref } from 'vue'
import { useCall } from 'frappe-ui'
import { PythonRunner } from '@/lib/python/runner'
import { runTests, type TestRun } from '@/lib/python/tests'
import type { CS17Assignment } from '@/types'

export interface TestResult {
	passed: boolean
	output: string
}

export function useSubmissionTests(): {
	testResults: (
		assignment: string,
		submissions: string[],
		onTested?: (submission: string, results: TestResult[]) => void,
	) => Promise<Record<string, TestResult[]> | null>
	testing: Ref<boolean>
} {
	const assignmentCall = useCall<CS17Assignment | null, { assignment: string }>({
		url: '/api/v2/method/cs17_portal.api.get_assignment',
		method: 'GET',
		immediate: false,
	})
	const program = useCall<string, { submission: string }>({
		url: '/api/v2/method/cs17_portal.api.get_submission_code',
		method: 'GET',
		immediate: false,
	})
	const testing = ref(false)

	async function testResults(
		assignment: string,
		submissions: string[],
		onTested?: (submission: string, results: TestResult[]) => void,
	) {
		testing.value = true
		const runner = new PythonRunner()
		try {
			const tests = (await assignmentCall.submit({ assignment }))?.test_cases ?? []
			const results: Record<string, TestResult[]> = {}
			for (const submission of submissions) {
				const code = (await program.submit({ submission })) ?? ''
				results[submission] = (await runTests(runner, code, tests)).map(toTestResult)
				onTested?.(submission, results[submission])
			}
			return results
		} catch {
			return null
		} finally {
			runner.dispose()
			testing.value = false
		}
	}

	return { testResults, testing }
}

export function toTestResult({ result, passed }: TestRun): TestResult {
	if (result.status === 'finished') {
		return { passed, output: [result.stdout, result.error].filter(Boolean).join('\n') }
	}
	if (result.status === 'timed-out') {
		return { passed, output: `Stopped after ${result.timeoutMs / 1000} seconds.` }
	}
	throw new Error('Python did not start.')
}
