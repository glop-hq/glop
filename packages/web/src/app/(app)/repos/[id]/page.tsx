import { RepoDetail } from "@/components/repo-detail";

export default async function RepoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <RepoDetail repoId={id} />
    </main>
  );
}
