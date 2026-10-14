import { useSession } from '@/composables/useSession'
import type { CS17Project } from '@/types'

export function useProjectsPath(): string {
	const { isFaculty } = useSession()
	return isFaculty.value ? '/faculty/projects' : '/projects'
}

export function projectEditorPath(
	projectsPath: string,
	project: Pick<CS17Project, 'name' | 'project_type'>,
): string {
	return `${projectsPath}/${project.name}/${project.project_type === 'Python' ? 'code' : 'edit'}`
}
