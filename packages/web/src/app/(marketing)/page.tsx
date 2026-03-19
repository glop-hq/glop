import Link from "next/link";
import {
  Eye,
  Users,
  Shield,
  Terminal,
  Radio,
  GitBranch,
  FolderGit2,
  FileEdit,
  Search,
  FlaskConical,
  ChevronRight,
  ArrowRight,
  Bot,
  User,
  Check,
  BarChart3,
  GitPullRequest,
  Clock,
  UserPlus,
  Link2,
  TrendingUp,
  Hash,
  GitCommit,
  Zap,
  Github,
} from "lucide-react";
import { CopyButton } from "./copy-button";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-lg font-bold tracking-tight">glop</span>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/glop-hq/glop"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
            >
              <Github className="h-5 w-5" />
            </a>
            <Link
              href="/login"
              className="cursor-pointer rounded-md bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-28">
        <div className="text-center mx-auto max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            How great teams
            <br />
            ship with AI.
          </h1>
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            Get your team productive with AI coding.
            See what works, share best practices, and ship faster together.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <div className="inline-flex items-center gap-3 rounded-lg border bg-zinc-950 px-4 py-2.5 font-mono text-sm text-zinc-300">
              <Terminal className="h-4 w-4 text-zinc-500" />
              <span>npm i -g glop.dev</span>
              <CopyButton text="npm i -g glop.dev" />
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="cursor-pointer inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Sign in
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <span className="text-border">|</span>
              <a
                href="#how-it-works"
                className="cursor-pointer inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                How it works
                <ChevronRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Live board preview */}
        <div className="mt-14 rounded-xl border bg-card p-1 shadow-sm">
          <div className="rounded-lg border bg-background">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <Radio className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Live Now</span>
              <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                3 active
              </span>
            </div>
            <div className="divide-y text-sm">
              <MockRunRow
                status="active"
                dev="Sarah Chen"
                repo="acme/api"
                branch="feat/auth-flow"
                phase="Editing"
                phaseColor="blue"
                activity="Implementing OAuth2 middleware"
                artifacts={["PR #142"]}
              />
              <MockRunRow
                status="active"
                dev="Marcus Wu"
                repo="acme/web"
                branch="fix/dashboard-perf"
                phase="Validating"
                phaseColor="yellow"
                activity="Running test suite"
                artifacts={["PR #289"]}
              />
              <MockRunRow
                status="blocked"
                dev="Priya Sharma"
                repo="acme/ml-pipeline"
                branch="feat/embeddings"
                phase="Waiting"
                phaseColor="orange"
                activity="Needs approval: write to /etc/config"
                artifacts={[]}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            AI moves fast. You need to keep up.
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Most developers are figuring out AI coding on their own.
            Glop gives your whole team a shared view of what&apos;s working
            and how to do more of it.
          </p>

          <div className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
            <ValueProp
              icon={Eye}
              title="Get up to speed"
              description="See how your best developers use AI. Watch real sessions, learn effective prompts, and ramp up your whole team faster."
            />
            <ValueProp
              icon={Users}
              title="Share what works"
              description="Share sessions across your team. Turn one developer's breakthrough into everyone's best practice."
            />
            <ValueProp
              icon={Shield}
              title="Ship with confidence"
              description="Full trail of every AI action, tool call, and artifact. Review what AI did before it goes to production."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Set up in 60 seconds
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">
            No code changes. No config files. Three commands.
          </p>

          <div className="mt-14 grid items-start gap-8 sm:grid-cols-2">
            {/* Left: steps */}
            <div className="flex flex-col gap-0">
              <Step number={1} title="Auth" command="glop login" description="Links your CLI to your Glop workspace." isLast={false} />
              <Step number={2} title="Link" command="glop link" description="Installs hooks in your repo in seconds." isLast={false} />
              <Step number={3} title="Start coding" command="claude" description="Sessions stream to your board." isLast={true} />
            </div>
            {/* Right: terminal */}
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
              <div className="flex items-center gap-1.5 border-b border-zinc-800 px-4 py-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="ml-2 text-xs text-zinc-500">Terminal</span>
              </div>
              <div className="space-y-4 p-5 font-mono text-sm">
                <div>
                  <div className="text-zinc-500">{"# 1. Auth"}</div>
                  <div className="flex items-center gap-1 text-zinc-300">
                    <span className="text-green-400">$</span> glop login
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-600">Opened browser for sign in...</div>
                </div>
                <div>
                  <div className="text-zinc-500">{"# 2. Link your repo"}</div>
                  <div className="flex items-center gap-1 text-zinc-300">
                    <span className="text-green-400">$</span> glop link
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-600">Hooks installed in .claude/settings.json</div>
                </div>
                <div>
                  <div className="text-zinc-500">{"# 3. Start coding"}</div>
                  <div className="flex items-center gap-1 text-zinc-300">
                    <span className="text-green-400">$</span> claude
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-zinc-600">
                    Streaming to your board
                    <span className="inline-block h-3 w-[2px] animate-pulse bg-zinc-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Session deep dive */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Learn from every session
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Every AI session is a learning opportunity. See the full conversation,
            understand what prompts led to great results, and replay the workflow.
          </p>

          {/* Mock session feed */}
          <div className="mt-12 rounded-xl border bg-card p-1 shadow-sm">
            <div className="rounded-lg border bg-background">
              <div className="border-b px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">
                    Implementing OAuth2 middleware
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    12 min ago
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FolderGit2 className="h-3 w-3" /> acme/api
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GitBranch className="h-3 w-3" /> feat/auth-flow
                  </span>
                </div>
              </div>

              <div className="space-y-3 p-4">
                <MockMessage
                  role="user"
                  content="Add OAuth2 middleware that validates JWT tokens and attaches the user to the request context."
                />
                <MockToolCall
                  icon={Search}
                  name="Grep"
                  detail="Searching for existing auth patterns"
                />
                <MockToolCall
                  icon={FileEdit}
                  name="Edit"
                  detail="src/middleware/auth.ts (+47 lines)"
                />
                <MockToolCall
                  icon={FileEdit}
                  name="Edit"
                  detail="src/routes/index.ts (+3 lines)"
                />
                <MockToolCall
                  icon={FlaskConical}
                  name="Bash"
                  detail="npm test: 24 passed, 0 failed"
                />
                <MockMessage
                  role="assistant"
                  content="Added JWT validation middleware at src/middleware/auth.ts. All 24 tests pass."
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics / Insights */}
      <section className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Understand what&apos;s working
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">
            See which prompts, patterns, and workflows lead to the best
            outcomes. Spot what&apos;s effective so the whole team can do more of it.
          </p>

          {/* Mock analytics dashboard */}
          <div className="mt-12 rounded-xl border bg-card p-1 shadow-sm">
            <div className="rounded-lg border bg-background">
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Team Insights</span>
                <div className="ml-auto flex gap-1">
                  {(["7d", "30d", "90d"] as const).map((p) => (
                    <span
                      key={p}
                      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                        p === "30d"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground"
                      }`}
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-4">
                <MockKpi label="Total Runs" value="342" change="+18%" />
                <MockKpi label="Avg Turns" value="14.2" />
                <MockKpi label="Commits / Run" value="2.8" change="+12%" />
                <MockKpi label="Top Repo" value="acme/api" />
              </div>

              {/* Mini bar chart */}
              <div className="px-4 py-4">
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Runs per day
                </div>
                <div className="flex items-end gap-1 h-16">
                  {[40, 65, 50, 80, 45, 70, 90, 55, 75, 85, 60, 95, 70, 50].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-foreground/15 transition-colors hover:bg-foreground/25"
                        style={{ height: `${h}%` }}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PR Context Bot */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Every PR tells the full story
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Glop automatically posts a context summary on every AI-generated
            pull request. Reviewers see what was asked, what changed, and why
            &ndash; before reading a single line of code.
          </p>

          {/* Mock PR comment */}
          <div className="mt-12 rounded-xl border bg-card p-1 shadow-sm">
            <div className="rounded-lg border bg-background">
              <div className="flex items-center gap-2 border-b px-4 py-2.5">
                <GitPullRequest className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">
                  Add OAuth2 middleware
                </span>
                <span className="ml-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  Open
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  #142
                </span>
              </div>

              <div className="p-4">
                <div className="rounded-lg border bg-blue-50/50 border-blue-100">
                  <div className="flex items-center gap-2 border-b border-blue-100 px-3 py-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100">
                      <Bot className="h-3 w-3 text-blue-700" />
                    </div>
                    <span className="text-xs font-medium text-blue-900">
                      Glop Context
                    </span>
                    <span className="text-xs text-blue-600">
                      &middot; posted automatically
                    </span>
                  </div>
                  <div className="space-y-2.5 px-3 py-3 text-sm text-blue-900">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wider text-blue-600 mb-1">
                        Prompt
                      </div>
                      <p className="text-sm">
                        &quot;Add OAuth2 middleware that validates JWT tokens and
                        attaches the user to the request context.&quot;
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-700">
                      <span className="inline-flex items-center gap-1">
                        <FileEdit className="h-3 w-3" /> 3 files changed
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Hash className="h-3 w-3" /> 14 conversation turns
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FlaskConical className="h-3 w-3" /> 24 tests passed
                      </span>
                    </div>
                    <div className="pt-1 text-xs">
                      <a
                        href="#"
                        className="cursor-pointer inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900"
                      >
                        View full session on Glop
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built for teams */}
      <section className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Built for teams
          </h2>
          <p className="mt-3 max-w-lg text-muted-foreground">
            Everything your team needs to collaborate on AI-assisted
            development.
          </p>

          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3 sm:gap-8">
            <ValueProp
              icon={Clock}
              title="Session history"
              description="Browse, search, and filter every past session. Sort by developer, repo, duration, or date."
            />
            <ValueProp
              icon={UserPlus}
              title="Workspace management"
              description="Create workspaces, invite teammates, and assign admin or member roles with a single link."
            />
            <ValueProp
              icon={Link2}
              title="Shareable links"
              description="Generate public links to any session. Share with stakeholders, embed in docs, or use for onboarding."
            />
            <ValueProp
              icon={GitCommit}
              title="Artifact tracking"
              description="Commits, PRs, CI runs, and preview links are automatically captured and linked to each session."
            />
            <ValueProp
              icon={TrendingUp}
              title="Usage trends"
              description="See which repos get the most AI activity, which patterns lead to clean merges, and how usage grows over time."
            />
            <ValueProp
              icon={Zap}
              title="Real-time board"
              description="Live view of every active session. See who's coding, who's blocked, and what's in progress right now."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Try it now
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Free to use. Three commands to get started.
          </p>
          <div className="mt-8 inline-flex items-center gap-3 rounded-lg border bg-zinc-950 px-4 py-2.5 font-mono text-sm text-zinc-300">
            <Terminal className="h-4 w-4 text-zinc-500" />
            <span>npm i -g glop.dev</span>
            <CopyButton text="npm i -g glop.dev" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-sm font-medium">glop</span>
            <span className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Glop. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Built from San Francisco</span>
            <a href="https://github.com/glop-hq/glop" target="_blank" rel="noopener noreferrer" className="cursor-pointer transition-colors hover:text-foreground">GitHub</a>
            <Link href="/terms" className="cursor-pointer transition-colors hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="cursor-pointer transition-colors hover:text-foreground">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

function ValueProp({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border bg-background">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  command,
  description,
  isLast,
}: {
  number: number;
  title: string;
  command: string;
  description: string;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
          {number}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>
      <div className="pb-8">
        <h3 className="mt-1 text-base font-semibold">{title}</h3>
        <code className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {command}
        </code>
        <p className="mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function MockRunRow({
  status,
  dev,
  repo,
  branch,
  phase,
  phaseColor,
  activity,
  artifacts,
}: {
  status: "active" | "blocked";
  dev: string;
  repo: string;
  branch: string;
  phase: string;
  phaseColor: "blue" | "yellow" | "orange";
  activity: string;
  artifacts: string[];
}) {
  const dotColor = status === "active" ? "bg-green-500" : "bg-amber-500";
  const phaseColors = {
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
    orange: "bg-orange-100 text-orange-800 border-orange-200",
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="relative flex h-2 w-2 shrink-0">
        <div
          className={`${dotColor} h-2 w-2 rounded-full ${status === "active" ? "animate-pulse" : ""}`}
        />
      </div>
      <div className="w-28 shrink-0">
        <div className="text-sm font-medium">{dev}</div>
      </div>
      <div className="hidden w-36 shrink-0 sm:block">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <FolderGit2 className="h-3 w-3" />
          {repo}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <GitBranch className="h-3 w-3" />
          {branch}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium ${phaseColors[phaseColor]}`}
          >
            {phase}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {activity}
          </span>
        </div>
      </div>
      {artifacts.length > 0 && (
        <div className="hidden shrink-0 sm:flex items-center gap-1.5">
          {artifacts.map((a) => (
            <span
              key={a}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
            >
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MockMessage({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className="flex gap-2.5">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-blue-100" : "bg-amber-100"
        }`}
      >
        {isUser ? (
          <User className="h-3 w-3 text-blue-700" />
        ) : (
          <Bot className="h-3 w-3 text-amber-700" />
        )}
      </div>
      <div
        className={`rounded-lg border px-3 py-2 text-sm ${
          isUser
            ? "bg-blue-50 border-blue-100 text-blue-900"
            : "bg-amber-50 border-amber-100 text-amber-900"
        }`}
      >
        {content}
      </div>
    </div>
  );
}

function MockKpi({
  label,
  value,
  change,
  down,
}: {
  label: string;
  value: string;
  change?: string;
  down?: boolean;
}) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold">{value}</span>
        {change && (
          <span
            className={`text-xs font-medium ${
              down ? "text-red-500" : "text-green-600"
            }`}
          >
            {change}
          </span>
        )}
      </div>
    </div>
  );
}

function MockToolCall({
  icon: Icon,
  name,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  detail: string;
}) {
  return (
    <div className="ml-8 flex items-center gap-2 text-xs text-muted-foreground">
      <div className="flex h-5 w-5 items-center justify-center rounded border bg-muted">
        <Icon className="h-3 w-3" />
      </div>
      <span className="font-mono font-medium">{name}</span>
      <span className="truncate">{detail}</span>
      <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-green-600">
        <Check className="h-3 w-3" />
      </span>
    </div>
  );
}
