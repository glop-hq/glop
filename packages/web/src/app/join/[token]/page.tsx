"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users } from "lucide-react";

export default function JoinWorkspacePage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(`/api/v1/join/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Invite link is invalid or has been disabled");
          return;
        }
        const data = await res.json();
        setWorkspaceName(data.workspace_name);
      } catch {
        setError("Failed to load invite details");
      } finally {
        setLoading(false);
      }
    }
    fetchPreview();
  }, [token]);

  const handleJoin = async () => {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/join/${token}`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "UNAUTHORIZED") {
          // Not logged in — shouldn't happen since middleware redirects, but handle gracefully
          router.push(`/login?callbackUrl=/join/${token}`);
          return;
        }
        setError(data.error || "Failed to join workspace");
        return;
      }

      // Refresh session to include new workspace
      await updateSession();

      // Redirect to live page
      router.push("/live");
    } catch {
      setError("Failed to join workspace");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !workspaceName) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="cursor-pointer mt-4"
              onClick={() => router.push("/live")}
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Join {workspaceName}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            You&apos;ve been invited to join this workspace
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {session ? (
            <>
              <p className="text-sm text-center text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{session.user?.email}</span>
              </p>
              <Button
                className="cursor-pointer w-full"
                onClick={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Join Workspace
              </Button>
            </>
          ) : (
            <Button
              className="cursor-pointer w-full"
              onClick={() => router.push(`/login?callbackUrl=/join/${token}`)}
            >
              Sign in to Join
            </Button>
          )}
          {error && <p className="text-xs text-destructive text-center">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
