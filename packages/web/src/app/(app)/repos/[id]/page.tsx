"use client";

import { use } from "react";
import { UnifiedRepoDetail } from "@/components/unified-repo-detail";

export default function RepoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <UnifiedRepoDetail repoId={id} />
    </main>
  );
}
