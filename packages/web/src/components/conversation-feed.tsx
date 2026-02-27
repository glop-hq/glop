"use client";

import { useState, useEffect, useRef } from "react";
import type { Event } from "@glop/shared";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RelativeTime } from "./relative-time";
import { cn } from "@/lib/utils";
import {
  User,
  Bot,
  FileEdit,
  FileSearch,
  Terminal,
  GitBranch,
  FlaskConical,
  Hammer,
  Search,
  Cog,
  Play,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Globe,
  MessageCircleQuestion,
  ListChecks,
  Map as MapIcon,
  Zap,
  PackagePlus,
  Container,
  Rocket,
  SpellCheck,
  NotebookPen,
  ShieldCheck,
} from "lucide-react";

interface FeedEvent {
  id: string;
  type: "prompt" | "response" | "tool_use" | "permission_request" | "started" | "completed" | "failed" | "heartbeat";
  timestamp: string;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResponse?: string;
  actionLabel?: string;
  activityKind?: string;
}

function parseFeedEvent(event: Event): FeedEvent {
  const payload = event.payload as Record<string, unknown>;
  const contentType = payload.content_type as string | undefined;

  let type: FeedEvent["type"];
  switch (event.event_type) {
    case "run.prompt":
      type = "prompt";
      break;
    case "run.response":
      type = "response";
      break;
    case "run.tool_use":
      type = "tool_use";
      break;
    case "run.permission_request":
      type = "permission_request";
      break;
    case "run.started":
      type = "started";
      break;
    case "run.completed":
      type = "completed";
      break;
    case "run.failed":
      type = "failed";
      break;
    default:
      // Legacy heartbeat events — try to infer from content_type
      if (contentType === "prompt") type = "prompt";
      else if (contentType === "response") type = "response";
      else if (contentType === "tool_use") type = "tool_use";
      else if (contentType === "permission_request") type = "permission_request";
      else type = "heartbeat";
  }

  return {
    id: event.id,
    type,
    timestamp: event.occurred_at,
    content: payload.content as string | undefined,
    toolName: payload.tool_name as string | undefined,
    toolInput: payload.tool_input as Record<string, unknown> | undefined,
    toolResponse: typeof payload.tool_response === "string"
      ? payload.tool_response
      : payload.tool_response
        ? JSON.stringify(payload.tool_response)
        : undefined,
    actionLabel: payload.action_label as string | undefined,
    activityKind: payload.activity_kind as string | undefined,
  };
}

function getToolIcon(toolName: string | undefined, activityKind: string | undefined) {
  if (toolName === "Edit" || toolName === "Write") {
    return <FileEdit className="h-3.5 w-3.5" />;
  }
  if (toolName === "NotebookEdit") {
    return <NotebookPen className="h-3.5 w-3.5" />;
  }
  if (toolName === "Read") {
    return <FileSearch className="h-3.5 w-3.5" />;
  }
  if (toolName === "Glob" || toolName === "Grep") {
    return <Search className="h-3.5 w-3.5" />;
  }
  if (toolName === "Bash") {
    if (activityKind === "test_run") return <FlaskConical className="h-3.5 w-3.5" />;
    if (activityKind === "build_run") return <Hammer className="h-3.5 w-3.5" />;
    if (activityKind === "git_action") return <GitBranch className="h-3.5 w-3.5" />;
    if (activityKind === "check_run") return <SpellCheck className="h-3.5 w-3.5" />;
    if (activityKind === "install_deps") return <PackagePlus className="h-3.5 w-3.5" />;
    if (activityKind === "docker_action") return <Container className="h-3.5 w-3.5" />;
    if (activityKind === "deploy_action") return <Rocket className="h-3.5 w-3.5" />;
    return <Terminal className="h-3.5 w-3.5" />;
  }
  if (toolName === "Task") {
    return <Cog className="h-3.5 w-3.5" />;
  }
  if (toolName === "WebFetch") {
    return <Globe className="h-3.5 w-3.5" />;
  }
  if (toolName === "WebSearch") {
    return <Globe className="h-3.5 w-3.5" />;
  }
  if (toolName === "AskUserQuestion") {
    return <MessageCircleQuestion className="h-3.5 w-3.5" />;
  }
  if (toolName === "TodoRead" || toolName === "TodoWrite" ||
      toolName === "TaskCreate" || toolName === "TaskUpdate" ||
      toolName === "TaskList" || toolName === "TaskGet") {
    return <ListChecks className="h-3.5 w-3.5" />;
  }
  if (toolName === "EnterPlanMode" || toolName === "ExitPlanMode") {
    return <MapIcon className="h-3.5 w-3.5" />;
  }
  if (toolName === "Skill") {
    return <Zap className="h-3.5 w-3.5" />;
  }
  return <Cog className="h-3.5 w-3.5" />;
}

