import { Bell, Search, Sun, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { useFrappeGetDocList } from "frappe-react-sdk";
import { useState, useRef, useEffect } from "react";

const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/assignments": "Assignments",
  "/marks": "Marks",
  "/schedule": "Schedule",
  "/courses": "Courses",
  "/cohort": "Cohort",
  "/resources": "Resources",
  "/settings": "Settings",
  "/help": "Help & Support",
};

export default function TopBar() {
  const location = useLocation();
  const { student } = useCurrentStudent();
  const pageLabel = routeLabels[location.pathname] ?? "Dashboard";
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const { data: alerts } = useFrappeGetDocList("CS17 Announcement", {
    filters: [
      ["is_published", "=", 1],
      ["cohort", "=", student?.cohort ?? ""],
    ],
    fields: ["name", "title", "content", "creation"],
    limit: 50,
  }, student?.cohort ? undefined : null);

  const alertCount = alerts?.length ?? 0;

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
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-1">
        <span>Workspace</span>
        <span>/</span>
        <span className="text-foreground font-medium">{pageLabel}</span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-muted rounded-md px-3 py-1.5 text-sm text-muted-foreground w-64">
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span>Search lessons, classmates, files...</span>
        <kbd className="ml-auto text-[10px] bg-background border border-border rounded px-1">⌘K</kbd>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        {/* Bell with dropdown */}
        <div className="relative" ref={bellRef}>
          <button
            className="relative p-1.5 rounded-md hover:bg-accent transition-colors"
            onClick={() => setBellOpen((o) => !o)}
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {alertCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="absolute right-0 top-10 w-80 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold">Alerts</span>
                <button onClick={() => setBellOpen(false)} className="p-0.5 rounded hover:bg-accent">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {alertCount === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No alerts</p>
                ) : (
                  alerts?.map((alert: any) => (
                    <div
                      key={alert.name}
                      className="mx-3 my-2 px-3 py-2.5 rounded-md border text-sm bg-blue-50 text-blue-700 border-blue-200"
                    >
                      <p className="font-semibold">{alert.title}</p>
                      {alert.content && (
                        <p className="mt-0.5 text-xs opacity-80">{alert.content}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button className="p-1.5 rounded-md hover:bg-accent transition-colors">
          <Sun className="w-4 h-4" />
        </button>

        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
          {student?.full_name?.[0] ?? "?"}
        </div>
      </div>
    </header>
  );
}