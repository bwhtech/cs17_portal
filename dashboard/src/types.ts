/**
 * Shapes returned by `cs17_portal.api` and the doctypes behind it.
 *
 * Frappe sends Check fields as 0/1 and Float/Int as numbers; optional fields
 * are `null` rather than absent, so most of these are `T | null` and not `T?`.
 */

/** A Frappe Check field. */
export type Bool = 0 | 1

/** `CS17 Profile` — the boot record for the signed-in user. */
export interface CS17Profile {
	name: string
	full_name: string
	profile_type: 'Student' | 'Faculty'
	cohort: string | null
	profile_picture: string | null
}

/** `CS17 Assignment`. */
export interface CS17Assignment {
	name: string
	title: string
	description?: string | null
	due_date: string
	cohort?: string
	quarter?: string | null
	submission_type?: SubmissionType
	assignment_type?: AssignmentType
	/** `Grade` or `Marks` — the field is named `remarks` in the doctype. */
	remarks?: EvaluationType | null
	max_marks?: number
	is_published?: Bool
	publish_on?: string | null
	modified?: string
	/** Only on the faculty list. */
	submission_count?: number
}

/** `CS17 Assignment Submission`. */
export interface CS17Submission {
	name: string
	student: string
	full_name?: string
	assignment: string
	assignment_title?: string
	submission_document?: string | null
	submission_url?: string | null
	submitted_at: string
	project?: string | null
	/** Faculty views only: the raw ToDo assignment JSON array. */
	_assign?: string | null
	grade?: CS17Grade | null
}

/** `CS17 Assignment Grade`. */
export interface CS17Grade {
	name?: string
	assignment?: string
	submission?: string | null
	marks_obtained: number | null
	grade: string | null
	remarks?: string | null
	evaluation_type?: string | null
	full_name?: string
	assignment_title?: string
	is_published?: Bool
	published_on?: string | null
}

/** `CS17 Announcement`. */
export interface CS17Announcement {
	name: string
	title: string
	content: string | null
	alert_variant: AlertVariant
	cohort: string | null
	is_dismissible: Bool
	is_published?: Bool
	published_date?: string | null
	publish_on?: string | null
}

/** `CS17 Project` — a saved Scratch project. */
export interface CS17Project {
	name: string
	project_title: string
	sb3_file: string | null
	thumbnail?: string | null
	last_saved_at: string | null
}

/** One row of `CS17 Result.scores` — a subject as it was graded. */
export interface CS17ResultSubjectScore {
	subject: string
	subject_name: string | null
	max_marks: number
	marks_obtained: number
	percentage: number
	grade: string | null
	is_pass: Bool
	remarks: string | null
}

/**
 * One row of `CS17 Result.assignments`. Reported beside the subjects, never
 * counted into them — a Marks assignment fills `marks_obtained`, a Grade one
 * fills `grade`, and a Not Graded one fills neither.
 */
export interface CS17ResultAssignmentScore {
	assignment: string
	assignment_title: string | null
	assignment_type: AssignmentType | null
	evaluation_type: EvaluationType | null
	max_marks: number
	marks_obtained: number | null
	grade: string | null
	is_submitted: Bool
	due_date: string | null
}

/** A row of `get_student_results` — the report card without its tables. */
export interface CS17ResultSummary {
	name: string
	exam: string
	exam_name: string
	quarter: string | null
	total_marks_obtained: number
	total_max_marks: number
	percentage: number
	overall_grade: string | null
	result_status: 'Pass' | 'Fail' | null
	published_on: string | null
}

/** `get_student_result` — one summary with its subject and assignment rows. */
export interface CS17Result extends CS17ResultSummary {
	cohort: string | null
	student_name: string | null
	remarks: string | null
	scores: CS17ResultSubjectScore[]
	assignments: CS17ResultAssignmentScore[]
}

/** One row of `list_cohort_submissions`. */
export interface CohortSubmission {
	name: string
	student: string
	full_name: string
	assignment: string
	assignment_title: string
	submission_type: SubmissionType | null
	submission_document?: string | null
	max_marks: number
	submitted_at: string
	marks_obtained: number | null
	grade: string | null
	graded: boolean
}

/** One row of `get_faculty_members`. */
export interface FacultyMember {
	user: string
	full_name: string
}

/**
 * `get_student_assignments`, `get_student_grades` and
 * `get_student_announcements` all answer with their rows plus the timestamp of
 * the next scheduled publish, so a page can wake up exactly when one lands
 * instead of only waiting for the poll. See `usePolling`.
 */
export interface StudentAssignmentsResponse {
	assignments: CS17Assignment[]
	next_publish_on: string | null
}

export interface StudentGradesResponse {
	grades: CS17Grade[]
	next_publish_on: string | null
}

export interface StudentAnnouncementsResponse {
	announcements: CS17Announcement[]
	next_publish_on: string | null
}

// ---------------------------------------------------------------------------
// Enums, kept as const arrays so a Select can render the same list it validates
// ---------------------------------------------------------------------------

export const SUBMISSION_TYPES = ['Any', 'PDF', 'URL', 'Image', 'ZIP', 'Scratch'] as const
export type SubmissionType = (typeof SUBMISSION_TYPES)[number]

export const ASSIGNMENT_TYPES = ['Graded', 'Not Graded'] as const
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number]

/** How a graded assignment is scored. `null` on a Not Graded assignment. */
export const EVALUATION_TYPES = ['Grade', 'Marks'] as const
export type EvaluationType = (typeof EVALUATION_TYPES)[number]

export const GRADE_SCALE = ['A', 'B', 'C', 'D', 'E'] as const
export type GradeLetter = (typeof GRADE_SCALE)[number]

export const ALERT_VARIANTS = ['info', 'warning', 'error'] as const
export type AlertVariant = (typeof ALERT_VARIANTS)[number]

/** The publishing choice shared by the assignment and announcement forms. */
export type PublishMode = 'draft' | 'now' | 'schedule'

declare global {
	interface Window {
		/** Boot keys written by `frappe-ui/vite`'s jinjaBootData plugin. */
		current_user?: string
		profile?: CS17Profile | null
		csrf_token?: string
		system_timezone?: string
		site_name?: string
		frappe_version?: string
		read_only_mode?: boolean
	}
}
