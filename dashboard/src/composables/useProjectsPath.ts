import { useSession } from '@/composables/useSession'

export function useProjectsPath(): string {
	const { isFaculty } = useSession()
	return isFaculty.value ? '/faculty/projects' : '/projects'
}
