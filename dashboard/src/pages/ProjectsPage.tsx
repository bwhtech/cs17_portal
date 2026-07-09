import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { Blocks, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/dayjs";

interface Project {
	name: string;
	project_title: string;
	thumbnail: string | null;
	last_saved_at: string | null;
}

export default function ProjectsPage() {
	const navigate = useNavigate();

	const {
		data,
		isLoading,
		mutate,
	} = useFrappeGetCall<{ message: Project[] }>("cs17_portal.api.list_my_projects");

	const { call: createProject, loading: creating } = useFrappePostCall(
		"cs17_portal.api.create_project",
	);

	const [error, setError] = useState<string | null>(null);

	async function handleNewProject() {
		const projectTitle = window.prompt("Name your project")?.trim();
		if (!projectTitle) return;
		setError(null);
		try {
			const response = await createProject({ project_title: projectTitle });
			await mutate();
			navigate(`/projects/${response.message.name}/edit`);
		} catch (err) {
			setError((err as { message?: string })?.message ?? "Could not create the project.");
		}
	}

	const projects = data?.message ?? [];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Projects</h1>
					<p className="text-sm text-muted-foreground mt-1">
						{projects.length} project{projects.length === 1 ? "" : "s"}
					</p>
				</div>
				<Button onClick={handleNewProject} disabled={creating}>
					<Plus className="w-4 h-4" />
					{creating ? "Creating…" : "New Project"}
				</Button>
			</div>

			{error && <p className="text-sm text-destructive">{error}</p>}

			{isLoading ? (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-40 w-full" />
				</div>
			) : projects.length === 0 ? (
				<div className="border border-dashed border-border rounded-xl p-12 text-center">
					<Blocks className="w-8 h-8 mx-auto text-muted-foreground" />
					<p className="mt-3 text-sm text-muted-foreground">
						No projects yet. Create your first Scratch project to get started.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{projects.map((project) => (
						<Card
							key={project.name}
							className="cursor-pointer transition-colors hover:border-primary py-0 overflow-hidden"
							onClick={() => navigate(`/projects/${project.name}/edit`)}
						>
							<div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
								{project.thumbnail ? (
									<img
										src={project.thumbnail}
										alt={project.project_title}
										className="w-full h-full object-cover"
									/>
								) : (
									<Blocks className="w-8 h-8 text-muted-foreground" />
								)}
							</div>
							<CardContent className="p-4">
								<p className="font-medium truncate">{project.project_title}</p>
								<p className="text-xs text-muted-foreground mt-1">
									{project.last_saved_at
										? `Saved ${formatDateTime(project.last_saved_at)}`
										: "Not saved yet"}
								</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
