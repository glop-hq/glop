# Team Adoption & Visibility Dashboard

| Field    | Value                                    |
|----------|------------------------------------------|
| Priority | P1 -- Buyer retention and expansion      |
| Effort   | 10-13 days                               |
| Status   | Not Started                              |
| Author   | --                                       |
| Date     | 2026-03-21                               |

---

## Problem Statement

Engineering leaders investing in AI coding tools need to know whether the investment is working. Today, they have no reliable way to answer fundamental questions:

- Which repos are being actively used with Claude Code, and which are sitting idle?
- Are all developers on the team using the tool, or just a few power users?
- Where are AI sessions failing or stalling? Where are they succeeding?
- Is adoption improving over time, or has it plateaued?
- What are the top causes of friction that slow down AI-assisted development?
- What patterns of success can be replicated across the team?

Without actionable visibility, leaders cannot drive adoption, justify the investment, or make data-informed decisions about where to focus improvement efforts. Generic usage charts (sessions per day, total commits) are necessary but insufficient -- they show activity without insight.

The key insight from the product memo is: **visibility matters only when tied to change**. This dashboard must not just show data -- it must surface the friction points and success patterns that lead to concrete improvements.

---

## Goals

1. Give engineering leaders a comprehensive view of AI coding adoption by repo and developer.
2. Surface the top friction points (where AI sessions stall or fail) and top success patterns (where AI sessions deliver high value).
3. Track adoption metrics over time to measure whether the organization is improving.
4. Provide rollout coverage visibility: which repos and developers are onboarded, which are not.
5. Connect visibility to action: every insight should link to something the leader can do about it.

---

## Success Metrics

| Metric                                        | Target                              |
|-----------------------------------------------|-------------------------------------|
| Dashboard weekly active users                 | > 70% of workspace admins           |
| Time from insight to action (click-through)   | > 30% of friction insights lead to repo/standard action |
| Leader-reported value (survey)                | > 80% "useful" or "very useful"     |
| Adoption trend visibility                     | Leaders can answer "is adoption growing?" in < 30 seconds |
| Dashboard page load time                      | < 2 seconds                         |

---

## User Stories

### Engineering Leader

1. As an engineering leader, I want to see overall adoption status (how many developers, how many repos, how active) so I can gauge whether the rollout is working.
2. As an engineering leader, I want to drill into per-repo metrics so I can compare adoption across repos and identify underutilized ones.
3. As an engineering leader, I want to see which repos are most actively used with AI coding so I can understand where the tool is adding value.
4. As an engineering leader, I want to see the top friction points across my repos so I can prioritize improvements.
5. As an engineering leader, I want to see successful patterns so I can recognize and replicate good practices.
6. As an engineering leader, I want to see readiness improvement over time so I can measure the impact of our enablement efforts.
7. As an engineering leader, I want a rollout coverage view showing which repos and developers are onboarded vs. not, so I can plan the next wave.
8. As an engineering leader, I want every insight to link to an action -- fix a repo, apply a standard, review a session.

### Developer

9. As a developer, I want to see my own usage stats and how I compare to workspace norms (anonymized), so I can self-assess.
10. As a developer, I want to understand where the workspace is succeeding with AI coding so I can adopt those practices.

---

## Feature Spec

### Feature 1: Adoption Overview Dashboard (~3-4 days)

**Overview**: The primary landing page for engineering leaders. Shows the health of AI coding adoption across the organization at a glance.

**URL**: `/{workspace}/dashboard`

**Summary Cards (top row)**:

| Card                    | Metric                                             | Trend                |
|-------------------------|-----------------------------------------------------|----------------------|
| Active Developers       | Developers with ≥1 session in the period            | vs. previous period  |
| Active Repos            | Repos with ≥1 session in the period                 | vs. previous period  |
| Total Sessions          | Completed sessions in the period                    | vs. previous period  |
| Avg Session Effectiveness | Composite score (commits per session, turns, duration) | vs. previous period |
| Readiness (avg)         | Average readiness score across all repos             | vs. previous period  |
| Rollout Coverage        | % of known repos with ≥1 session                    | vs. previous period  |

**Charts Section**:

1. **Adoption Trend**: Line chart showing daily active developers and daily sessions over the period. Dual y-axis.
2. **Activity by Repo**: Stacked bar chart showing sessions per repo per week. Repos color-coded.
3. **Session Outcome Distribution**: Pie/donut chart showing session outcomes: completed with commits, completed without commits, failed, abandoned.
4. **Repo Activity Heatmap**: Grid showing repos (rows) × days (columns), colored by session count. Quickly shows which repos are hot and which are cold.

