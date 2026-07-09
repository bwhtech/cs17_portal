import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
	useFrappeGetDoc,
	useFrappeGetDocList,
	useFrappePostCall,
} from "frappe-react-sdk";
import { ArrowLeft, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import {
	SCRATCH_EDITOR_URL,
	SCRATCH_MESSAGE,
	SCRATCH_TARGET_ORIGIN,
	arrayBufferToBase64,
	dataUrlToBase64,
} from "@/lib/scratch";

const AUTOSAVE_IDLE_MS = 15000;

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ProjectDoc {
	name: string;
	project_title: string;
	sb3_file: string | null;
	last_saved_at: string | null;
}

interface ScratchAssignment {
	name: string;
	title: string;
}

export default function ProjectEditorPage() {
	const { id: projectId } = useParams<{ id: string }>();
	const { student } = useCurrentStudent();

	const {
		data: project,
		isLoading: projectLoading,
		mutate: mutateProject,
	} = useFrappeGetDoc<ProjectDoc>("CS17 Project", projectId);

	const { call: saveProject } = useFrappePostCall("cs17_portal.api.save_project");
	const { call: submitScratchProject, loading: submitting } = useFrappePostCall(
		"cs17_portal.api.submit_scratch_project",
	);

	const iframeRef = useRef<HTMLIFrameElement>(null);
	const editorReadyRef = useRef(false);
	const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// The editor answers request-sb3 with a single project-sb3; this remembers whether
	// that reply belongs to a manual Save or a silent autosave so the status reads right.
	const pendingSaveKindRef = useRef<"manual" | "auto" | null>(null);

	const [status, setStatus] = useState<SaveStatus>("idle");
	const [submitOpen, setSubmitOpen] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);

	// The freshest sb3_file url, without waiting for a project refetch after the first save.
	const sb3FileRef = useRef<string | null>(null);
	useEffect(() => {
		sb3FileRef.current = project?.sb3_file ?? null;
	}, [project?.sb3_file]);

	const performSave = useCallback(
		async (sb3: ArrayBuffer, thumbnail: string | undefined, kind: "manual" | "auto") => {
			if (!projectId) return;
			setStatus("saving");
			try {
				const payload: Record<string, string> = {
					project: projectId,
					filename: `${projectId}.sb3`,
					content: arrayBufferToBase64(sb3),
				};
				if (thumbnail) {
					payload.thumbnail_filename = `${projectId}.png`;
					payload.thumbnail_content = dataUrlToBase64(thumbnail);
				}
				const response = await saveProject(payload);
				sb3FileRef.current = response.message?.sb3_file ?? sb3FileRef.current;
				setStatus("saved");
				if (kind === "manual") await mutateProject();
			} catch {
				setStatus("error");
			}
		},
		[projectId, saveProject, mutateProject],
	);

	const requestSb3 = useCallback((kind: "manual" | "auto") => {
		if (!editorReadyRef.current || !iframeRef.current?.contentWindow) return;
		pendingSaveKindRef.current = kind;
		iframeRef.current.contentWindow.postMessage(
			{ type: SCRATCH_MESSAGE.requestSb3 },
			SCRATCH_TARGET_ORIGIN,
		);
	}, []);

	const loadExistingProject = useCallback(async () => {
		const fileUrl = sb3FileRef.current;
		if (!fileUrl || !iframeRef.current?.contentWindow) return;
		const response = await fetch(fileUrl, { credentials: "include" });
		if (!response.ok) return;
		const sb3 = await response.arrayBuffer();
		iframeRef.current.contentWindow.postMessage(
			{ type: SCRATCH_MESSAGE.loadProject, sb3 },
			SCRATCH_TARGET_ORIGIN,
			[sb3],
		);
	}, []);

	useEffect(() => {
		async function handleMessage(event: MessageEvent) {
			const data = event.data ?? {};
			if (data.type === SCRATCH_MESSAGE.ready) {
				editorReadyRef.current = true;
				await loadExistingProject();
			} else if (data.type === SCRATCH_MESSAGE.dirty) {
				if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
				autosaveTimerRef.current = setTimeout(() => requestSb3("auto"), AUTOSAVE_IDLE_MS);
			} else if (data.type === SCRATCH_MESSAGE.projectSb3) {
				const kind = pendingSaveKindRef.current ?? "manual";
				pendingSaveKindRef.current = null;
				await performSave(data.sb3, data.thumbnail, kind);
			}
		}

		window.addEventListener("message", handleMessage);
		return () => {
			window.removeEventListener("message", handleMessage);
			if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
		};
	}, [loadExistingProject, requestSb3, performSave]);

	if (projectLoading) {
		return <Skeleton className="h-[70vh] w-full" />;
	}

	return (
		<div className="flex flex-col h-full -m-6">
			<div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-background shrink-0">
				<Button variant="ghost" size="sm" asChild>
					<Link to="/projects">
						<ArrowLeft className="w-4 h-4" />
						Projects
					</Link>
				</Button>
				<h1 className="font-semibold truncate">{project?.project_title}</h1>
				<span className="text-xs text-muted-foreground ml-2">{statusLabel(status)}</span>
				<div className="ml-auto flex items-center gap-2">
					<Button variant="outline" size="sm" onClick={() => requestSb3("manual")}>
						<Save className="w-4 h-4" />
						Save
					</Button>
					<Button size="sm" onClick={() => setSubmitOpen(true)}>
						<Send className="w-4 h-4" />
						Submit
					</Button>
				</div>
			</div>

			<iframe
				ref={iframeRef}
				src={SCRATCH_EDITOR_URL}
				title="Scratch editor"
				className="flex-1 w-full border-0"
			/>

			<SubmitProjectDialog
				open={submitOpen}
				onOpenChange={(open) => {
					setSubmitOpen(open);
					if (!open) setSubmitError(null);
				}}
				cohort={student?.cohort ?? null}
				error={submitError}
				submitting={submitting}
				onSubmit={async (assignment) => {
					setSubmitError(null);
					try {
						// Submit snapshots the last saved .sb3 (the API rejects an unsaved project);
						// it deliberately does NOT trigger a fresh save, which would race the snapshot read.
						await submitScratchProject({ assignment, project: projectId });
						setSubmitOpen(false);
					} catch (err) {
						setSubmitError(
							(err as { message?: string })?.message ?? "Could not submit the project.",
						);
					}
				}}
			/>
		</div>
	);
}

