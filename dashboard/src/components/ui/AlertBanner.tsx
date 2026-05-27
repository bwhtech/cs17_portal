import { useState } from "react";
import { AlertTriangle, Zap, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  name: string;
  title: string;
  content: string;
  type?: "error" | "warning" | "info";
}

interface Props {
  alerts: Alert[];
}

const styles = {
  error: {
    wrapper: "bg-red-50 border-red-200 text-red-900",
    icon: <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />,
    button: "border-red-400 text-red-700 hover:bg-red-100",
  },
  warning: {
    wrapper: "bg-yellow-50 border-yellow-200 text-yellow-900",
    icon: <Zap className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />,
    button: "border-yellow-400 text-yellow-700 hover:bg-yellow-100",
  },
  info: {
    wrapper: "bg-blue-50 border-blue-200 text-blue-900",
    icon: <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />,
    button: "border-blue-400 text-blue-700 hover:bg-blue-100",
  },
};

export default function AlertBanner({ alerts }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.name));

  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {visible.map((alert) => {
        const type = alert.type ?? "info";
        const s = styles[type];

        return (
          <div
            key={alert.name}
            className={cn(
              "flex items-start gap-3 border rounded-lg px-4 py-3",
              s.wrapper
            )}
          >
            {s.icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{alert.title}</p>
              <p className="text-xs mt-0.5 opacity-80">{alert.content}</p>
            </div>
            <button
              className={cn(
                "shrink-0 text-xs border rounded px-3 py-1 font-medium transition-colors",
                s.button
              )}
            >
              View
            </button>
            <button
              onClick={() =>
                setDismissed((prev) => new Set(prev).add(alert.name))
              }
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}