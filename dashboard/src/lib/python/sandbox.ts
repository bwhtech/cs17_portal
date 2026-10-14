import runnerSource from './runner.py?raw'

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/'

const workerSource = `
importScripts(${JSON.stringify(`${PYODIDE_URL}pyodide.js`)})
const runProgram = loadPyodide({ indexURL: ${JSON.stringify(PYODIDE_URL)} }).then((pyodide) => {
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
`

const CSP = [
	"default-src 'none'",
	`script-src 'unsafe-inline' 'wasm-unsafe-eval' blob: ${PYODIDE_URL}`,
	'worker-src blob:',
	`connect-src ${PYODIDE_URL}`,
].join('; ')

/**
 * Student code runs in a worker inside a sandboxed iframe with an opaque
 * origin and a CSP that only reaches Pyodide's CDN. A faculty member's browser
 * runs submissions while grading, and without this the code could call the
 * portal's API with the faculty session.
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