function statusLabel(status: SaveStatus): string {
	if (status === "saving") return "Saving…";
	if (status === "saved") return "Saved";
	if (status === "error") return "Save failed";
	return "";
}

interface SubmitDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	cohort: string | null;
	error: string | null;
	submitting: boolean;
	onSubmit: (assignment: string) => Promise<void>;
}

function SubmitProjectDialog({
	open,
	onOpenChange,
	cohort,
	error,
	submitting,
	onSubmit,
}: SubmitDialogProps) {
	const { data: assignments, isLoading } = useFrappeGetDocList<ScratchAssignment>(
		"CS17 Assignment",
		{
			filters: [
				["cohort", "=", cohort ?? ""],
				["submission_type", "=", "Scratch"],
				["is_published", "=", 1],
			],
			fields: ["name", "title"],
			limit: 100,
		},
		cohort ? undefined : null,
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Submit to an assignment</DialogTitle>
					<DialogDescription>
						Pick a Scratch assignment. Your current project is snapshotted on submit.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-2 py-2">
					{isLoading ? (
						<Skeleton className="h-10 w-full" />
					) : (assignments ?? []).length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No open Scratch assignments in your cohort.
						</p>
					) : (
						(assignments ?? []).map((assignment) => (
							<Button
								key={assignment.name}
								variant="outline"
								className="w-full justify-start"
								disabled={submitting}
								onClick={() => onSubmit(assignment.name)}
							>
								{assignment.title}
							</Button>
						))
					)}
					{error && <p className="text-sm text-destructive">{error}</p>}
				</div>
			</DialogContent>
		</Dialog>
	);
}
