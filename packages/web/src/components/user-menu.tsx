"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, ChevronDown } from "lucide-react";

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!session?.user) return null;

  const { name, email, image } = session.user;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
      >
        {image ? (
          <img
            src={image}
            alt={name || "User"}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-xs font-medium">
            {(name || email || "U").charAt(0).toUpperCase()}
          </div>
        )}
        <span className="hidden text-sm font-medium sm:inline">
          {name || email}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-md border bg-popover py-1 shadow-md">
          <div className="border-b px-3 py-2">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              router.push("/settings/workspace");
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-secondary"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
