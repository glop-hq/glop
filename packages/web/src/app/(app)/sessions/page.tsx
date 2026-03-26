import { LiveBoard } from "@/components/live-board";
import { HistoryTable } from "@/components/history-table";

export default function SessionsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">Sessions</h1>
        <p className="text-sm text-muted-foreground">
          Live and recent Claude Code sessions across your workspace
        </p>
      </div>
      <div className="space-y-8">
        <div className="rounded-lg border bg-card">
          <LiveBoard />
        </div>
        <HistoryTable />
      </div>
    </main>
  );
}
