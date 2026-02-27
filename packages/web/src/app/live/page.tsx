import { NavHeader } from "@/components/nav-header";
import { LiveBoard } from "@/components/live-board";

export default function LivePage() {
  return (
    <div className="min-h-screen">
      <NavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold">Live Now</h1>
          <p className="text-sm text-muted-foreground">
            Active development sessions across the team
          </p>
        </div>
        <div className="rounded-lg border bg-card">
          <LiveBoard />
        </div>
      </main>
    </div>
  );
}
