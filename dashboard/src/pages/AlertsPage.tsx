import { useState } from "react";
import { useFrappeGetDocList } from "frappe-react-sdk";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const variantBar: Record<string, string> = {
  error: "bg-red-500",
  warning: "bg-yellow-400",
  info: "bg-blue-500",
};

function loadDismissed(): Set<string> {
  try {
    const stored = localStorage.getItem("dismissed-alerts");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem("dismissed-alerts", JSON.stringify([...set]));
  } catch {}
}

export default function AlertsPage() {
  const { student, isLoading: studentLoading } = useCurrentStudent();
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);

  const { data: announcements, isLoading } = useFrappeGetDocList(
    "CS17 Announcement",
    {
      filters: [
        ["is_published", "=", 1],
        ["cohort", "=", student?.cohort ?? ""],
      ],
      fields: ["name", "title", "content", "alert_variant", "published_date"],
      orderBy: { field: "published_date", order: "desc" },
      limit: 50,
    },
    student?.cohort ? undefined : null,
  );

  function dismiss(name: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(name);
      saveDismissed(next);
      return next;
    });
  }

  if (studentLoading || isLoading) {
    return (
      <div className="space-y-2 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!announcements || announcements.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">No announcements.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="border border-border rounded-xl overflow-hidden">
        {announcements.map((a, i) => {
          const variant = a.alert_variant ?? "info";
          const isDismissed = dismissed.has(a.name);

          return (
            <div
              key={a.name}
              className={cn(
                "flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0",
              )}
            >
              {/* Variant indicator */}
              <div
                className={cn(
                  "w-1 h-8 rounded-full shrink-0",
                  variantBar[variant],
                )}
              />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",)}
                >
                  {a.title}
                </p>
                {a.content && (
                  <p className="text-xs text-muted-foreground truncate">
                    {a.content}
                  </p>
                )}
              </div>

              {/* Date */}
              <p className="text-xs text-muted-foreground shrink-0">
                {new Date(a.published_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>

              {/* Dismiss */}
              {isDismissed ? (
                <span className="text-xs text-muted-foreground shrink-0">
                  Dismissed
                </span>
              ) : (
                <button
                  onClick={() => dismiss(a.name)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
