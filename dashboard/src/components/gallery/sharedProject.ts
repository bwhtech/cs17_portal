import type { ProjectType } from '@/types'

export interface SharedProject {
	name: string
	project_title: string
	project_type: ProjectType
	student_name: string
	thumbnail: string | null
	last_saved_at: string | null
}
