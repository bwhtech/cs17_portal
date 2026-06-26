import { useFrappeGetCall, useFrappeGetDocCount } from "frappe-react-sdk";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { formatDateTime } from "@/lib/dayjs";

interface RecentSubmission {
  name: string;
  student: string;
  full_name: string;
  assignment: string;
  assignment_title: string;
  submitted_at: string;
}

export default function FacultyDashboardPage() {
  const { profile, isLoading: facultyLoading } = useCurrentProfile();

  const { data: recentSubmissions, isLoading: submissionsLoading } =
    useFrappeGetCall<{ message: RecentSubmission[] }>(
      "cs17_portal.api.get_faculty_recent_submissions",
      { limit: 5 },
    );

  const { data: publishedCount } = useFrappeGetDocCount(
    "CS17 Assignment",
    [["is_published", "=", 1]],
  );

  const { data: totalSubmissions } = useFrappeGetDocCount(
    "CS17 Assignment Submission",
  );

  const { data: gradedCount } = useFrappeGetDocCount(
    "CS17 Assignment Grade",
    [["submission", "!=", ""]],
  );

  const pendingCount =
    totalSubmissions != null && gradedCount != null
      ? Math.max(0, totalSubmissions - gradedCount)
      : null;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const submissions: RecentSubmission[] = recentSubmissions?.message ?? [];

  if (facultyLoading) {
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
          Welcome back, {profile?.full_name?.split(" ")[0] ?? "Faculty"}.
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{today}</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <StatChip
          label="Published Assignments"
          value={publishedCount ?? null}
        />
        <StatChip
          label="Pending Submissions"
          value={pendingCount}
        />
      </div>

      <div className="bg-background border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Latest submissions</h3>
          <Link
            to="/faculty/assignments"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>

        {submissionsLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No submissions yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {submissions.map((sub) => (
              <div
                key={sub.name}
                className="py-3 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{sub.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {sub.assignment_title}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground shrink-0">
                  {sub.submitted_at ? formatDateTime(sub.submitted_at) : "—"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-background border border-border rounded-xl px-5 py-4 min-w-[160px]">
      {value === null ? (
        <Skeleton className="h-8 w-12 mb-1" />
      ) : (
        <p className="text-2xl font-bold">{value}</p>
      )}
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
