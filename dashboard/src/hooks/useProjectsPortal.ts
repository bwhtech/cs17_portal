import { useCurrentProfile } from "@/hooks/useCurrentProfile";

export function useProjectsPortal() {
	const { profile } = useCurrentProfile();
	const isFaculty = profile?.profile_type === "Faculty";

	return {
		isFaculty,
		projectsPath: isFaculty ? "/faculty/projects" : "/projects",
	};
}
