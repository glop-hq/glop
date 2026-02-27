"use client";

import { useState } from "react";
import type { Event } from "@glop/shared";
import { RelativeTime } from "./relative-time";
import { cn } from "@/lib/utils";
import {
  Play,
  Heart,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Tag,
  FileText,
  Package,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const eventConfig: Record<
  string,
  { icon: React.ReactNode; label: string; colorClass: string }
> = {
  "run.started": {
    icon: <Play className="h-3.5 w-3.5" />,
    label: "Run started",
    colorClass: "text-green-600 bg-green-50",
  },
  "run.heartbeat": {
    icon: <Heart className="h-3.5 w-3.5" />,
    label: "Activity",
    colorClass: "text-blue-600 bg-blue-50",
  },
  "run.phase_changed": {
    icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
    label: "Phase changed",
    colorClass: "text-purple-600 bg-purple-50",
  },
  "run.completed": {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "Completed",
    colorClass: "text-green-600 bg-green-50",
  },
  "run.failed": {
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: "Failed",
    colorClass: "text-red-600 bg-red-50",
  },
  "run.title_updated": {
    icon: <Tag className="h-3.5 w-3.5" />,
    label: "Title updated",
    colorClass: "text-gray-600 bg-gray-50",
  },
  "run.summary_updated": {
    icon: <FileText className="h-3.5 w-3.5" />,
    label: "Summary updated",
    colorClass: "text-gray-600 bg-gray-50",
  },
  "artifact.added": {
    icon: <Package className="h-3.5 w-3.5" />,
    label: "Artifact added",
    colorClass: "text-indigo-600 bg-indigo-50",
  },
  "artifact.updated": {
    icon: <Package className="h-3.5 w-3.5" />,
    label: "Artifact updated",
    colorClass: "text-indigo-600 bg-indigo-50",
  },
};

function EventItem({ event }: { event: Event }) {
  const [expanded, setExpanded] = useState(false);
  const config = eventConfig[event.event_type] || {
    icon: <Heart className="h-3.5 w-3.5" />,
    label: event.event_type,
    colorClass: "text-gray-600 bg-gray-50",
  };

  const payload = event.payload as Record<string, unknown>;
  const actionLabel = payload.action_label as string | undefined;
  const toolName = payload.tool_name as string | undefined;
  const raw = payload.raw as Record<string, unknown> | undefined;

  // Show the full payload (either raw hook data or the processed payload)
  const displayPayload = raw || payload;

  return (
    <div className="py-2.5">
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
            config.colorClass
          )}
        >
          {config.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{config.label}</span>
            {toolName && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {toolName}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              <RelativeTime date={event.occurred_at} />
            </span>
          </div>
          {actionLabel && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {actionLabel}
            </p>
          )}
        </div>
        <div className="mt-1 shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>
      </div>
      {expanded && (
        <div className="ml-10 mt-2 mb-1">
          <pre className="text-xs font-mono bg-muted/50 border rounded-md p-3 overflow-x-auto max-h-96 whitespace-pre-wrap break-all">
            {JSON.stringify(displayPayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function EventTimeline({ events }: { events: Event[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">No events recorded</p>
    );
  }

  return (
    <div className="divide-y">
      {events.map((event) => (
        <EventItem key={event.id} event={event} />
      ))}
    </div>
  );
}
