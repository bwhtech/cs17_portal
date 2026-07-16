import { useNavigate } from "react-router-dom";
import { useFrappePostCall } from "frappe-react-sdk";

interface ScratchAssignment {
	name: string;
	title?: string;
}

interface ScratchSubmission {
	project?: string;
}

export function scratchEditorPath(
	project: string,
	assignment: string,
	readOnly = false,
): string {
	const path = `/projects/${project}/edit?assignment=${encodeURIComponent(assignment)}`;
	return readOnly ? `${path}&readonly=1` : path;
}

export function useScratchEditor() {
	const navigate = useNavigate();
	const { call: createProject } = useFrappePostCall("cs17_portal.api.create_project");

	async function createNewProject(title?: string): Promise<string | null> {
		try {
			const { message } = await createProject({
				project_title: title || "Scratch project",
			});
			return message?.name ?? null;
		} catch {
			navigate("/projects");
			return null;
		}
	}

	async function open(
		assignment: ScratchAssignment,
		submission?: ScratchSubmission | null,
		options: { readOnly?: boolean } = {},
	) {
		const project = submission?.project ?? (await createNewProject(assignment.title));
		if (project) {
			navigate(scratchEditorPath(project, assignment.name, options.readOnly));
		}
	}

	return { open };
}
