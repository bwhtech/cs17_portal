import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import AssignmentTable from "@/components/ui/AssignmentTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AssignmentsPage() {
  const { student, isLoading: studentLoading } = useCurrentStudent();

  const { data: assignments, isLoading: assignmentsLoading } = useFrappeGetDocList(
    "CS17 Assignment",
    {
      filters: [["cohort", "=", student?.cohort ?? ""]],
      fields: ["name", "title", "due_date", "max_marks", "assignment_type"],
      orderBy: { field: "due_date", order: "asc" },
      limit: 100,
    },
    student?.cohort ? undefined : null,
  );

  const { data: submissions } = useFrappeGetDocList(
    "CS17 Assignment Submission",
    {
      filters: [["student", "=", student?.name ?? ""]],
      fields: ["name", "assignment", "submitted_at", "modified"],
      limit: 100,
    },
    student?.name ? undefined : null,
  );

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map((s) => [s.assignment, s]),
  );

  const submissionNames = (submissions ?? []).map((s) => s.name);

  const { data: grades } = useFrappeGetDocList(
    "CS17 Assignment Grade",
    {
      filters: [["submission", "in", submissionNames]],
      fields: ["name", "assignment", "submission", "marks_obtained", "grade", "evaluation_type", "remarks"],
      limit: 100,
    },
    submissionNames.length > 0 ? undefined : null,
  );

  const gradeMap = Object.fromEntries(
    (grades ?? []).map((g) => [g.assignment, g]),
  );

  const [gradeAssignment, setGradeAssignment] = useState<string | null>(null);
  const activeGrade = gradeAssignment ? gradeMap[gradeAssignment] : null;

  if (studentLoading || assignmentsLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {assignments?.length ?? 0} total
        </p>
      </div>

      <div className="bg-background border border-border rounded-xl p-5">
        <AssignmentTable
          assignments={assignments ?? []}
          submissionMap={submissionMap}
          gradeMap={gradeMap}
          onSubmitSuccess={() => {}}
          onViewGrade={(assignmentName) => setGradeAssignment(assignmentName)}
        />
      </div>

      <Dialog
        open={!!gradeAssignment}
        onOpenChange={(open) => {
          if (!open) setGradeAssignment(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grade & Feedback</DialogTitle>
          </DialogHeader>
          {activeGrade ? (
            <div className="space-y-3 py-2">
              {activeGrade.evaluation_type === "Grade" ? (
                <div>
                  <p className="text-sm text-muted-foreground">Grade</p>
                  <p className="text-2xl font-semibold">{activeGrade.grade ?? "—"}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Marks Obtained</p>
                  <p className="text-2xl font-semibold">{activeGrade.marks_obtained ?? "—"}</p>
                </div>
              )}
              {activeGrade.remarks && (
                <div>
                  <p className="text-sm text-muted-foreground">Remarks</p>
                  <p className="text-sm">{activeGrade.remarks}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">No grade posted yet.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}