function extractFileShort(path: string): string {
  const parts = path.split("/");
  return parts.slice(-2).join("/");
}

function buildApprovalMap(events: FeedEvent[]): { approvedPermissions: Set<string>; approvedToolUses: Set<string> } {
  const approvedPermissions = new Set<string>();
  const approvedToolUses = new Set<string>();
  // Map from tool_name to the most recent unmatched permission request event ID
  const pending: Map<string, string> = new Map();

  for (const event of events) {
    if (event.type === "permission_request" && event.toolName) {
      pending.set(event.toolName, event.id);
    } else if (event.type === "tool_use" && event.toolName) {
      const permId = pending.get(event.toolName);
      if (permId) {
        approvedPermissions.add(permId);
        approvedToolUses.add(event.id);
        pending.delete(event.toolName);
      }
    }
  }

  return { approvedPermissions, approvedToolUses };
}

function PromptBubble({ event, developerName }: { event: FeedEvent; developerName?: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
        <User className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-blue-700">{developerName || "Developer"}</span>
          <span className="text-xs text-muted-foreground">
            <RelativeTime date={event.timestamp} />
          </span>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-lg rounded-tl-none px-4 py-3 prose prose-sm max-w-none prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-code:text-blue-800 prose-table:text-sm">
          <Markdown remarkPlugins={[remarkGfm]}>{event.content || "..."}</Markdown>
        </div>
      </div>
    </div>
  );
}

function ResponseBubble({ event }: { event: FeedEvent }) {
  const content = event.content || "";
  // Truncate very long responses for the feed view
  const truncated = content.length > 2000;
  const displayContent = truncated ? content.slice(0, 2000) : content;

  return (
    <div className="flex gap-3 items-start">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-amber-700">Claude</span>
          <span className="text-xs text-muted-foreground">
            <RelativeTime date={event.timestamp} />
          </span>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg rounded-tl-none px-4 py-3 prose prose-sm max-w-none prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-code:text-amber-800 prose-table:text-sm">
          <Markdown remarkPlugins={[remarkGfm]}>{displayContent}</Markdown>
          {truncated && (
            <span className="text-xs text-muted-foreground"> ... (truncated)</span>
          )}
        </div>
      </div>
    </div>
  );
}

function getToolSummary(toolName: string, toolInput: Record<string, unknown>, actionLabel?: string): string {
  if (toolName === "Edit" || toolName === "Write" || toolName === "NotebookEdit") {
    const filePath = toolInput.file_path as string | undefined;
    return filePath ? extractFileShort(filePath) : actionLabel || "file";
  }
  if (toolName === "Read") {
    const filePath = toolInput.file_path as string | undefined;
    return filePath ? extractFileShort(filePath) : "file";
  }
  if (toolName === "Glob") {
    return (toolInput.pattern as string) || "files";
  }
  if (toolName === "Grep") {
    return (toolInput.pattern as string) || "search";
  }
  if (toolName === "Bash") {
    const cmd = (toolInput.command as string) || "";
    // Show first line, truncated
    const firstLine = cmd.split("\n")[0];
    return firstLine.length > 60 ? firstLine.slice(0, 60) + "..." : firstLine;
  }
  if (toolName === "Task") {
    return (toolInput.description as string) || "subagent";
  }
  if (toolName === "WebFetch") {
    const url = (toolInput.url as string) || "";
    try {
      return new URL(url).hostname;
    } catch {
      return url.slice(0, 60) || "URL";
    }
  }
  if (toolName === "WebSearch") {
    return (toolInput.query as string) || "web search";
  }
  if (toolName === "AskUserQuestion") {
    const questions = toolInput.questions as Array<{ question?: string }> | undefined;
    return questions?.[0]?.question?.slice(0, 60) || "asking question";
  }
  if (toolName === "TodoRead" || toolName === "TodoWrite" ||
      toolName === "TaskCreate" || toolName === "TaskUpdate" ||
      toolName === "TaskList" || toolName === "TaskGet") {
    const subject = (toolInput.subject as string) || "";
    return subject ? subject.slice(0, 60) : toolName;
  }
  if (toolName === "EnterPlanMode") {
    return "entering plan mode";
  }
  if (toolName === "ExitPlanMode") {
    return "exiting plan mode";
  }
  if (toolName === "Skill") {
    return (toolInput.skill as string) || "skill";
  }
  return actionLabel || toolName;
}

