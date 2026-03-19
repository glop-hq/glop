# Glop

**How great teams ship with AI.**

Glop gives teams visibility into how developers work with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Watch real sessions, share effective prompts, and maintain full audit trails of AI-generated code before it ships to production.

## What it does

- **Live board** — see who's coding with AI right now, what they're working on, and their current status
- **Session history** — browse, search, and replay past AI coding sessions with full conversation transcripts and tool calls
- **Team insights** — analytics dashboards with KPIs like runs per day, commits per session, developer breakdowns, and busiest hours
- **PR context bot** — automatically posts a summary comment on AI-generated PRs linking back to the session
- **Shareable sessions** — share any session via public link for code review or onboarding

## Project structure

```
glop/
├── apps/cli/           # CLI tool (npm: glop.dev)
├── packages/web/       # Next.js 15 web app
├── packages/db/        # Drizzle ORM schema + migrations
└── packages/shared/    # Shared types and validation
```

## Tech stack

- **Web:** Next.js 15, React 19, Tailwind CSS 4, Radix UI
- **Auth:** NextAuth.js (Google + GitHub OAuth)
- **Database:** PostgreSQL 17, Drizzle ORM
- **CLI:** Commander.js, TypeScript
- **Monorepo:** pnpm workspaces

## Getting started

### Prerequisites

- Node.js >= 20
- pnpm >= 10.17.1
- Docker (for PostgreSQL)

### Setup

```bash
# Clone and install
pnpm install

# Start PostgreSQL
docker compose up -d

# Copy env and fill in OAuth credentials
cp .env.example .env

# Run migrations
pnpm db:generate
pnpm db:migrate

# Seed sample data (optional)
pnpm seed

# Start dev server
pnpm dev
```

> **Note:** Docker maps PostgreSQL to host port **5433**. The default `DATABASE_URL` in `.env.example` uses port 5432 — update it to `postgresql://glop:glop@localhost:5433/glop` when using Docker.

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | GitHub OAuth credentials |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error tracking (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics (optional) |

## CLI

The CLI captures Claude Code sessions and streams them to your Glop workspace.

```bash
npm i -g glop.dev
```

Three commands to get started:

```bash
glop login          # Authenticate via browser
glop link           # Link repo to a workspace
claude              # Start coding — sessions stream automatically
```

Run `glop doctor` to verify your setup.

## Development

```bash
pnpm dev            # Start web app (port 3000)
pnpm build          # Build all packages
pnpm test           # Run tests
pnpm test:watch     # Run tests in watch mode
```

## How it works

1. Developer runs `claude` in a linked repo
2. Claude Code emits hook events (tool use, prompts, responses)
3. The Glop CLI hook intercepts events, enriches with git metadata, and posts to the server
4. The server creates/updates session records and extracts artifacts (PRs, commits)
5. The web app displays live sessions, history, and analytics
6. When a PR is created, a background worker posts a context comment linking to the session

## Deployment

The web app auto-deploys to Vercel on push to `main`. The CLI is published to npm via GitHub Releases using `cli-v*` tags.
