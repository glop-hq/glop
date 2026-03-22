import { SkillsList } from "@/components/skills-list";

export default function SkillsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">Skills & Commands</h1>
        <p className="text-sm text-muted-foreground">
          Discover Claude Code skills and commands across your repositories
        </p>
      </div>
      <SkillsList />
    </main>
  );
}