**Period Selector**: 7d / 30d / 90d pills matching existing analytics page pattern.

---

### Feature 2: Per-Repo Drill-Down (~2-3 days)

**Overview**: Detailed metrics for a specific repo, accessible by clicking a repo in the overview dashboard or via sidebar.

**URL**: `/{workspace}/dashboard/repos/{repoId}`

**Sections**:

1. **Repo Summary Cards**: Same structure as overview but filtered to this repo.

2. **Developer Breakdown Table**:

   | Column              | Description                                  |
   |---------------------|----------------------------------------------|
   | Developer           | Name + avatar                                |
   | Sessions            | Total in period                               |
   | Commits             | Total commits produced                        |
   | PRs                 | Total PRs produced                            |
   | Avg Turns           | Average conversation turns per session        |
   | Last Active         | Most recent session                           |
   | Trend               | Sparkline of sessions over time               |

   Sortable. Clickable rows (cursor-pointer) link to developer detail.

3. **Readiness & Friction Summary**:

   | Column              | Description                                  |
   |---------------------|----------------------------------------------|
   | Readiness Score     | Color-coded 0-100                            |
   | Standards Applied   | Count of standards applied to this repo       |
   | Top Friction Points | Most common friction patterns                 |
   | Session Success Rate| % of sessions that produced commits           |

4. **Repo Activity Timeline**: Chronological feed of significant events (new developer first session, readiness score change, standard applied, playbook accepted).

---

### Feature 3: Friction & Success Analytics (~3-4 days)

**Overview**: The most actionable section. Surfaces where AI coding is struggling and where it's thriving, with links to concrete actions.

**URL**: `/{workspace}/dashboard/insights`

**Top Friction Points**:

A ranked list of the biggest blockers to effective AI coding, aggregated from:
- Session signals (from Operational Memory PRD)
- Readiness findings (from Repo Readiness PRD)
- Verification gaps (from existing analytics)
- Session failure/stall patterns

Each friction point shows:
- **Title**: Human-readable description (e.g., "Auth module causes 3x more iterations than average")
- **Impact**: Quantified impact (sessions affected, time wasted, iteration overhead)
- **Repo**: Which repo(s) affected
- **Area**: Which part of the codebase
- **Trend**: Getting better or worse?
- **Suggested Action**: Link to a concrete action (fix repo readiness, apply standard, review playbook)
- **Status**: New, Acknowledged, In Progress, Resolved

Ranking algorithm:
```
impact_score = frequency × severity × recency_weight
```

**Top Success Patterns**:

A ranked list of what's working well:
- **Title**: Description (e.g., "Frontend component generation completes 85% of the time with 1 verification pass")
- **Frequency**: How often this pattern occurs
- **Repos**: Where it's observed
- **Replicability**: Could this be turned into a standard or playbook?
- **Action**: "Promote to Playbook" or "Apply to Other Repos"

**Hotspot Map**:
- Visual representation of which code areas across repos are friction hotspots vs. success zones.
- Clickable areas (cursor-pointer) that drill into the specific patterns.

---

### Feature 4: AI Contribution Metrics (~1-2 days)

**Overview**: Shows how much code deployed in each known repo was produced with AI assistance. Only includes repos that have at least one session recorded in Glop — we cannot discover repos where Glop was never used.

**URL**: `/{workspace}/dashboard/contributions`

**Contributions Table**:

| Column              | Description                                  |
|---------------------|----------------------------------------------|
| Repo                | org/repo name                                |
| AI Commit %         | % of commits originating from AI sessions in the period |
| AI PR %             | % of PRs originating from AI sessions in the period |
| Sessions (30d)      | Session count in last 30 days                |
| Active Developers   | Count using this repo in last 30d            |
| Readiness Score     | Color-coded 0-100                            |
| Trend               | AI contribution % vs. previous period        |

**Summary Cards**:
- Overall AI commit % across all known repos
- Repo with highest AI contribution %
- Repo with most sessions
- Week-over-week change in AI contribution %

---

### Feature 5: Scheduled Digests (~1-2 days)

**Overview**: Regular email or in-app digest summarizing key adoption metrics and insights. Keeps leaders informed without requiring them to check the dashboard daily.

**Digest Content**:
- Period summary (sessions, developers, repos active)
- Top 3 friction points (with links to actions)
- Top 3 successes
- Readiness score changes (repos that improved, repos that degraded)
- New patterns detected
- AI contribution trends

**Delivery**:
- Weekly digest (default) sent on Monday morning.
- Configurable: daily, weekly, or monthly.
- Delivered via email with a "View Full Dashboard" link.
- In-app notification badge for new digest.

