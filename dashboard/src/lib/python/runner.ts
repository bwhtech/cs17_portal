import { onBeforeUnmount } from 'vue'
import { sandboxDocument } from './sandbox'

const RUN_TIMEOUT_MS = 5000
const START_TIMEOUT_MS = 60000

export interface ProgramOutput {
	stdout: string
	stderr: string
	error: string | null
}

export type RunResult =
	| ({ status: 'finished' } & ProgramOutput)
	| { status: 'timed-out'; timeoutMs: number }
	| { status: 'unavailable' }

type SandboxMessage =
	| { type: 'ready' }
	| { type: 'failed'; message: string }
	| ({ type: 'result'; id: number } & ProgramOutput)

export class PythonRunner {
	private frame: HTMLIFrameElement | null = null
	private started: Promise<boolean> | null = null
	private markStarted: ((started: boolean) => void) | null = null
	private pending = new Map<number, (output: ProgramOutput) => void>()
	private lastId = 0

	constructor() {
		window.addEventListener('message', this.onMessage)
	}

	async run(code: string, stdin = ''): Promise<RunResult> {
		if (!(await this.start())) {
			this.stop()
			return { status: 'unavailable' }
		}
		const id = ++this.lastId
		return new Promise((resolve) => {
			const timer = setTimeout(() => {
				this.stop()
				resolve({ status: 'timed-out', timeoutMs: RUN_TIMEOUT_MS })
			}, RUN_TIMEOUT_MS)
			this.pending.set(id, (output) => {
				clearTimeout(timer)
				resolve({ status: 'finished', ...output })
			})
			this.frame?.contentWindow?.postMessage({ id, code, stdin }, '*')
		})
	}

	dispose() {
		this.stop()
		window.removeEventListener('message', this.onMessage)
	}

	private start(): Promise<boolean> {
		if (this.started) return this.started
		this.started = new Promise((resolve) => {
			this.markStarted = resolve
			setTimeout(() => resolve(false), START_TIMEOUT_MS)
		})
		this.frame = document.createElement('iframe')
		this.frame.sandbox.add('allow-scripts')
		this.frame.hidden = true
		this.frame.srcdoc = sandboxDocument
		document.body.appendChild(this.frame)
		return this.started
	}

	private stop() {
		this.frame?.remove()
		this.frame = null
		this.started = null
		this.markStarted = null
		this.pending.clear()
	}

	private onMessage = ({ source, data }: MessageEvent<SandboxMessage>) => {
		if (!this.frame || source !== this.frame.contentWindow) return
		if (data.type === 'result') {
			this.pending.get(data.id)?.({ stdout: data.stdout, stderr: data.stderr, error: data.error })
			this.pending.delete(data.id)
		} else {
			this.markStarted?.(data.type === 'ready')
		}
	}
}

export function usePythonRunner(): PythonRunner {
	const runner = new PythonRunner()
	onBeforeUnmount(() => runner.dispose())
	return runner
}
