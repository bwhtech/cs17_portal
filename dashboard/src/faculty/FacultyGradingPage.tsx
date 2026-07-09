import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	SCRATCH_READONLY_EDITOR_URL,
	SCRATCH_MESSAGE,
	SCRATCH_TARGET_ORIGIN,
	base64ToArrayBuffer,
} from "@/lib/scratch";

interface CohortSubmission {
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

interface ExistingGrade {
	name: string;
	marks_obtained: number | null;
	grade: string | null;
	remarks: string | null;
}

const GRADE_OPTIONS = ["A", "B", "C", "D", "E"];

export default function FacultyGradingPage() {
	const { submissionId } = useParams<{ submissionId: string }>();

	const {
		data: submissionsData,
		isLoading,
		mutate: refreshSubmissions,
	} = useFrappeGetCall<{ message: CohortSubmission[] }>(
		"cs17_portal.api.list_cohort_submissions",
	);

	const submission =
		submissionsData?.message?.find((row) => row.name === submissionId) ?? null;

	if (isLoading) {
		return <Skeleton className="h-[70vh] w-full" />;
	}

	if (!submission) {
		return (
			<div className="space-y-4">
				<Button
					variant="ghost"
					size="sm"
					asChild
					className="cursor-pointer transition-colors"
				>
					<Link to="/faculty/assignments">
						<ArrowLeft className="w-4 h-4" />
						Submissions
					</Link>
				</Button>
				<p className="text-sm text-muted-foreground">
					This submission is not available in your cohort.
				</p>
			</div>
		);
	}

	const isScratch = submission.submission_type === "Scratch";

	return (
		<div className="flex flex-col h-full -m-6">
			<div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-background shrink-0">
				<Button
					variant="ghost"
					size="sm"
					asChild
					className="cursor-pointer transition-colors"
				>
					<Link to="/faculty/assignments">
						<ArrowLeft className="w-4 h-4" />
						Submissions
					</Link>
				</Button>
				<div className="min-w-0">
					<h1 className="font-semibold truncate">{submission.assignment_title}</h1>
					<p className="text-xs text-muted-foreground truncate">
						{submission.full_name} · out of {submission.max_marks} marks
					</p>
				</div>
				<div className="ml-auto shrink-0">
					{submission.graded ? (
						<Badge variant="default">
							{submission.marks_obtained != null
								? `${submission.marks_obtained} / ${submission.max_marks}`
								: (submission.grade ?? "Graded")}
						</Badge>
					) : (
						<Badge variant="secondary">Pending</Badge>
					)}
				</div>
			</div>

			<div className="flex flex-1 min-h-0 flex-col">
				<div className="flex-1 min-h-0 bg-muted">
					{isScratch ? (
						<ReadOnlyPlayer submission={submission.name} />
					) : (
						<SubmissionFile fileUrl={submission.submission_document} />
					)}
				</div>
				<div className="shrink-0 border-t border-border bg-background">
					<GradeFormLoader
						submission={submission}
						onGraded={() => refreshSubmissions()}
					/>
				</div>
			</div>
		</div>
	);
}

function ReadOnlyPlayer({ submission }: { submission: string }) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const readyRef = useRef(false);
	const loadedRef = useRef(false);

	const { data, isLoading, error } = useFrappeGetCall<{ message: { content: string } }>(
		"cs17_portal.api.get_submission_project",
		{ submission },
		`grading-project-${submission}`,
	);
	const sb3Content = data?.message?.content ?? null;

	const loadIntoPlayer = useCallback(() => {
		if (loadedRef.current || !readyRef.current || !sb3Content) return;
		if (!iframeRef.current?.contentWindow) return;
		const sb3 = base64ToArrayBuffer(sb3Content);
		loadedRef.current = true;
		iframeRef.current.contentWindow.postMessage(
			{ type: SCRATCH_MESSAGE.loadProject, sb3 },
			SCRATCH_TARGET_ORIGIN,
			[sb3],
		);
	}, [sb3Content]);

	// The snapshot content may resolve after the editor already sent `ready`, so try loading
	// whenever either side becomes available.
	useEffect(() => {
		loadIntoPlayer();
	}, [loadIntoPlayer]);

	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			if (event.data?.type === SCRATCH_MESSAGE.ready) {
				readyRef.current = true;
				loadIntoPlayer();
			}
		}
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [loadIntoPlayer]);

	if (error) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
				Could not load the submitted project.
			</div>
		);
	}

	return (
		<div className="relative h-full w-full">
			{isLoading && <Skeleton className="absolute inset-0" />}
			<iframe
				ref={iframeRef}
				src={SCRATCH_READONLY_EDITOR_URL}
				title="Scratch submission player"
				className="h-full w-full border-0"
			/>
		</div>
	);
}

