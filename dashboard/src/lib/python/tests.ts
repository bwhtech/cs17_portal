import type { PythonRunner, RunResult } from './runner'
import type { PythonTestCase } from '@/types'

export interface TestRun {
	test: PythonTestCase
	result: RunResult
	passed: boolean
}

function normalized(output: string): string {
	return output
		.split('\n')
		.map((line) => line.trimEnd())
		.join('\n')
		.trimEnd()
}

export async function runTests(
	runner: PythonRunner,
	code: string,
	tests: PythonTestCase[],
): Promise<TestRun[]> {
	const runs: TestRun[] = []
	for (const test of tests) {
		const result = await runner.run(code, test.input)
		const passed =
			result.status === 'finished' &&
			!result.error &&
			normalized(result.stdout) === normalized(test.expected_output)
		runs.push({ test, result, passed })
	}
	return runs
}
