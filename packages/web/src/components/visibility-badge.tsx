import { Lock, Users, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunVisibility } from "@glop/shared";

const config: Record<
  RunVisibility,
  { icon: typeof Lock; label: string; className: string }
> = {
  private: {
    icon: Lock,
    label: "Private",
    className: "bg-gray-100 text-gray-600",
  },
  workspace: {
    icon: Users,
    label: "Team",
    className: "bg-blue-50 text-blue-600",
  },
  shared_link: {
    icon: Link2,
    label: "Shared",
    className: "bg-green-50 text-green-600",
  },
};

export function VisibilityBadge({ visibility }: { visibility: RunVisibility }) {
  const { icon: Icon, label, className } = config[visibility];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
