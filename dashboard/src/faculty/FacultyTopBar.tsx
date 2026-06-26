import { Bell, X } from "lucide-react";
import { useFrappeGetDocList } from "frappe-react-sdk";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useBreadcrumb } from "@/context/BreadcrumbContext";
import { useLocation, Link } from "react-router-dom";

const routeLabels: Record<string, string> = {
  "/faculty/": "Dashboard",
  "/faculty": "Dashboard",
  "/faculty/assignments": "Assignments",
  "/faculty/announcements": "Announcements",
  "/faculty/settings": "Settings",
};

const variantStyles: Record<string, string> = {
  error:
    "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
  warning:
    "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800",
  info: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800",
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

export default function FacultyTopBar() {
  const location = useLocation();
  const { items } = useBreadcrumb();
  const pageLabel = routeLabels[location.pathname] ?? "Dashboard";
  const [bellOpen, setBellOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  const bellRef = useRef<HTMLDivElement>(null);

  const { data: announcements } = useFrappeGetDocList("CS17 Announcement", {
    filters: [["is_published", "=", 1]],
    fields: ["name", "title", "content", "alert_variant", "is_dismissible"],
    limit: 50,
  });

  const visible = (announcements ?? []).filter((a) => !dismissed.has(a.name));
  const announcementCount = visible.length;

  function dismiss(name: string) {
    setDismissed((prev) => {
      const next = new Set(prev).add(name);
      saveDismissed(next);
      return next;
    });
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-12 border-b border-border bg-background flex items-center px-6 gap-4 sticky top-0 z-10">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-1">
        <Link to="/faculty/" className="hover:text-foreground transition-colors">
          Workspace
        </Link>
        {items.length > 0 ? (
          items.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span>/</span>
              {item.href ? (
                <Link to={item.href} className="hover:text-foreground transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium">{item.label}</span>
              )}
            </span>
          ))
        ) : (
          <>
            <span>/</span>
            <span className="text-foreground font-medium">{pageLabel}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={bellRef}>
          <button
            className="relative p-1.5 rounded-md hover:bg-accent transition-colors"
            onClick={() => setBellOpen((o) => !o)}
          >
            <Bell className="w-4 h-4" />
            {announcementCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {announcementCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div
              className="absolute right-0 top-10 w-80 border border-border rounded-lg shadow-lg z-50 overflow-hidden bg-popover"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold">Announcements</span>
                <button
                  onClick={() => setBellOpen(false)}
                  className="p-0.5 rounded hover:bg-accent"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 space-y-1.5">
                {visible.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No announcements
                  </p>
                ) : (
                  visible.map((announcement: any) => (
                    <div
                      key={announcement.name}
                      className={cn(
                        "px-3 py-2.5 rounded-md border text-sm flex items-start gap-2",
                        variantStyles[announcement.alert_variant ?? "info"],
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{announcement.title}</p>
                        {announcement.content && (
                          <p className="mt-0.5 text-xs opacity-80">
                            {announcement.content}
                          </p>
                        )}
                      </div>
                      {!!announcement.is_dismissible && (
                        <button
                          onClick={() => dismiss(announcement.name)}
                          className="shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
