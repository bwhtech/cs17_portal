import { computed, watchEffect, type ComputedRef } from 'vue'

export function useLoadFailed(
	call: {
		data: unknown
		error: unknown
		loading: boolean
	},
	{ except = () => false }: { except?: (error: unknown) => boolean } = {},
): ComputedRef<boolean> {
	const failed = computed<boolean>((previous = false) =>
		call.loading ? previous : Boolean(call.error) && !call.data && !except(call.error),
	)
	// A computed is lazy: unread, it would never see the failure it has to hold.
	watchEffect(() => failed.value)
	return failed
}
