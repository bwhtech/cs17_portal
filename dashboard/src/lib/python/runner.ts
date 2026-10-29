import { onBeforeUnmount } from 'vue'
import { fetchPyodide } from './pyodide'
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
	| { status: 'loading' }
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
		const started = await Promise.race([
			this.start(),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), START_TIMEOUT_MS)),
		])
		if (started === null) return { status: 'loading' }
		if (!started) return { status: 'unavailable' }
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

	start(): Promise<boolean> {
		if (this.started) return this.started
		this.started = new Promise((resolve) => {
			this.markStarted = resolve
		})
		const frame = document.createElement('iframe')
		frame.sandbox.add('allow-scripts')
		frame.hidden = true
		frame.srcdoc = sandboxDocument
		const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }))
		Promise.all([fetchPyodide(), loaded]).then(
			([files]) => frame.contentWindow?.postMessage(files, '*'),
			() => {
				if (frame !== this.frame) return
				this.markStarted?.(false)
				this.stop()
			},
		)
		this.frame = frame
		document.body.appendChild(frame)
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
			if (data.type === 'failed') this.stop()
		}
	}
}

export function usePythonRunner(): PythonRunner {
	const runner = new PythonRunner()
	runner.start()
	onBeforeUnmount(() => runner.dispose())
	return runner
}
