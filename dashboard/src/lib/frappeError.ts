export function frappeErrorMessage(error: unknown, fallback: string): string {
	const err = error as { message?: string; type?: string; messages?: string[] }
	if (err?.type) {
		const prefix = `${err.type}: `
		const message = err.message?.startsWith(prefix) ? err.message.slice(prefix.length) : ''
		return message.replace(/<[^>]*>/g, '') || fallback
	}
	if (err?.messages?.length) return err.messages.join(' ').replace(/<[^>]*>/g, '')
	return fallback
}

export function isRefusal(error: unknown): boolean {
	const type = (error as { type?: string } | null)?.type
	return ['DoesNotExistError', 'PermissionError', 'ValidationError'].includes(type ?? '')
}
