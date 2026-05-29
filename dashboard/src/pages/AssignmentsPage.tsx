import { useState } from "react";
import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import AssignmentTable from "@/components/ui/AssignmentTable";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AssignmentsPage() {
  const { student, isLoading: studentLoading } = useCurrentStudent();
  const [gradeAssignment, setGradeAssignment] = useState<string | null>(null);

  const { data: assignments, isLoading: assignmentsLoading } =
    useFrappeGetDocList(
      "CS17 Assignment",
      {
        filters: [["cohort", "=", student?.cohort ?? ""]],
        fields: ["name", "title", "due_date", "max_marks"],
        orderBy: { field: "due_date", order: "asc" },
        limit: 50,
      },
      student?.cohort ? undefined : null
    );

  const {
    data: submissions,
    isLoading: submissionsLoading,
    mutate,
  } = useFrappeGetDocList(
    "CS17 Assignment Submission",
    {
      filters: [["student", "=", student?.name ?? ""]],
      fields: ["name", "assignment", "submitted_at", "edited_at"],
      limit: 100,
    },
    student?.name ? undefined : null
  );

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map((s) => [s.assignment, s])
  );

  const submissionNames = (submissions ?? []).map((s) => s.name);

  const { data: grades } = useFrappeGetDocList(
    "CS17 Assignment Grade",
    {
      filters: [["submission", "in", submissionNames]],
      fields: ["name", "assignment", "submission", "marks_obtained", "remarks"],
      limit: 100,
    },
    submissionNames.length > 0 ? undefined : null
  );

  const gradeMap = Object.fromEntries(
    (grades ?? []).map((g) => [g.assignment, g])
  );

  const isLoading = studentLoading || assignmentsLoading || submissionsLoading;
  const activeGrade = gradeAssignment ? gradeMap[gradeAssignment] : null;

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Assignments</h1>

      <AssignmentTable
        assignments={assignments ?? []}
        submissionMap={submissionMap}
        onSubmitSuccess={() => mutate()}
        onViewGrade={(assignmentName) => setGradeAssignment(assignmentName)}
      />

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
              <div>
                <p className="text-sm text-muted-foreground">Marks Obtained</p>
                <p className="text-2xl font-semibold">
                  {activeGrade.marks_obtained}
                </p>
              </div>
              {activeGrade.remarks && (
                <div>
                  <p className="text-sm text-muted-foreground">Remarks</p>
                  <p className="text-sm">{activeGrade.remarks}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              No grade posted yet.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}