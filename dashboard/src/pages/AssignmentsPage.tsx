import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import AssignmentCard from "@/components/ui/AssignmentCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function AssignmentsPage() {
  const { student, isLoading: studentLoading } = useCurrentStudent();

  const { data: assignments, isLoading: assignmentsLoading } = useFrappeGetDocList(
    "CS17 Assignment",
    {
      filters: [["cohort", "=", student?.cohort ?? ""]],
      fields: ["name", "title", "due_date", "max_marks"],
      orderBy: { field: "due_date", order: "asc" },
      limit: 50,
    },
    student?.cohort ? undefined : null
  );

  const { data: submissions, isLoading: submissionsLoading, mutate } = useFrappeGetDocList(
    "CS17 Assignment Submission",
    {
      filters: [["student", "=", student?.name ?? ""]],
      fields: ["name", "assignment", "submitted_at"],
      limit: 100,
    },
    student?.name ? undefined : null
  );

  const isLoading = studentLoading || assignmentsLoading || submissionsLoading;

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map((s) => [s.assignment, s])
  );

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Assignments</h1>
      {assignments?.length === 0 && (
        <p className="text-muted-foreground">No assignments yet.</p>
      )}
      {assignments?.map((a) => (
        <AssignmentCard
          key={a.name}
          assignment={a}
          submission={submissionMap[a.name] ?? null}
          onSubmitSuccess={() => mutate()}
        />
      ))}
    </div>
  );
}