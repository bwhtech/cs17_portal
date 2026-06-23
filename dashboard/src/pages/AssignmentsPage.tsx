import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import AssignmentTable from "@/components/ui/AssignmentTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import GradeDialog from "@/components/ui/GradeDialog";

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

  const {
    data: submissions,
    mutate: mutateSubmissions,
  } = useFrappeGetDocList(
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

  const { data: grades, mutate: mutateGrades } = useFrappeGetDocList(
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
          onSubmitSuccess={() => {
            mutateSubmissions();
            mutateGrades();
          }}
          onViewGrade={(assignmentName) => setGradeAssignment(assignmentName)}
        />
      </div>

      <GradeDialog
        open={!!gradeAssignment}
        onOpenChange={(open) => { if (!open) setGradeAssignment(null); }}
        grade={activeGrade}
      />
    </div>
  );
}