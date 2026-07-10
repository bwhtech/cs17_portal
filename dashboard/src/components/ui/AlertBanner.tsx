import { useState } from "react";
import { AlertTriangle, Zap, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  name: string;
  title: string;
  content: string;
  variant?: "error" | "warning" | "info";
  is_dismissible?: boolean;
}

interface Props {
  alerts: Alert[];
}

export const alertStyles = {
  error: {
    wrapper: "bg-red-50 border border-red-100",
    iconBg: "bg-red-100",
    icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
    title: "text-red-700 font-semibold",
    body: "text-red-900/70",
    dismiss: "text-red-400 hover:text-red-700",
  },
  warning: {
    wrapper: "bg-yellow-50 border border-yellow-100",
    iconBg: "bg-yellow-100",
    icon: <Zap className="w-4 h-4 text-yellow-600" />,
    title: "text-yellow-800 font-semibold",
    body: "text-yellow-900/70",
    dismiss: "text-yellow-400 hover:text-yellow-700",
  },
  info: {
    wrapper: "bg-blue-50 border border-blue-100",
    iconBg: "bg-blue-100",
    icon: <Info className="w-4 h-4 text-blue-600" />,
    title: "text-blue-700 font-semibold",
    body: "text-blue-900/70",
    dismiss: "text-blue-400 hover:text-blue-700",
  },
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

export default function AlertBanner({ alerts }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);

  const visible = alerts.filter((a) => !dismissed.has(a.name));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((alert) => {
        const s = alertStyles[alert.variant ?? "info"];

        return (
          <div
            key={alert.name}
            className={cn(
              "flex items-start gap-4 rounded-xl px-5 py-4",
              s.wrapper
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                s.iconBg
              )}
            >
              {s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm", s.title)}>{alert.title}</p>
              {alert.content && (
                <p className={cn("text-xs mt-0.5", s.body)}>{alert.content}</p>
              )}
            </div>
            {alert.is_dismissible && (
              <button
                onClick={() =>
                  setDismissed((prev) => {
                    const next = new Set(prev).add(alert.name);
                    saveDismissed(next);
                    return next;
                  })
                }
                className={cn("shrink-0 transition-colors mt-0.5", s.dismiss)}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}