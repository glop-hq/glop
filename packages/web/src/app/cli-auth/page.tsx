"use client";

import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";

function CliAuthContent() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const port = searchParams.get("port");

  if (!port) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm text-center">
          <h1 className="text-xl font-bold">Invalid Request</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Missing callback port. Please run <code className="bg-secondary px-1 rounded">glop login</code> from your terminal.
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!session?.user) {
    // Middleware should have redirected to /login already, but just in case
    router.push(`/login?callbackUrl=/cli-auth?port=${port}`);
    return null;
  }

  async function handleAuthorize() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/auth/cli-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_port: Number(port),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as Record<string, string>).error || "Failed to create API key");
        setLoading(false);
        return;
      }

      const data = await res.json() as { redirect_url: string };
      window.location.href = data.redirect_url;
    } catch {
      setError("Failed to connect to server");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold tracking-tight">Authorize CLI</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The glop CLI is requesting access to your account.
          </p>
        </div>

        <div className="mb-6 rounded-md border bg-secondary/30 p-3">
          <div className="flex items-center gap-3">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt=""
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-medium">
                {(session.user.name || session.user.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-medium">{session.user.name}</p>
              <p className="text-xs text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={handleAuthorize}
            disabled={loading}
            className="w-full cursor-pointer rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Authorizing..." : "Authorize"}
          </button>
          <button
            onClick={() => {
              window.location.href = `http://127.0.0.1:${port}/callback?error=Authorization+denied+by+user`;
            }}
            className="w-full cursor-pointer rounded-md border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CliAuthPage() {
  return (
    <Suspense>
      <CliAuthContent />
    </Suspense>
  );
}