function ToolDetail({ toolName, toolInput, toolResponse }: {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResponse?: string;
}) {
  if (toolName === "Edit" || toolName === "Write" || toolName === "NotebookEdit") {
    const filePath = toolInput.file_path as string | undefined;
    const oldStr = toolInput.old_string as string | undefined;
    const newStr = toolInput.new_string as string | undefined;
    const content = toolInput.content as string | undefined;
    return (
      <div className="space-y-1.5">
        {filePath && (
          <span className="text-xs font-mono text-muted-foreground">
            {filePath}
          </span>
        )}
        {oldStr && newStr && (
          <div className="text-xs font-mono mt-1 space-y-1">
            <div className="bg-red-50 text-red-800 border border-red-100 rounded px-2 py-1 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              - {oldStr.slice(0, 500)}{oldStr.length > 500 ? "..." : ""}
            </div>
            <div className="bg-green-50 text-green-800 border border-green-100 rounded px-2 py-1 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              + {newStr.slice(0, 500)}{newStr.length > 500 ? "..." : ""}
            </div>
          </div>
        )}
        {content && !oldStr && (
          <div className="text-xs font-mono bg-green-50 text-green-800 border border-green-100 rounded px-2 py-1 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {content.slice(0, 500)}{content.length > 500 ? "..." : ""}
          </div>
        )}
      </div>
    );
  }

  if (toolName === "Bash") {
    const command = toolInput.command as string | undefined;
    return (
      <div className="space-y-1.5">
        {command && (
          <div className="text-xs font-mono bg-zinc-900 text-green-400 rounded px-3 py-2 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            $ {command}
          </div>
        )}
        {toolResponse && (
          <div className="text-xs font-mono bg-zinc-800 text-zinc-300 rounded px-3 py-2 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {toolResponse.slice(0, 2000)}{toolResponse.length > 2000 ? "..." : ""}
          </div>
        )}
      </div>
    );
  }

  if (toolName === "Read" || toolName === "Glob" || toolName === "Grep") {
    const target = (toolInput.file_path || toolInput.path || toolInput.pattern) as string | undefined;
    return (
      <div className="space-y-1.5">
        {target && <span className="text-xs font-mono text-muted-foreground">{target}</span>}
        {toolResponse && (
          <div className="text-xs font-mono bg-zinc-50 text-zinc-700 border rounded px-3 py-2 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
            {toolResponse.slice(0, 2000)}{toolResponse.length > 2000 ? "..." : ""}
          </div>
        )}
      </div>
    );
  }

  // Generic fallback
  return toolResponse ? (
    <div className="text-xs font-mono bg-zinc-50 text-zinc-700 border rounded px-3 py-2 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
      {toolResponse.slice(0, 2000)}{toolResponse.length > 2000 ? "..." : ""}
    </div>
  ) : null;
}

