"use client";

import { useState, useRef, useCallback } from "react";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useSkills } from "@/hooks/use-skills";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SkillDetailModal } from "./skill-detail-modal";
import { Sparkles, Terminal, Search, FolderGit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClaudeItemWithRepo } from "@glop/shared";

const kindFilters = [
  { value: "", label: "All" },
  { value: "skill", label: "Skills" },
  { value: "command", label: "Commands" },
] as const;

export function SkillsList() {
  const { currentWorkspace } = useWorkspaces();
  const [kindFilter, setKindFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<ClaudeItemWithRepo | null>(null);

  // Debounce search
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const { items, loading } = useSkills(currentWorkspace?.id || "", {
    kind: kindFilter || undefined,
    search: debouncedSearch || undefined,
  });

  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-muted-foreground">
        <Sparkles className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-sm">Select a workspace to view skills</p>
      </div>
    );
  }

  return (
    <>
      {/* Search and filters */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search skills and commands..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-1">
          {kindFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setKindFilter(filter.value)}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                kindFilter === filter.value
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border bg-card py-16 text-muted-foreground">
          <Sparkles className="mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">No skills or commands found</p>
          <p className="mt-1 text-xs">
            Skills appear when repos with .claude/skills/ or .claude/commands/ are scanned
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="cursor-pointer rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50"
            >
              <div className="mb-2 flex items-center gap-2">
                {item.kind === "skill" ? (
                  <Sparkles className="h-4 w-4 text-violet-500" />
                ) : (
                  <Terminal className="h-4 w-4 text-blue-500" />
                )}
                <span className="font-medium">{item.name}</span>
                <Badge
                  variant="secondary"
                  className="ml-auto text-xs"
                >
                  {item.kind}
                </Badge>
              </div>
              <div className="mb-3 text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                {item.content.slice(0, 200)}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <FolderGit2 className="h-3 w-3" />
                <span className="truncate">
                  {item.repo_display_name || item.repo_key.split("/").pop()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedItem && (
        <SkillDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
}
