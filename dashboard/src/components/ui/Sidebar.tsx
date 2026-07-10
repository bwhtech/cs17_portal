import { type ElementType } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ClipboardList,
  Blocks,
  BookOpen,
  GraduationCap,
  Inbox,
  Settings,
  Bell,
  ExternalLink,
  MessageSquare,
} from "lucide-react";
import { useCurrentStudent } from "@/hooks/useCurrentStudent";
import { cn } from "@/lib/utils";
import SidebarShell from "@/components/ui/SidebarShell";
import logoUrl from "@/assets/CS17.svg";

type InternalItem = { icon: ElementType; label: string; to: string };
type ExternalItem = { icon: ElementType; label: string; href: string };
type NavItem = InternalItem | ExternalItem;

function isExternal(item: NavItem): item is ExternalItem {
  return "href" in item;
}

const navSections = [
  {
    label: "WORKSPACE",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", to: "/" },
      { icon: ClipboardList, label: "Assignments", to: "/assignments" },
      { icon: Blocks, label: "Projects", to: "/projects" },
    ] as NavItem[],
  },
  {
    label: "LEARNING",
    items: [
      { icon: BookOpen, label: "Handbook", href: "/student-handbook" },
      { icon: GraduationCap, label: "Courses", href: "/lms/courses" },
    ] as NavItem[],
  },
  {
    label: "ACCOUNT",
    items: [
      {
        icon: MessageSquare,
        label: "Open Chat",
        href: "https://portal.cs17.org/raven/CS17",
      },
      { icon: Inbox, label: "Open Inbox", href: "https://inbox.cs17.org" },
      { icon: Settings, label: "Settings", to: "/settings" },
    ] as NavItem[],
  },
];

type SidebarProps = {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
};

export default function Sidebar({ mobileOpen, onMobileOpenChange }: SidebarProps) {
  const location = useLocation();
  const { student } = useCurrentStudent();

  return (
    <SidebarShell mobileOpen={mobileOpen} onMobileOpenChange={onMobileOpenChange}>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <img src={logoUrl} alt="CS17" className="h-5" />
        <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full leading-none">
          Beta
        </span>
      </div>

      {/* Student profile */}
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          {student?.profile_picture ? (
            <img
              src={student.profile_picture}
              alt={student.full_name}
              className="w-9 h-9 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
              {student?.full_name?.[0] ?? "?"}
            </div>
          )}
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
                const Icon = item.icon;
                const key = isExternal(item) ? item.href : item.to;
                const active =
                  !isExternal(item) && location.pathname === item.to;
                const className = cn(
                  "flex items-center gap-3 px-2 py-1.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                );

                if (isExternal(item)) {
                  return (
                    <li key={key}>
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={className}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                        <ExternalLink className="w-3 h-3 ml-auto shrink-0 opacity-50" />
                      </a>
                    </li>
                  );
                }

                return (
                  <li key={key}>
                    <Link to={item.to} className={className}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Announcements — standalone below sections */}
        <div className="border-t border-border pt-4">
          <ul>
            <li>
              <Link
                to="/announcements"
                className={cn(
                  "flex items-center gap-3 px-2 py-1.5 rounded-md text-sm transition-colors",
                  location.pathname === "/announcements"
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Bell className="w-4 h-4 shrink-0" />
                Announcements
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </SidebarShell>
  );
}
