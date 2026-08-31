export interface CohortSubmission {
	name: string;
	student: string;
	full_name: string;
	assignment: string;
	assignment_title: string;
	submission_type: string | null;
	submission_document?: string | null;
	max_marks: number;
	submitted_at: string;
	marks_obtained: number | null;
	grade: string | null;
	graded: boolean;
}
