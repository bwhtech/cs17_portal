import { computed, type ComputedRef } from 'vue'

export function useLoadFailed(
	call: {
		data: unknown
		error: unknown
		loading: boolean
	},
	{ except = () => false }: { except?: (error: unknown) => boolean } = {},
): ComputedRef<boolean> {
	return computed<boolean>((previous = false) =>
		call.loading ? previous : Boolean(call.error) && !call.data && !except(call.error),
	)
}
