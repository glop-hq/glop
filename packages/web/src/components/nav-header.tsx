"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Radio, Clock, BarChart3, Check, ChevronsUpDown, Plus } from "lucide-react";
import { UserMenu } from "./user-menu";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { Popover } from "@/components/ui/popover";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";

const navItems = [
  { href: "/live", label: "Live Now", icon: Radio },
  { href: "/history", label: "History", icon: Clock },
  { href: "/insights", label: "Insights", icon: BarChart3 },
];

export function NavHeader() {
  const pathname = usePathname();
  const { workspaces, currentWorkspace, setCurrentWorkspace, refetch } = useWorkspaces();
  const { update: updateSession } = useSession();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <header className="relative z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        <Link href="/live" className="mr-3 flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">glop</span>
        </Link>
        <div className="mr-3 h-5 w-px bg-border" />
        {currentWorkspace && (
          <Popover
            open={switcherOpen}
            onClose={() => setSwitcherOpen(false)}
            trigger={
              <button
                onClick={() => setSwitcherOpen(!switcherOpen)}
                className="mr-6 flex cursor-pointer items-center gap-1 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="max-w-[200px] truncate" title={currentWorkspace.name}>
                  {currentWorkspace.name}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </button>
            }
          >
            <div className="w-56">
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Workspaces
              </div>
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  onClick={() => {
                    setCurrentWorkspace(w.id);
                    setSwitcherOpen(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      w.id === currentWorkspace.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{w.name}</span>
                </button>
              ))}
              <div className="my-1 border-t" />
              <button
                onClick={() => {
                  setSwitcherOpen(false);
                  setCreateOpen(true);
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>Create workspace</span>
              </button>
            </div>
          </Popover>
        )}
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                pathname.startsWith(href)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </div>

      <CreateWorkspaceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (workspace) => {
          setCreateOpen(false);
          await refetch();
          setCurrentWorkspace(workspace.id);
          await updateSession();
        }}
      />
    </header>
  );
}
