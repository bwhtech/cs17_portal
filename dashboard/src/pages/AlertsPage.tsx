import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import AlertCard from "@/components/ui/AlertCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function AlertsPage() {
  const { student, isLoading: studentLoading } = useCurrentStudent();

  const { data: announcements, isLoading } = useFrappeGetDocList(
    "CS17 Announcement",
    {
      filters: [
        ["is_published", "=", 1],
        ["cohort", "=", student?.cohort ?? ""],
      ],
      fields: ["name", "title", "content", "published_date"],
      orderBy: { field: "published_date", order: "desc" },
      limit: 50,
    },
    student?.cohort ? undefined : null
  );

  if (studentLoading || isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      {announcements?.length === 0 && (
        <p className="text-muted-foreground">No alerts right now.</p>
      )}
      {announcements?.map((a) => (
        <AlertCard key={a.name} announcement={a} />
      ))}
    </div>
  );
}