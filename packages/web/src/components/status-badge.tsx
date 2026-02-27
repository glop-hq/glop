import { cn } from "@/lib/utils";
import type { RunStatus } from "@glop/shared";
import { CircleCheck, CircleX } from "lucide-react";

const statusConfig: Record<
  RunStatus,
  { label: string; dotClass: string; icon?: React.ReactNode }
> = {
  active: {
    label: "Active",
    dotClass: "bg-green-500",
  },
  blocked: {
    label: "Blocked",
    dotClass: "bg-amber-500",
  },
  stale: {
    label: "Stale",
    dotClass: "bg-gray-400",
  },
  completed: {
    label: "Completed",
    dotClass: "",
    icon: <CircleCheck className="h-3.5 w-3.5 text-green-600" />,
  },
  failed: {
    label: "Failed",
    dotClass: "",
    icon: <CircleX className="h-3.5 w-3.5 text-red-600" />,
  },
};

export function StatusBadge({ status }: { status: RunStatus }) {
  const config = statusConfig[status] || statusConfig.active;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      {config.icon ? (
        config.icon
      ) : (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            config.dotClass,
            status === "active" && "animate-pulse"
          )}
        />
      )}
      {config.label}
    </span>
  );
}
