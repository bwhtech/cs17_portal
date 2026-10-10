import { useSession } from '@/composables/useSession'

/**
 * Students and faculty share the project pages, but each role only routes
 * inside its own tree, so the links between those pages follow the role.
 */
export function useProjectsPath(): string {
	const { isFaculty } = useSession()
	return isFaculty.value ? '/faculty/projects' : '/projects'
}
