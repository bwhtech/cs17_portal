import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import AssignmentTable from "@/components/ui/AssignmentTable";
import AlertBanner from "@/components/ui/AlertBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DashboardPage() {
  const { student, isLoading: studentLoading } = useCurrentStudent();

  const { data: announcements } = useFrappeGetDocList(
    "CS17 Announcement",
    {
      filters: [
        ["is_published", "=", 1],
        ["cohort", "=", student?.cohort ?? ""],
      ],
      fields: ["name", "title", "content", "alert_variant", "is_dismissible"],
      orderBy: { field: "published_date", order: "desc" },
      limit: 10,
    },
    student?.cohort ? undefined : null,
  );

  const { data: assignments } = useFrappeGetDocList(
    "CS17 Assignment",
    {
      filters: [["cohort", "=", student?.cohort ?? ""]],
      fields: ["name", "title", "due_date", "max_marks", "assignment_type"],
      orderBy: { field: "creation", order: "desc" },
      limit: 20,
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

  const alerts = (announcements ?? []).map((a) => ({
    name: a.name,
    title: a.title,
    content: a.content,
    variant: (a.alert_variant ?? "info") as "info" | "warning" | "error",
    is_dismissible: !!a.is_dismissible,
  }));

  const now = new Date();

  const upcomingAssignments = (assignments ?? [])
    .filter((a) => new Date(a.due_date) >= now)
    .slice(0, 3);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (studentLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {student?.full_name?.split(" ")[0] ?? "Student"}.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{today}</p>
      </div>

      {alerts.length > 0 && <AlertBanner alerts={alerts} />}

      <div className="bg-background border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Upcoming assignments</h3>
          <Link
            to="/assignments"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>
        {upcomingAssignments.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No upcoming assignments.
          </p>
        ) : (
          <AssignmentTable
            assignments={upcomingAssignments}
            submissionMap={submissionMap}
            gradeMap={gradeMap}
            onSubmitSuccess={() => {}}
            onViewGrade={(assignmentName) => setGradeAssignment(assignmentName)}
          />
        )}
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