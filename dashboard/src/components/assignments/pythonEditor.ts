import { useRouter } from 'vue-router'
import { dialog, useCall, toast } from 'frappe-ui'
import { isPast } from '@/lib/dates'
import { frappeErrorMessage } from '@/lib/frappeError'
import { trySubmit } from '@/lib/trySubmit'
import type { CS17Assignment } from '@/types'

type Reattempt = Pick<CS17Assignment, 'name' | 'time_limit' | 'attempts_allowed' | 'next_attempt'>

export function usePythonAssignment(): {
	open: (
		assignment: Pick<CS17Assignment, 'name'>,
		options?: { readOnly?: boolean },
	) => Promise<void>
	reattempt: (assignment: Reattempt, onStarted?: () => void) => void
} {
	const router = useRouter()
	const details = useCall<CS17Assignment, { assignment: string }>({
		url: '/api/v2/method/cs17_portal.api.get_student_assignment',
		immediate: false,
	})
	const start = useCall<{ name: string }, { assignment: string }>({
		url: '/api/v2/method/cs17_portal.api.start_python_assignment',
		method: 'POST',
		immediate: false,
	})

	async function open(
		assignment: Pick<CS17Assignment, 'name'>,
		options: { readOnly?: boolean } = {},
	) {
		const current = options.readOnly
			? null
			: await trySubmit(details, { assignment: assignment.name })
		if (current?.time_limit && !current.started_at && !isPast(current.due_date)) {
			dialog.confirm({
				title: 'Start the clock?',
				message: `You will have ${current.time_limit} ${current.time_limit === 1 ? 'minute' : 'minutes'}. The clock does not stop once it starts, even if you leave the page. When time is up, your code is submitted.`,
				confirmLabel: 'Start',
				onConfirm: () => openEditor(assignment, options),
			})
			return
		}
		await openEditor(assignment, options)
	}

	async function openEditor(
		assignment: Pick<CS17Assignment, 'name'>,
		options: { readOnly?: boolean },
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

	const restart = useCall<{ name: string }, { assignment: string }>({
		url: '/api/v2/method/cs17_portal.api.reattempt_python_assignment',
		method: 'POST',
		immediate: false,
	})

	function reattempt(assignment: Reattempt, onStarted?: () => void) {
		const minutes = assignment.time_limit ?? 0
		dialog.confirm({
			title: 'Try again?',
			message: `This is attempt ${assignment.next_attempt} of ${assignment.attempts_allowed}. You will have ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} again, and your code stays as you left it. The clock does not stop once it starts.`,
			confirmLabel: 'Start',
			onConfirm: async () => {
				const started = await trySubmit(restart, { assignment: assignment.name })
				if (!started?.name) {
					toast.error(frappeErrorMessage(restart.error, 'Could not start again.'))
					return
				}
				if (onStarted) onStarted()
				else
					router.push({
						path: `/projects/${started.name}/code`,
						query: { assignment: assignment.name },
					})
			},
		})
	}

	return { open, reattempt }
}
