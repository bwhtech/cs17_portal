import { useRouter } from 'vue-router'
import { useCall, toast } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Assignment } from '@/types'

export function usePythonAssignment(): {
	open: (
		assignment: Pick<CS17Assignment, 'name'>,
		options?: { readOnly?: boolean },
	) => Promise<void>
} {
	const router = useRouter()
	const start = useCall<{ name: string }, { assignment: string }>({
		url: '/api/v2/method/cs17_portal.api.start_python_assignment',
		method: 'POST',
		immediate: false,
	})

	async function open(
		assignment: Pick<CS17Assignment, 'name'>,
		options: { readOnly?: boolean } = {},
	) {
		const started = await trySubmit(start, { assignment: assignment.name })
		if (!started?.name) {
			toast.error(frappeErrorMessage(start.error, 'Could not open the assignment.'))
			return
		}
		router.push({
			path: `/projects/${started.name}/code`,
			query: { assignment: assignment.name, ...(options.readOnly ? { readonly: '1' } : {}) },
		})
	}

	return { open }
}
