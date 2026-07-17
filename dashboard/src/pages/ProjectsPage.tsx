import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { Blocks, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import DeleteProjectDialog from "@/components/ui/DeleteProjectDialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectsPortal } from "@/hooks/useProjectsPortal";
import { formatDateTime } from "@/lib/dayjs";
import { frappeErrorMessage } from "@/lib/frappeError";

interface Project {
	name: string;
	project_title: string;
	thumbnail: string | null;
	last_saved_at: string | null;
	is_submitted: boolean;
}

export default function ProjectsPage() {
	const navigate = useNavigate();
	const { projectsPath } = useProjectsPortal();

	const {
		data,
		isLoading,
		mutate,
	} = useFrappeGetCall<{ message: Project[] }>("cs17_portal.api.list_my_projects");

	const { call: createProject, loading: creating } = useFrappePostCall(
		"cs17_portal.api.create_project",
	);
	const { call: renameProject, loading: renaming } = useFrappePostCall(
		"cs17_portal.api.rename_project",
	);

	const [newProjectOpen, setNewProjectOpen] = useState(false);
	const [projectToRename, setProjectToRename] = useState<Project | null>(null);
	const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

	async function handleNewProject(projectTitle: string) {
		const response = await createProject({ project_title: projectTitle });
		mutate();
		navigate(`${projectsPath}/${response.message.name}/edit`);
	}

	async function handleRename(projectTitle: string) {
		await renameProject({
			project: projectToRename!.name,
			project_title: projectTitle,
		});
		await mutate();
		setProjectToRename(null);
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
				<Button onClick={() => setNewProjectOpen(true)} disabled={creating}>
					<Plus className="w-4 h-4" />
					New Project
				</Button>
			</div>

			<ProjectNameDialog
				open={newProjectOpen}
				onOpenChange={setNewProjectOpen}
				title="New project"
				description="Give your Scratch project a name. You can rename it later."
				action="Create"
				busy={creating}
				onSubmit={handleNewProject}
			/>

			<ProjectNameDialog
				open={projectToRename !== null}
				onOpenChange={(open) => !open && setProjectToRename(null)}
				title="Rename project"
				description="Choose a new name for this project."
				action="Rename"
				initialTitle={projectToRename?.project_title ?? ""}
				busy={renaming}
				onSubmit={handleRename}
			/>

			<DeleteProjectDialog
				open={projectToDelete !== null}
				onOpenChange={(open) => !open && setProjectToDelete(null)}
				project={projectToDelete}
				onSuccess={() => {
					mutate();
					setProjectToDelete(null);
				}}
			/>

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
							onClick={() => navigate(`${projectsPath}/${project.name}/edit`)}
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
							<CardContent className="p-4 flex items-start gap-2">
								<div className="min-w-0 flex-1">
									<p className="font-medium truncate">{project.project_title}</p>
									<p className="text-xs text-muted-foreground mt-1">
										{project.last_saved_at
											? `Saved ${formatDateTime(project.last_saved_at)}`
											: "Not saved yet"}
									</p>
								</div>
								<ProjectActions
									project={project}
									onRename={() => setProjectToRename(project)}
									onDelete={() => setProjectToDelete(project)}
								/>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}

function ProjectActions({
	project,
	onRename,
	onDelete,
}: {
	project: Project;
	onRename: () => void;
	onDelete: () => void;
}) {
	function act(run: () => void) {
		return (event: React.MouseEvent) => {
			event.stopPropagation();
			run();
		};
	}

	return (
		<span
			className="inline-flex items-center gap-0.5 shrink-0"
			title={
				project.is_submitted
					? "Submitted to an assignment, so it cannot be renamed or deleted"
					: undefined
			}
		>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7"
				aria-label={`Rename ${project.project_title}`}
				disabled={project.is_submitted}
				onClick={act(onRename)}
			>
				<Pencil className="w-3.5 h-3.5" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 text-muted-foreground hover:text-destructive"
				aria-label={`Delete ${project.project_title}`}
				disabled={project.is_submitted}
				onClick={act(onDelete)}
			>
				<Trash2 className="w-3.5 h-3.5" />
			</Button>
		</span>
	);
}

interface ProjectNameDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	action: string;
	initialTitle?: string;
	busy: boolean;
	onSubmit: (projectTitle: string) => Promise<void>;
}

function ProjectNameDialog({
	open,
	onOpenChange,
	title,
	description,
	action,
	initialTitle = "",
	busy,
	onSubmit,
}: ProjectNameDialogProps) {
	const [value, setValue] = useState(initialTitle);
	const [error, setError] = useState<string | null>(null);

	const [wasOpen, setWasOpen] = useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) {
			setValue(initialTitle);
			setError(null);
		}
	}

	const projectTitle = value.trim();

	async function submit() {
		if (!projectTitle) return;
		setError(null);
		try {
			await onSubmit(projectTitle);
		} catch (err) {
			setError(frappeErrorMessage(err, `Could not ${action.toLowerCase()} the project.`));
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<form
					className="space-y-2 py-2"
					onSubmit={(event) => {
						event.preventDefault();
						submit();
					}}
				>
					<Input
						autoFocus
						value={value}
						onChange={(event) => setValue(event.target.value)}
						placeholder="Project name"
						aria-label="Project name"
						aria-invalid={error ? true : undefined}
					/>
					{error && <p className="text-sm text-destructive">{error}</p>}
				</form>
				<DialogFooter>
					<Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button disabled={busy || !projectTitle} onClick={submit}>
						{busy ? "Working…" : action}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
