import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { useStudentAssignments } from "@/hooks/useStudentAssignments";
import { LIVE_LIST_OPTIONS } from "@/lib/liveQuery";
import AssignmentTable from "@/components/ui/AssignmentTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import GradeDialog from "@/components/ui/GradeDialog";

export default function AssignmentsPage() {
  const { student, isLoading: studentLoading } = useCurrentStudent();

  const { assignments, isLoading: assignmentsLoading } = useStudentAssignments(
    student?.cohort,
  );

  const {
    data: submissions,
    mutate: mutateSubmissions,
  } = useFrappeGetDocList(
    "CS17 Assignment Submission",
    {
      filters: [["student", "=", student?.name ?? ""]],
      fields: ["name", "assignment", "submitted_at", "submission_document", "submission_url"],
      limit: 100,
    },
    student?.name ? undefined : null,
  );

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map((s) => [s.assignment, s]),
  );

  const submissionNames = new Set((submissions ?? []).map((s) => s.name));
  const assignmentNames = (assignments ?? []).map((a) => a.name);

  const { data: grades, mutate: mutateGrades } = useFrappeGetDocList(
    "CS17 Assignment Grade",
    {
      filters: [["assignment", "in", assignmentNames], ["is_published", "=", 1]],
      fields: ["name", "assignment", "submission", "marks_obtained", "grade", "evaluation_type", "remarks", "is_published"],
      limit: 100,
    },
    assignmentNames.length > 0 ? undefined : null,
    LIVE_LIST_OPTIONS,
  );

  const gradeMap = Object.fromEntries(
    (grades ?? [])
      .filter((g) =>
        g.submission
          ? submissionNames.has(g.submission)
          : !!submissionMap[g.assignment],
      )
      .map((g) => [g.assignment, g]),
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