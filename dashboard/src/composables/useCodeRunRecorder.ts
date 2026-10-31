import { useCall } from 'frappe-ui'
import type { RunResult } from '@/lib/python/runner'
import type { TestRun } from '@/lib/python/tests'
import { trySubmit } from '@/lib/trySubmit'

interface CodeRun {
	passed?: number
	total?: number
	error_type?: string
	error_line?: number
}

export function useCodeRunRecorder(
	project: () => string,
	isRecording: () => boolean,
): { recordRun: (result: RunResult) => void; recordTests: (runs: TestRun[]) => void } {
	const codeRun = useCall<null, CodeRun & { project: string }>({
		url: '/api/v2/method/cs17_portal.live_lab.record_code_run',
		method: 'POST',
		immediate: false,
	})
	let recording: Promise<unknown> = Promise.resolve()

	function record(run: CodeRun) {
		if (!isRecording()) return
		recording = recording.then(() => trySubmit(codeRun, { project: project(), ...run }))
	}

	return {
		recordRun(result) {
			if (result.status === 'finished') record(raisedError(result))
		},
		recordTests(runs) {
			if (!runs.some(ran)) return
			const raised = runs.find(({ result }) => result.status === 'finished' && result.error)
			record({
				passed: runs.filter((run) => run.passed).length,
				total: runs.length,
				...(raised && raisedError(raised.result)),
			})
		},
	}
}

function ran({ result }: TestRun): boolean {
	return result.status === 'finished' || result.status === 'timed-out'
}

function raisedError(result: RunResult): CodeRun {
	if (result.status !== 'finished' || !result.error) return {}
	const line = [...result.error.matchAll(/File "main\.py", line (\d+)/g)].at(-1)?.[1]
	return {
		error_type: result.error.match(/^[A-Za-z_][\w.]*(?=:|$)/gm)?.at(-1),
		error_line: line ? Number(line) : undefined,
	}
}
