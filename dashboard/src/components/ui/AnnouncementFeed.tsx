import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { Skeleton } from "@/components/ui/skeleton";

interface Announcement {
  name: string;
  title: string;
  content: string;
  published_date: string;
  owner: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AnnouncementFeed() {
  const { student } = useCurrentStudent();

  const { data: announcements, isLoading } = useFrappeGetDocList<Announcement>(
    "CS17 Announcement",
    {
      filters: [
        ["is_published", "=", 1],
        ["cohort", "=", student?.cohort ?? ""],
      ],
      fields: ["name", "title", "content", "published_date", "owner"],
      orderBy: { field: "published_date", order: "desc" },
      limit: 10,
    },
    student?.cohort ? undefined : null
  );

  return (
    <div className="bg-background border border-border rounded-xl p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Announcements</h3>
          <p className="text-xs text-muted-foreground">
            Faculty · admin · cohort
          </p>
        </div>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          All →
        </button>
      </div>

      {/* Feed */}
      <div className="space-y-5 divide-y divide-border">
        {isLoading && (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full pt-5" />
          </>
        )}

        {!isLoading && announcements?.length === 0 && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            No announcements yet.
          </p>
        )}

        {announcements?.map((a) => (
          <div key={a.name} className="pt-4 first:pt-0">
            {/* Author row */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                {getInitials(a.owner)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold">{a.owner}</span>
                  <span className="text-[10px] text-muted-foreground">
                    · {timeAgo(a.published_date)}
                  </span>
                </div>
              </div>
            </div>

            {/* Content */}
            <p className="text-sm font-semibold">{a.title}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
              {a.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}