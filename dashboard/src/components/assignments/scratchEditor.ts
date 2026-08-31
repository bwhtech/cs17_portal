import { useRouter } from 'vue-router'
import { useCall, toast } from 'frappe-ui'
import { frappeErrorMessage } from '@/lib/frappeError'
import type { CS17Assignment, CS17Project, CS17Submission } from '@/types'

/**
 * A Scratch assignment is never submitted through a dialog — the work lives in
 * the editor, so every Submit/Edit/Preview on such a row lands there instead.
 * The `assignment` query param is what tells the editor which assignment to
 * submit to when the student is done.
 */
export function scratchEditorPath(project: string, assignment: string, readOnly = false): string {
	const path = `/projects/${project}/edit?assignment=${encodeURIComponent(assignment)}`
	return readOnly ? `${path}&readonly=1` : path
}

export function useScratchAssignment(): {
	open: (
		assignment: Pick<CS17Assignment, 'name' | 'title'>,
		submission?: CS17Submission | null,
		options?: { readOnly?: boolean },
	) => Promise<void>
} {
	const router = useRouter()
	const createProject = useCall<CS17Project, { project_title: string }>({
		url: '/api/v2/method/cs17_portal.api.create_project',
		method: 'POST',
		immediate: false,
	})

	async function open(
		assignment: Pick<CS17Assignment, 'name' | 'title'>,
		submission?: CS17Submission | null,
		options: { readOnly?: boolean } = {},
	) {
		// A first attempt has nothing to open yet, so the project the student
		// will work in is created here and the editor opens straight into it.
		let project = submission?.project ?? null
		if (!project) {
			const created = await createProject.submit({
				project_title: assignment.title || 'Scratch project',
			})
			if (!created?.name) {
				toast.error(frappeErrorMessage(createProject.error, 'Could not start a project.'))
				router.push('/projects')
				return
			}
			project = created.name
		}
		router.push(scratchEditorPath(project, assignment.name, options.readOnly))
	}

	return { open }
}
