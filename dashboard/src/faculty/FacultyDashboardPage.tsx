import { useFrappeGetCall, useFrappeGetDocCount } from "frappe-react-sdk";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

interface AssignedSubmission {
  name: string;
  full_name: string;
  assignment: string;
  assignment_title: string;
  grade?: { is_published?: number } | null;
}

export default function FacultyDashboardPage() {
  const { profile } = useCurrentProfile();

  const { data: assignedSubmissions, isLoading: assignedLoading } =
    useFrappeGetCall<{ message: AssignedSubmission[] }>(
      "cs17_portal.api.get_assigned_submissions",
      { limit: 5 },
    );

  const { data: publishedCount } = useFrappeGetDocCount(
    "CS17 Assignment",
    [["is_published", "=", 1]],
  );

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const assigned: AssignedSubmission[] = assignedSubmissions?.message ?? [];

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
      </div>

      <div className="bg-background border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold">Assigned to you</h3>

        {assignedLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : assigned.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No submissions assigned to you yet.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {assigned.map((sub) => (
              <Link
                key={sub.name}
                to={`/faculty/assignments/${sub.assignment}`}
                className="py-3 flex items-center justify-between gap-4 hover:bg-muted/50 -mx-2 px-2 rounded-md transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{sub.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {sub.assignment_title}
                  </p>
                </div>
                <span className="text-xs shrink-0">
                  {sub.grade ? (
                    <span className="text-muted-foreground">Graded</span>
                  ) : (
                    <span className="text-foreground font-medium">Needs grading</span>
                  )}
                </span>
              </Link>
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