---

## Milestones

### Milestone 1: Adoption Overview (3-4 days)
- Build aggregate query layer for adoption metrics (active developers, repos, sessions, effectiveness).
- Implement period-over-period comparison logic.
- Build overview dashboard page with summary cards and charts.
- API endpoints: `GET /api/v1/dashboard/overview`, `GET /api/v1/dashboard/trends`.

### Milestone 2: Repo Drill-Down (2-3 days)
- Build repo-filtered aggregate queries.
- Build repo detail dashboard page with developer table, readiness summary, activity timeline.
- API endpoints: `GET /api/v1/dashboard/repos/{id}`, `GET /api/v1/dashboard/repos/{id}/developers`.

### Milestone 3: Friction & Success Analytics (3-4 days)
- Build friction scoring and ranking engine.
- Build success pattern aggregation.
- Build insights page with friction list, success list, hotspot visualization.
- Connect to action links (repo detail, standards, playbooks).
- API endpoints: `GET /api/v1/dashboard/friction`, `GET /api/v1/dashboard/successes`.

### Milestone 4: AI Contributions & Digests (2-3 days)
- Build AI contribution percentage calculations (commits and PRs from AI sessions vs. total).
- Build contributions page with per-repo metrics table.
- Build digest generation logic.
- Implement email delivery (or in-app notification as MVP).
- API endpoints: `GET /api/v1/dashboard/contributions`, `POST /api/v1/dashboard/digests/preview`.

---

## Data Model Changes

### New Tables

#### `friction_insights`

| Column          | Type                     | Notes                                          |
|-----------------|--------------------------|------------------------------------------------|
| id              | uuid, PK                 | Default random                                 |
| workspace_id    | uuid, FK → workspaces    | Not null                                       |
| repo_id         | uuid, FK → repos         | Nullable (can be cross-repo)                   |
| title           | text                     | Not null                                       |
| description     | text                     | Not null                                       |
| impact_score    | real                     | Not null. Computed ranking score               |
| frequency       | integer                  | Not null. Number of sessions affected          |
| severity        | text                     | `high`, `medium`, `low`                        |
| area            | text                     | Nullable. Code area affected                   |
| source_type     | text                     | `pattern`, `readiness`, `verification`, `stall`|
| source_id       | uuid                     | Nullable. FK to source record                  |
| suggested_action| jsonb                    | Action type + link                             |
| status          | text                     | `new`, `acknowledged`, `in_progress`, `resolved`|
| resolved_at     | timestamp with tz        | Nullable                                       |
| first_seen_at   | timestamp with tz        | Not null                                       |
| last_seen_at    | timestamp with tz        | Not null                                       |
| created_at      | timestamp with tz        | Not null, default now                          |
| updated_at      | timestamp with tz        | Not null, default now                          |

Indexes: `(workspace_id, status)`, `(workspace_id, impact_score DESC)`, `(repo_id)`.

#### `digest_schedules`

| Column          | Type                     | Notes                                          |
|-----------------|--------------------------|------------------------------------------------|
| id              | uuid, PK                 | Default random                                 |
| workspace_id    | uuid, FK → workspaces    | Not null                                       |
| user_id         | uuid, FK → users         | Not null                                       |
| frequency       | text                     | `daily`, `weekly`, `monthly`                   |
| enabled         | boolean                  | Not null, default true                         |
| last_sent_at    | timestamp with tz        | Nullable                                       |
| created_at      | timestamp with tz        | Not null, default now                          |
| updated_at      | timestamp with tz        | Not null, default now                          |

Indexes: unique `(workspace_id, user_id)`.

### No Changes to Existing Tables

All metrics are computed from existing `runs`, `events`, `artifacts` tables plus the new tables from other PRDs (`session_signals`, `patterns`, `repo_scans`, `standard_applications`).

---

## API Endpoints

### Dashboard

| Method | Path                                      | Description                           |
|--------|-------------------------------------------|---------------------------------------|
| GET    | `/api/v1/dashboard/overview`              | Workspace adoption summary            |
| GET    | `/api/v1/dashboard/trends`                | Time-series adoption data             |
| GET    | `/api/v1/dashboard/repos/{id}`            | Repo-level metrics                    |
| GET    | `/api/v1/dashboard/repos/{id}/developers` | Developer breakdown for a repo        |

### Insights

