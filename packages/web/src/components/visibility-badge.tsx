import { Lock, Users, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisibilityBadgeProps {
  visibility: "private" | "workspace";
  sharedLinkActive: boolean;
}

function Badge({
  icon: Icon,
  label,
  className,
}: {
  icon: typeof Lock;
  label: string;
  className: string;
}) {
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

export function VisibilityBadge({ visibility, sharedLinkActive }: VisibilityBadgeProps) {
  const isWorkspace = visibility === "workspace";

  if (!isWorkspace && !sharedLinkActive) {
    return <Badge icon={Lock} label="Private" className="bg-gray-100 text-gray-600" />;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {isWorkspace && (
        <Badge icon={Users} label="Team" className="bg-blue-50 text-blue-600" />
      )}
      {sharedLinkActive && (
        <Badge icon={Link2} label="Link" className="bg-green-50 text-green-600" />
      )}
    </span>
  );
}
