import { useNavigate } from "react-router-dom";
import { useFrappePostCall } from "frappe-react-sdk";

interface ScratchAssignmentRef {
	name: string;
	title?: string;
}

// Editor URL for a project, carrying the assignment so submit can preselect it.
export function scratchEditorPath(project: string, assignment: string): string {
	return `/projects/${project}/edit?assignment=${encodeURIComponent(assignment)}`;
}

// Creates a fresh project and drops the student straight into the Scratch editor
// for the given assignment, instead of sending them to the projects page to make
// one by hand. The assignment name rides along in the URL so the submit dialog
// can preselect it.
export function useStartScratchSubmission() {
	const navigate = useNavigate();
	const { call: createProject, loading } = useFrappePostCall(
		"cs17_portal.api.create_project",
	);

	async function start(assignment: ScratchAssignmentRef) {
		try {
			const response = await createProject({
				project_title: assignment.title || "Scratch project",
			});
			const projectName = response.message?.name;
			navigate(scratchEditorPath(projectName, assignment.name));
		} catch {
			// Fall back to the manual projects page if creation fails.
			navigate("/projects");
		}
	}

	return { start, starting: loading };
}
