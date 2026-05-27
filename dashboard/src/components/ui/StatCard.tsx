import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: string | number;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon?: React.ReactNode;
}

export default function StatCard({
  label,
  value,
  sub,
  trend,
  trendLabel,
  icon,
}: Props) {
  return (
    <div className="bg-background border border-border rounded-xl p-5 flex flex-col gap-3">
      {/* Label */}
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon && <span className="w-4 h-4">{icon}</span>}
        <span className="text-[11px] font-semibold tracking-widest uppercase">
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight">{value}</span>
        {sub && (
          <span className="text-lg text-muted-foreground font-normal">
            {sub}
          </span>
        )}
      </div>

      {/* Trend */}
      {trendLabel && (
        <p
          className={cn(
            "text-xs font-medium",
            trend === "up" && "text-green-600",
            trend === "down" && "text-red-500",
            trend === "neutral" && "text-muted-foreground"
          )}
        >
          {trend === "up" && "↑ "}
          {trend === "down" && "↓ "}
          {trendLabel}
        </p>
      )}
    </div>
  );
}