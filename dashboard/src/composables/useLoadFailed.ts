import { computed, type ComputedRef } from 'vue'

export function useLoadFailed(call: {
	data: unknown
	error: unknown
	loading: boolean
}): ComputedRef<boolean> {
	return computed<boolean>((previous = false) =>
		call.loading ? previous : Boolean(call.error) && !call.data,
	)
}
