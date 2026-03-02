"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Radio, Clock } from "lucide-react";
import { UserMenu } from "./user-menu";
import type { SessionWorkspace } from "@/lib/session";

const navItems = [
  { href: "/live", label: "Live Now", icon: Radio },
  { href: "/history", label: "History", icon: Clock },
];

export function NavHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const workspaces = (
    (session as unknown as Record<string, unknown>)?.workspaces as SessionWorkspace[]
  ) || [];
  const currentWorkspace = workspaces[0];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        <Link href="/live" className="mr-4 flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight">glop</span>
        </Link>
        {currentWorkspace && (
          <span className="mr-6 text-sm text-muted-foreground border-l pl-4">
            {currentWorkspace.name}
          </span>
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
    </header>
  );
}
