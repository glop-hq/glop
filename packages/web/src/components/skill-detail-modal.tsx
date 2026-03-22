"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Terminal, FolderGit2, Copy, Check, X } from "lucide-react";
import type { ClaudeItemWithRepo } from "@glop/shared";

interface SkillDetailModalProps {
  item: ClaudeItemWithRepo;
  onClose: () => void;
}

export function SkillDetailModal({ item, onClose }: SkillDetailModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(item.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between border-b p-4">
          <div className="flex items-center gap-2">
            {item.kind === "skill" ? (
              <Sparkles className="h-5 w-5 text-violet-500" />
            ) : (
              <Terminal className="h-5 w-5 text-blue-500" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">{item.name}</h2>
                <Badge variant="secondary">{item.kind}</Badge>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <FolderGit2 className="h-3 w-3" />
                <span>{item.repo_display_name || item.repo_key}</span>
                <span className="mx-1">·</span>
                <span className="font-mono">{item.file_path}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm font-mono">
            {item.content}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t p-4">
          <p className="text-xs text-muted-foreground">
            Copy this content to your repo at <code className="rounded bg-muted px-1">{item.file_path}</code>
          </p>
          <Button
            onClick={handleCopy}
            size="sm"
            className="cursor-pointer gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Content
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
