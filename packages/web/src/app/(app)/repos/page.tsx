import { ReposList } from "@/components/repos-list";

export default function ReposPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Repos</h1>
        <p className="text-sm text-muted-foreground">
          Claude Code readiness scores across your repositories
        </p>
      </div>
      <div className="rounded-lg border bg-card">
        <ReposList />
      </div>
    </main>
  );
}
