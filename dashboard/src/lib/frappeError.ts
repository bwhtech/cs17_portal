export function frappeErrorMessage(error: unknown, fallback: string): string {
	const err = error as { message?: string; _server_messages?: string }
	const fromServer = parseServerMessage(err?._server_messages)
	if (fromServer) return fromServer
	if (err?.message && err.message !== 'There was an error.') return err.message
	return fallback
}

export function isRefusal(error: unknown): boolean {
	const type = (error as { type?: string } | null)?.type
	return ['DoesNotExistError', 'PermissionError', 'ValidationError'].includes(type ?? '')
}

function parseServerMessage(raw?: string): string | null {
	if (!raw) return null
	try {
		const messages = JSON.parse(raw) as string[]
		if (!messages.length) return null
		const first = JSON.parse(messages[0]) as { message?: string }
		return first.message ? first.message.replace(/<[^>]*>/g, '') : null
	} catch {
		return null
	}
}
