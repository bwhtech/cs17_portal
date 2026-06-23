import { useParams, useNavigate } from "react-router-dom";
import { useFrappeGetDoc, useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import SubmitAssignmentDialog from "@/components/ui/SubmitAssignmentDialog";
import { formatDateTime } from "@/lib/dayjs";
import { ArrowLeft } from "lucide-react";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { useEffect } from "react";

export default function AssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const { student } = useCurrentStudent();
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { setBreadcrumb } = useBreadcrumb();

  const { data: assignment, isLoading: assignmentLoading } = useFrappeGetDoc(
    "CS17 Assignment",
    assignmentId,
  );

  const { data: submissions, mutate } = useFrappeGetDocList(
    "CS17 Assignment Submission",
    {
      filters: [
        ["student", "=", student?.name ?? ""],
        ["assignment", "=", assignmentId ?? ""],
      ],
      fields: ["name", "assignment", "submitted_at", "modified"],
      limit: 1,
    },
    student?.name && assignmentId ? undefined : null,
  );

  const submission = submissions?.[0] ?? null;

  const { data: grades } = useFrappeGetDocList(
    "CS17 Assignment Grade",
    {
      filters: [["submission", "=", submission?.name ?? ""]],
      fields: ["name", "evaluation_type", "marks_obtained", "grade", "remarks"],
      limit: 1,
    },
    submission?.name ? undefined : null,
  );

  const gradeDoc = grades?.[0] ?? null;
  const isGraded = !!gradeDoc;

  useEffect(() => {
    if (!assignment) return;
    setBreadcrumb([
      { label: "Assignments", href: "/assignments" },
      { label: assignment.title },
    ]);
    return () => setBreadcrumb([]);
  }, [assignment?.title]);

  if (assignmentLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!assignment) {
    return <p className="text-muted-foreground">Assignment not found.</p>;
  }

  const isOverdue = new Date(assignment.due_date) < new Date();

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate("/assignments")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Assignments
      </button>

      <div className="flex gap-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold mb-4">{assignment.title}</h1>
          <div
            className="ql-editor read-mode prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html:
                assignment.description ?? "<p>No description provided.</p>",
            }}
          />
        </div>

        <div className="w-64 shrink-0 space-y-4">
          <div className="border border-border rounded-xl p-4 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Due</p>
              <p
                className={`text-sm font-medium ${isOverdue ? "text-destructive" : ""}`}
              >
                {formatDateTime(assignment.due_date)}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Max Marks</p>
              <p className="text-sm font-medium">
                {assignment.assignment_type === "Not Graded"
                  ? "Non Graded"
                  : assignment.max_marks}
              </p>
            </div>

            {submission ? (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">Submitted</p>
                  <p className="text-sm font-medium text-green-600">
                    {formatDateTime(submission.submitted_at)}
                  </p>
                </div>
                {!isOverdue && !isGraded && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setDialogOpen(true)}
                  >
                    Edit Submission
                  </Button>
                )}
                {gradeDoc && (
                  <>
                    {gradeDoc.evaluation_type === "Grade" ? (
                      <div>
                        <p className="text-xs text-muted-foreground">Grade</p>
                        <p className="text-lg font-semibold">{gradeDoc.grade ?? "—"}</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-muted-foreground">Marks Obtained</p>
                        <p className="text-lg font-semibold">{gradeDoc.marks_obtained ?? "—"}</p>
                      </div>
                    )}
                    {gradeDoc.remarks && (
                      <div>
                        <p className="text-xs text-muted-foreground">Remarks</p>
                        <p className="text-sm mt-0.5">{gradeDoc.remarks}</p>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                disabled={isOverdue}
                onClick={() => setDialogOpen(true)}
              >
                {isOverdue ? "Deadline Passed" : "Submit Assignment"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <SubmitAssignmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        assignment={assignment}
        existingSubmission={submission}
        onSuccess={() => {
          setDialogOpen(false);
          mutate();
        }}
      />
    </div>
  );
}
