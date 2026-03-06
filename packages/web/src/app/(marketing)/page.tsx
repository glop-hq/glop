import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">glop</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          Passive control plane for local Claude-driven development
        </p>
        <Link
          href="/login"
          className="cursor-pointer rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
