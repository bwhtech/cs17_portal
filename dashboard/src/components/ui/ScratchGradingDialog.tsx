import { useCallback, useEffect, useRef, useState } from "react";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SCRATCH_READONLY_EDITOR_URL,
  SCRATCH_MESSAGE,
  SCRATCH_TARGET_ORIGIN,
  base64ToArrayBuffer,
} from "@/lib/scratch";

export interface GradingSubmission {
  name: string;
  assignment: string;
  assignment_title: string;
  full_name: string;
  submission_type?: string;
  submission_document?: string | null;
  max_marks: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: GradingSubmission;
  onGraded: () => void;
}

interface ExistingGrade {
  name: string;
  marks_obtained: number | null;
  grade: string | null;
  remarks: string | null;
}

const GRADE_OPTIONS = ["A", "B", "C", "D", "E"];

export default function ScratchGradingDialog({
  open,
  onOpenChange,
  submission,
  onGraded,
}: Props) {
  const isScratch = submission.submission_type === "Scratch";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Grade: {submission.assignment_title}</DialogTitle>
          <DialogDescription>
            {submission.full_name} · out of {submission.max_marks} marks
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {isScratch ? (
            <ReadOnlyPlayer submission={submission.name} />
          ) : (
            <SubmissionFile fileUrl={submission.submission_document} />
          )}
          <GradeFormLoader submission={submission} onGraded={onGraded} />
        </div>
      </DialogContent>
    </Dialog>
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
      <div className="flex items-center justify-center rounded-lg border border-border bg-muted p-6 text-sm text-muted-foreground">
        Could not load the submitted project.
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted">
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
      <div className="flex items-center justify-center rounded-lg border border-border bg-muted p-6 text-sm text-muted-foreground">
        No submitted file.
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center rounded-lg border border-border bg-muted p-6">
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
  submission: GradingSubmission;
  onGraded: () => void;
}) {
  const { data, isLoading } = useFrappeGetCall<{ message: ExistingGrade | null }>(
    "cs17_portal.api.get_submission_grade",
    { submission: submission.name },
    `grade-of-${submission.name}`,
  );

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
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
  submission: GradingSubmission;
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
    <div className="space-y-4">
      <div className="space-y-1.5">
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

      <div className="space-y-1.5">
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

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Remarks</label>
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          rows={5}
          placeholder="Feedback for the student (Markdown supported)"
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-muted-foreground">Grade saved.</p>}

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : existingGrade ? "Update grade" : "Save grade"}
      </Button>
    </div>
  );
}
