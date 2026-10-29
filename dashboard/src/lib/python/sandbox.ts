import runnerSource from './runner.py?raw'

const workerSource = `
onmessage = ({ data: files }) => {
	fetch = async (url) => {
		const name = String(url).split('/').pop()
		const type = name.endsWith('.wasm') ? 'application/wasm' : files[name].type
		return new Response(files[name], { headers: { 'Content-Type': type } })
	}
	importScripts(URL.createObjectURL(files['pyodide.js']), URL.createObjectURL(files['pyodide.asm.js']))
	const runProgram = loadPyodide({ indexURL: location.href }).then((pyodide) => {
		pyodide.runPython(${JSON.stringify(runnerSource)})
		return pyodide.globals.get('run_program')
	})
	runProgram.then(
		() => postMessage({ type: 'ready' }),
		(error) => postMessage({ type: 'failed', message: String(error) }),
	)
	onmessage = async ({ data }) => {
		const result = (await runProgram)(data.code, data.stdin)
		postMessage({ type: 'result', id: data.id, ...result.toJs({ dict_converter: Object.fromEntries }) })
		result.destroy()
	}
}
`

const CSP = [
	"default-src 'none'",
	"script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:",
	'worker-src blob:',
].join('; ')

/**
 * Student code runs in a worker inside a sandboxed iframe with an opaque
 * origin and a CSP that allows no network at all. A faculty member's browser
 * runs submissions while grading, and without this the code could call the
 * portal's API with the faculty session. The page fetches Pyodide's files and
 * posts them in, and the worker answers Pyodide's own requests from them.
 */
export const sandboxDocument = `<!doctype html>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<script>
const worker = new Worker(URL.createObjectURL(new Blob([${JSON.stringify(workerSource)}], { type: 'text/javascript' })))
worker.onmessage = ({ data }) => parent.postMessage(data, '*')
worker.onerror = (event) => parent.postMessage({ type: 'failed', message: event.message }, '*')
addEventListener('message', (event) => {
	if (event.source === parent) worker.postMessage(event.data)
})
</script>`