| Method | Path                                      | Description                           |
|--------|-------------------------------------------|---------------------------------------|
| GET    | `/api/v1/dashboard/friction`              | Top friction points (ranked)          |
| PUT    | `/api/v1/dashboard/friction/{id}/status`  | Update friction status                |
| GET    | `/api/v1/dashboard/successes`             | Top success patterns                  |
| GET    | `/api/v1/dashboard/hotspots`              | Code area hotspot data                |

### Contributions

| Method | Path                                      | Description                           |
|--------|-------------------------------------------|---------------------------------------|
| GET    | `/api/v1/dashboard/contributions`         | AI contribution % per repo            |

### Digests

| Method | Path                                      | Description                           |
|--------|-------------------------------------------|---------------------------------------|
| GET    | `/api/v1/dashboard/digests/preview`       | Preview next digest content           |
| PUT    | `/api/v1/dashboard/digests/settings`      | Update digest preferences             |

All endpoints accept `workspace_id` and `period` (7d/30d/90d) parameters.

---

## UI/UX Description

### Sidebar Navigation
Replace or enhance the existing "Insights" sidebar item with "Dashboard". Sub-items: Overview, Repos, Insights, Contributions.

### Overview Page (`/{workspace}/dashboard`)
- Top: period selector pills (7d / 30d / 90d), repo filter dropdown.
- Summary cards row: 6 cards with metric, value, trend arrow + percentage change. Same styling as existing KPI cards.
- Charts: 2x2 grid. Adoption trend (line), activity by repo (stacked bar), session outcomes (donut), repo heatmap (grid).
- All chart elements clickable for drill-down (cursor-pointer).

### Repo Page (`/{workspace}/dashboard/repos/{id}`)
- Repo name header with summary cards.
- Developer table: sortable, clickable rows (cursor-pointer). Sparkline in trend column.
- Readiness & friction summary with score cells color-coded.
- Activity timeline: vertical feed with icons for event types.

### Insights Page (`/{workspace}/dashboard/insights`)
- Two-column layout. Left: friction points. Right: success patterns.
- Each friction card: severity badge, title, impact metric, repo link, area, trend indicator, suggested action button (cursor-pointer), status dropdown.
- Each success card: title, frequency, repos, "Promote" button (cursor-pointer).
- Bottom: hotspot visualization (optional — can be a simple grid in v1).

### Contributions Page (`/{workspace}/dashboard/contributions`)
- Summary cards: overall AI commit %, top contributing repo, week-over-week trend.
- Contributions table: full-width, sortable. AI % cells color-coded (low = gray, moderate = amber, high = green). Clickable rows (cursor-pointer) link to repo drill-down.

### Digest Settings
- In workspace settings under "Notifications".
- Toggle for digest enabled/disabled.
- Frequency selector (daily/weekly/monthly).
- "Preview Next Digest" button (cursor-pointer).

---

## Dependencies and Risks

### Dependencies

1. **Session Ingestion PRD**: All metrics depend on sessions being correctly associated with repos, developers, and teams.
2. **Repo Readiness PRD**: Readiness scores feed into the overview and insights.
3. **Operational Memory PRD**: Friction and success patterns come from the pattern intelligence system.
4. **Team Standards PRD**: Standards adoption data feeds into rollout coverage.

### Risks

| Risk                                           | Likelihood | Impact | Mitigation                                              |
|------------------------------------------------|------------|--------|---------------------------------------------------------|
| Metric definitions don't match leader expectations | Medium  | High   | Validate metric definitions with early users; make methodology transparent |
| Dashboard is too noisy / information overload  | Medium     | Medium | Progressive disclosure: overview → drill-down; don't show everything at once |
| Friction insights feel accusatory toward developers | Low    | High   | Frame as repo-level insights, not individual blame; anonymize by default |
| Slow queries at scale (many repos, many sessions) | Medium  | Medium | Pre-aggregate metrics; use materialized views for common queries |
| Digest emails go unread                        | Medium     | Low    | Keep digests short and actionable; track open rates; allow in-app fallback |

---

## Out of Scope

- **Real-time dashboard**: All metrics are period-based (7d/30d/90d), not live-updating. Real-time monitoring is future.
- **Custom metrics or KPIs**: Metric set is fixed. Custom dashboard builder is future.
- **Benchmarking against other organizations**: No cross-workspace comparison. Only internal repo comparison.
- **Slack/Teams integration for digests**: Email and in-app only in v1.
- **Cost tracking / ROI calculation**: Correlating AI coding with business outcomes (velocity, bug rate) is future.
- **Individual developer dashboards**: Developers see limited personal stats. Full developer-facing dashboard is future.
- **Export / reporting**: No PDF export, no custom reports. Dashboard is view-only.