function SubmissionFile({ fileUrl }: { fileUrl?: string | null }) {
	if (!fileUrl) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
				No submitted file.
			</div>
		);
	}
	return (
		<div className="flex h-full items-center justify-center p-6">
			<a href={fileUrl} target="_blank" rel="noopener noreferrer">
				<Button variant="outline">
					<ExternalLink className="mr-2 h-4 w-4" />
					Open submission
				</Button>
			</a>
		</div>
	);
}

function GradeFormLoader({
	submission,
	onGraded,
}: {
	submission: CohortSubmission;
	onGraded: () => void;
}) {
	const { data, isLoading } = useFrappeGetCall<{ message: ExistingGrade | null }>(
		"cs17_portal.api.get_submission_grade",
		{ submission: submission.name },
		`grade-of-${submission.name}`,
	);

	if (isLoading) {
		return <Skeleton className="m-4 h-20" />;
	}

	const existingGrade = data?.message ?? null;
	// Keyed so the form remounts with fresh initial state once the grade resolves.
	return (
		<GradeForm
			key={existingGrade?.name ?? "new"}
			submission={submission}
			existingGrade={existingGrade}
			onGraded={onGraded}
		/>
	);
}

function GradeForm({
	submission,
	existingGrade,
	onGraded,
}: {
	submission: CohortSubmission;
	existingGrade: ExistingGrade | null;
	onGraded: () => void;
}) {
	const { call: saveGrade, loading: saving } = useFrappePostCall(
		"cs17_portal.api.save_grade",
	);

	const [marks, setMarks] = useState(
		existingGrade?.marks_obtained != null ? String(existingGrade.marks_obtained) : "",
	);
	const [grade, setGrade] = useState(existingGrade?.grade ?? "");
	const [remarks, setRemarks] = useState(existingGrade?.remarks ?? "");
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	async function handleSave() {
		setError(null);
		setSaved(false);

		const marksValue = marks.trim() === "" ? null : Number(marks);
		if (marksValue != null && Number.isNaN(marksValue)) {
			setError("Marks must be a number.");
			return;
		}
		if (marksValue != null && marksValue > submission.max_marks) {
			setError(`Marks cannot exceed the maximum of ${submission.max_marks}.`);
			return;
		}
		if (marksValue != null && marksValue < 0) {
			setError("Marks cannot be negative.");
			return;
		}

		try {
			await saveGrade({
				submission: submission.name,
				marks_obtained: marksValue,
				grade: grade || null,
				remarks: remarks || null,
			});
			setSaved(true);
			onGraded();
		} catch (err) {
			setError((err as { message?: string })?.message ?? "Could not save the grade.");
		}
	}

	return (
		<div className="p-4">
			<div className="flex flex-col gap-4 md:flex-row md:items-end">
				<div className="w-full space-y-1.5 md:w-36">
					<label className="text-sm font-medium">Marks obtained</label>
					<Input
						type="number"
						value={marks}
						min={0}
						max={submission.max_marks}
						onChange={(event) => setMarks(event.target.value)}
						placeholder={`0 – ${submission.max_marks}`}
					/>
				</div>

				<div className="w-full space-y-1.5 md:w-36">
					<label className="text-sm font-medium">Grade</label>
					<select
						value={grade}
						onChange={(event) => setGrade(event.target.value)}
						className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
					>
						<option value="">No grade</option>
						{GRADE_OPTIONS.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
				</div>

				<div className="flex-1 space-y-1.5">
					<label className="text-sm font-medium">Remarks</label>
					<textarea
						value={remarks}
						onChange={(event) => setRemarks(event.target.value)}
						rows={2}
						placeholder="Feedback for the student (Markdown supported)"
						className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
					/>
				</div>

				<Button
					className="w-full cursor-pointer transition-colors hover:bg-primary/90 md:w-auto"
					onClick={handleSave}
					disabled={saving}
				>
					{saving ? "Saving…" : existingGrade ? "Update grade" : "Save grade"}
				</Button>
			</div>

			{error && <p className="mt-2 text-sm text-destructive">{error}</p>}
			{saved && !error && (
				<p className="mt-2 text-sm text-muted-foreground">Grade saved.</p>
			)}
		</div>
	);
}
