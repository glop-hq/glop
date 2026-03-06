"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";
import { WorkspacesProvider } from "@/hooks/use-workspaces";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <WorkspacesProvider>{children}</WorkspacesProvider>
    </NextAuthSessionProvider>
  );
}
