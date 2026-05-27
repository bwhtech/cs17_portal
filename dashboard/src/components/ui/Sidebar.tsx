import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  BarChart2,
  CalendarDays,
  BookOpen,
  Users,
  FolderOpen,
  Settings,
  HelpCircle,
} from "lucide-react";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { cn } from "@/lib/utils";

const navSections = [
  {
    label: "WORKSPACE",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", to: "/" },
      { icon: ClipboardList, label: "Assignments", to: "/assignments" },
      { icon: BarChart2, label: "Results", to: "/marks" },
      { icon: CalendarDays, label: "Schedule", to: "/schedule" },
    ],
  },
  {
    label: "LEARNING",
    items: [
      { icon: BookOpen, label: "Courses", to: "/courses" },
      { icon: Users, label: "Cohort", to: "/cohort" },
      { icon: FolderOpen, label: "Resources", to: "/resources" },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { icon: Settings, label: "Settings", to: "/settings" },
      { icon: HelpCircle, label: "Help & support", to: "/help" },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { student } = useCurrentStudent();

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-background flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="px-5 py-4 flex items-baseline gap-2 border-b border-border">
        <span className="text-lg font-bold tracking-tight">cs17</span>
        <span className="text-xs text-muted-foreground">portal</span>
      </div>

      {/* Student profile */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
            {student?.full_name?.[0] ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {student?.full_name ?? "Loading..."}
            </p>
            <p className="text-xs text-muted-foreground">
              cohort '{student?.cohort ?? "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="text-[10px] font-semibold text-muted-foreground tracking-widest px-2 mb-2">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 px-2 py-1.5 rounded-md text-sm transition-colors",
                        active
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
