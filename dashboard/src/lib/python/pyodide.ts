import loader from 'pyodide/pyodide.js?url'
import runtime from 'pyodide/pyodide.asm.js?url'
import stdlib from 'pyodide/python_stdlib.zip?url'
import lockFile from 'pyodide/pyodide-lock.json?url'
import wasm from './pyodide.asm.wasm.gzip?url'

export const pyodideFiles: Record<string, string> = {
	'pyodide.js': loader,
	'pyodide.asm.js': runtime,
	'pyodide.asm.wasm': wasm,
	'python_stdlib.zip': stdlib,
	'pyodide-lock.json': lockFile,
}

export async function fetchPyodide(): Promise<Record<string, Blob>> {
	const files = await Promise.all(
		Object.entries(pyodideFiles).map(async ([name, url]) => {
			const response = await fetch(url)
			if (!response.ok) throw new Error(`Could not load ${name}`)
			const body = url.endsWith('.gzip')
				? response.body!.pipeThrough(new DecompressionStream('gzip'))
				: response.body
			return [name, await new Response(body).blob()]
		}),
	)
	return Object.fromEntries(files)
}
