import { Lock, Users, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

import type { RunVisibility } from "@glop/shared";

interface VisibilityBadgeProps {
  visibility: RunVisibility;
  sharedLinkActive?: boolean;
  iconOnly?: boolean;
}

function Badge({
  icon: Icon,
  label,
  className,
  iconOnly,
}: {
  icon: typeof Lock;
  label: string;
  className: string;
  iconOnly?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full text-xs font-medium",
        iconOnly ? "p-1" : "px-2 py-0.5",
        className
      )}
      title={iconOnly ? label : undefined}
    >
      <Icon className="h-3 w-3" />
      {!iconOnly && label}
    </span>
  );
}

export function VisibilityBadge({ visibility, sharedLinkActive, iconOnly }: VisibilityBadgeProps) {
  const isWorkspace = visibility === "workspace";
  const hasLink = sharedLinkActive ?? false;

  if (!isWorkspace && !hasLink) {
    return <Badge icon={Lock} label="Private" className="bg-gray-100 text-gray-600" iconOnly={iconOnly} />;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {isWorkspace && (
        <Badge icon={Users} label="Team" className="bg-blue-50 text-blue-600" iconOnly={iconOnly} />
      )}
      {!isWorkspace && hasLink && (
        <Badge icon={Lock} label="Private" className="bg-gray-100 text-gray-600" iconOnly={iconOnly} />
      )}
      {hasLink && (
        <Badge icon={Link2} label="Link" className="bg-green-50 text-green-600" iconOnly={iconOnly} />
      )}
    </span>
  );
}