function ToolUseBubble({ event, wasApproved }: { event: FeedEvent; wasApproved?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const toolName = event.toolName || "Unknown";
  const toolInput = event.toolInput || {};
  const icon = getToolIcon(event.toolName, event.activityKind);
  const summary = getToolSummary(toolName, toolInput, event.actionLabel);

  return (
    <div className="ml-6">
      <div
        className="flex gap-2 items-center cursor-pointer hover:bg-zinc-50 rounded-md px-2 py-1.5 -mx-2 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded",
          "bg-zinc-100 text-zinc-500"
        )}>
          {icon}
        </div>
        <span className="text-xs font-mono font-medium text-zinc-500">{toolName}</span>
        <span className="text-xs text-muted-foreground truncate">{summary}</span>
        {wasApproved && (
          <span className="flex items-center gap-0.5 text-xs text-green-600 shrink-0">
            <ShieldCheck className="h-3 w-3" />
            <span>Approved</span>
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          <RelativeTime date={event.timestamp} />
        </span>
        <ChevronRight className={cn(
          "h-3 w-3 text-muted-foreground shrink-0 transition-transform",
          expanded && "rotate-90"
        )} />
      </div>
      {expanded && (
        <div className="ml-7 mt-1 mb-2">
          <ToolDetail
            toolName={toolName}
            toolInput={toolInput}
            toolResponse={event.toolResponse}
          />
        </div>
      )}
    </div>
  );
}

function SessionEvent({ event }: { event: FeedEvent }) {
  const isStart = event.type === "started";
  const isFailed = event.type === "failed";

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1 h-px bg-border" />
      <div className={cn(
        "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs",
        isStart && "bg-green-50 text-green-700",
        event.type === "completed" && "bg-green-50 text-green-700",
        isFailed && "bg-red-50 text-red-700",
      )}>
        {isStart && <Play className="h-3 w-3" />}
        {event.type === "completed" && <CheckCircle2 className="h-3 w-3" />}
        {isFailed && <XCircle className="h-3 w-3" />}
        <span>
          {isStart ? "Session started" : isFailed ? "Session failed" : "Session completed"}
        </span>
        <span className="text-muted-foreground">
          <RelativeTime date={event.timestamp} />
        </span>
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function PermissionRequestBubble({ event }: { event: FeedEvent }) {
  const toolName = event.toolName || event.content || "Unknown";
  const toolInput = event.toolInput || {};
  const icon = getToolIcon(toolName, event.activityKind);
  const command = typeof toolInput.command === "string" ? toolInput.command : undefined;
  const description = typeof toolInput.description === "string" ? toolInput.description : undefined;
  const filePath = typeof toolInput.file_path === "string" ? toolInput.file_path : undefined;

  return (
    <div className="ml-6">
      <div className="flex gap-2 items-start rounded-md border border-orange-200 bg-orange-50 px-3 py-2.5">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-orange-100 text-orange-600 mt-0.5">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium text-orange-700">{toolName}</span>
            <span className="text-xs font-medium text-orange-600">Waiting for approval</span>
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
              <RelativeTime date={event.timestamp} />
            </span>
          </div>
          {toolName === "Bash" && command && (
            <div className="mt-1.5 text-xs font-mono bg-zinc-900 text-green-400 rounded px-3 py-2 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
              $ {command}
            </div>
          )}
          {toolName === "Bash" && description && (
            <p className="mt-1 text-xs text-orange-700">{description}</p>
          )}
          {toolName !== "Bash" && filePath && (
            <p className="mt-1 text-xs font-mono text-muted-foreground">{filePath}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveIndicator({ lastEvent, developerName }: { lastEvent: FeedEvent; developerName?: string }) {
  if (lastEvent.type === "response") {
    // Claude responded, waiting for developer
    return (
      <div className="flex items-center gap-2 py-3 px-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
          <User className="h-3 w-3" />
        </div>
        <span className="text-xs text-muted-foreground">
          Waiting for {developerName || "developer"} to respond...
        </span>
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    );
  }

  if (lastEvent.type === "permission_request") {
    // Claude proposed a tool use, waiting for developer to accept/reject
    return (
      <div className="flex items-center gap-2 py-3 px-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <User className="h-3 w-3" />
        </div>
        <span className="text-xs text-orange-600 font-medium">
          Waiting for developer to approve...
        </span>
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    );
  }

  if (lastEvent.type === "tool_use") {
    // Claude used a tool — may be waiting for acceptance or continuing
    const label = lastEvent.actionLabel || lastEvent.toolName || "working";
    return (
      <div className="flex items-center gap-2 py-3 px-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Bot className="h-3 w-3" />
        </div>
        <span className="text-xs text-muted-foreground">
          Claude: {label}
        </span>
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    );
  }

  if (lastEvent.type === "prompt") {
    // Developer just prompted, Claude is thinking
    return (
      <div className="flex items-center gap-2 py-3 px-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Bot className="h-3 w-3" />
        </div>
        <span className="text-xs text-muted-foreground">
          Claude is thinking...
        </span>
        <span className="flex gap-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    );
  }

  return null;
}

export function ConversationFeed({ events, developerName, runStatus }: {
  events: Event[];
  developerName?: string;
  runStatus?: string;
}) {
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events.length]);

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Waiting for activity...
      </p>
    );
  }

  const feedEvents = events.map(parseFeedEvent);
  const { approvedPermissions, approvedToolUses } = buildApprovalMap(feedEvents);
  const isLive = runStatus === "active" || runStatus === "stale";
  const lastEvent = feedEvents[feedEvents.length - 1];

  return (
    <div
      ref={feedRef}
      className="space-y-4 max-h-[70vh] overflow-y-auto px-1 py-2"
    >
      {feedEvents.map((event) => {
        switch (event.type) {
          case "prompt":
            return <PromptBubble key={event.id} event={event} developerName={developerName} />;
          case "response":
            return <ResponseBubble key={event.id} event={event} />;
          case "tool_use":
            return <ToolUseBubble key={event.id} event={event} wasApproved={approvedToolUses.has(event.id)} />;
          case "permission_request":
            if (approvedPermissions.has(event.id)) return null;
            return <PermissionRequestBubble key={event.id} event={event} />;
          case "started":
          case "completed":
          case "failed":
            return <SessionEvent key={event.id} event={event} />;
          case "heartbeat":
            return null;
          default:
            return null;
        }
      })}
      {runStatus === "active" && lastEvent && (
        <LiveIndicator lastEvent={lastEvent} developerName={developerName} />
      )}
      {runStatus === "stale" && (
        <div className="flex items-center gap-2 py-3 px-2">
          <div className="h-2 w-2 rounded-full bg-zinc-300" />
          <span className="text-xs text-muted-foreground">
            No activity for a few minutes — session may have ended
          </span>
        </div>
      )}
    </div>
  );
}
