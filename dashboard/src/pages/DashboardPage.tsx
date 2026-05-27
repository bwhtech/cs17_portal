import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import AlertBanner from "@/components/ui/AlertBanner";
import StatCard from "@/components/ui/StatCard";
import AnnouncementFeed from "@/components/ui/AnnouncementFeed";
import AssignmentCard from "@/components/ui/AssignmentCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, BarChart2, Clock, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  const { student, isLoading: studentLoading } = useCurrentStudent();

  const { data: announcements } = useFrappeGetDocList(
    "CS17 Announcement",
    {
      filters: [
        ["is_published", "=", 1],
        ["cohort", "=", student?.cohort ?? ""],
      ],
      fields: ["name", "title", "content", "published_date"],
      orderBy: { field: "published_date", order: "desc" },
      limit: 10,
    },
    student?.cohort ? undefined : null
  );

  const { data: assignments } = useFrappeGetDocList(
    "CS17 Assignment",
    {
      filters: [["cohort", "=", student?.cohort ?? ""]],
      fields: ["name", "title", "due_date", "max_marks"],
      orderBy: { field: "due_date", order: "asc" },
      limit: 10,
    },
    student?.cohort ? undefined : null
  );

  const { data: submissions } = useFrappeGetDocList(
    "CS17 Assignment Submission",
    {
      filters: [["student", "=", student?.name ?? ""]],
      fields: ["name", "assignment", "submitted_at"],
      limit: 100,
    },
    student?.name ? undefined : null
  );

  const submissionMap = Object.fromEntries(
    (submissions ?? []).map((s) => [s.assignment, s])
  );

  const pendingCount = (assignments ?? []).filter(
    (a) => !submissionMap[a.name]
  ).length;

  const upcomingAssignments = (assignments ?? []).slice(0, 3);

  // Map announcements to alert banners
  const alerts = (announcements ?? []).slice(0, 3).map((a) => ({
    name: a.name,
    title: a.title,
    content: a.content,
    type: "info" as const,
  }));

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  if (studentLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Inline alert banners */}
      <AlertBanner alerts={alerts} />

      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back, {student?.full_name?.split(" ")[0] ?? "Student"}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{today}</p>
        </div>
        <Link
          to="/assignments"
          className="bg-foreground text-background text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
        >
          Submit work →
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Courses"
          value="4"
          sub="/ 6"
          icon={<BookOpen className="w-4 h-4" />}
          trend="up"
          trendLabel="+1 vs last week"
        />
        <StatCard
          label="Pending Assignments"
          value={pendingCount}
          icon={<ClipboardList className="w-4 h-4" />}
          trend="neutral"
          trendLabel="—"
        />
        <StatCard
          label="Average Marks"
          value="87"
          sub="%"
          icon={<BarChart2 className="w-4 h-4" />}
          trend="up"
          trendLabel="+4% vs last month"
        />
        <StatCard
          label="Attendance"
          value="96"
          sub="%"
          icon={<Clock className="w-4 h-4" />}
          trend="neutral"
          trendLabel="— stable"
        />
      </div>

      {/* Bottom two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming assignments */}
        <div className="bg-background border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Upcoming assignments</h3>
              <p className="text-xs text-muted-foreground">
                {pendingCount} pending
              </p>
            </div>
            <Link
              to="/assignments"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {upcomingAssignments.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No upcoming assignments.
              </p>
            )}
            {upcomingAssignments.map((a) => (
              <AssignmentCard
                key={a.name}
                assignment={a}
                submission={submissionMap[a.name] ?? null}
              />
            ))}
          </div>
        </div>

        {/* Announcements feed */}
        <AnnouncementFeed />
      </div>
    </div>
  );
}