export function trySubmit<TParams, TResponse>(
	call: { submit: (params?: TParams) => Promise<TResponse> },
	params: NoInfer<TParams>,
): Promise<TResponse | null> {
	return call.submit(params).catch(() => null)
}
