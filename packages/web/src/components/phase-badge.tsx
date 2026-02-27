import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RunPhase } from "@glop/shared";

const phaseConfig: Record<RunPhase, { label: string; className: string }> = {
  editing: {
    label: "Editing",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  validating: {
    label: "Validating",
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  waiting: {
    label: "Waiting",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
  done: {
    label: "Done",
    className: "bg-green-100 text-green-800 border-green-200",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-800 border-red-200",
  },
  unknown: {
    label: "Unknown",
    className: "bg-gray-100 text-gray-800 border-gray-200",
  },
};

export function PhaseBadge({ phase }: { phase: RunPhase }) {
  const config = phaseConfig[phase] || phaseConfig.unknown;
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
