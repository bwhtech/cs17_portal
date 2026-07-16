import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import {
	useFrappeGetDoc,
	useFrappeGetDocList,
	useFrappePostCall,
} from "frappe-react-sdk";
import { ArrowLeft, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ZenToggleButton } from "@/components/ui/ZenToggleButton";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { useZenOnMount } from "@/context/ZenModeContext";
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
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const presetAssignment = searchParams.get("assignment");
	const { student } = useCurrentStudent();
	useZenOnMount();

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
	const pendingSaveKindRef = useRef<"manual" | "auto" | null>(null);

	const [status, setStatus] = useState<SaveStatus>("idle");
	const [submitOpen, setSubmitOpen] = useState(false);

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
					<ZenToggleButton />
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
				onOpenChange={setSubmitOpen}
				cohort={student?.cohort ?? null}
				presetAssignment={presetAssignment}
				submitting={submitting}
				onSubmit={(assignment) =>
					submitScratchProject({ assignment, project: projectId })
				}
				onGoToDashboard={() => navigate("/")}
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
	presetAssignment?: string | null;
	submitting: boolean;
	onSubmit: (assignment: string) => Promise<unknown>;
	onGoToDashboard: () => void;
}

function SubmitProjectDialog({
	open,
	onOpenChange,
	cohort,
	presetAssignment,
	submitting,
	onSubmit,
	onGoToDashboard,
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

	const [chosen, setChosen] = useState<ScratchAssignment | null>(null);
	const [succeeded, setSucceeded] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Reset the phase each time the dialog opens (adjust state during render).
	const [wasOpen, setWasOpen] = useState(open);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) {
			setChosen(null);
			setSucceeded(false);
			setError(null);
		}
	}

	const list = assignments ?? [];
	// When the student came from a specific assignment, confirm against it directly.
	const preset = presetAssignment
		? list.find((assignment) => assignment.name === presetAssignment) ?? null
		: null;
	const target = chosen ?? preset;

	async function confirmSubmit() {
		if (!target) return;
		setError(null);
		try {
			await onSubmit(target.name);
			setSucceeded(true);
		} catch (err) {
			setError(
				(err as { message?: string })?.message ?? "Could not submit the project.",
			);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				{succeeded ? (
					<>
						<DialogHeader>
							<DialogTitle>Submission successful</DialogTitle>
							<DialogDescription>
								Your project was submitted to {target?.title}.
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button variant="outline" onClick={() => onOpenChange(false)}>
								Cancel
							</Button>
							<Button onClick={onGoToDashboard}>Go to Dashboard</Button>
						</DialogFooter>
					</>
				) : target ? (
					<>
						<DialogHeader>
							<DialogTitle>Submit this project?</DialogTitle>
							<DialogDescription>
								It will be submitted to {target.title}. Your current project is
								snapshotted; you can revise it until the deadline.
							</DialogDescription>
						</DialogHeader>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<DialogFooter>
							<Button
								variant="outline"
								disabled={submitting}
								onClick={() => (chosen ? setChosen(null) : onOpenChange(false))}
							>
								Cancel
							</Button>
							<Button disabled={submitting} onClick={confirmSubmit}>
								{submitting ? "Submitting…" : "Submit"}
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Submit to an assignment</DialogTitle>
							<DialogDescription>
								Pick a Scratch assignment to submit this project to.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-2 py-2">
							{isLoading ? (
								<Skeleton className="h-10 w-full" />
							) : list.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No open Scratch assignments in your cohort.
								</p>
							) : (
								list.map((assignment) => (
									<Button
										key={assignment.name}
										variant="outline"
										className="w-full justify-start"
										onClick={() => setChosen(assignment)}
									>
										{assignment.title}
									</Button>
								))
							)}
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
