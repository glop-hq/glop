/**
 * Curated tips seed data (PRD 11).
 *
 * Seeds the curated_tips table with best-practice tips on first generation run.
 */

import { sql } from "drizzle-orm";
import { schema, type DbClient } from "./db";

interface CuratedTipSeed {
  title: string;
  body: string;
  category: string;
  friction_match: string | null;
}

const CURATED_TIPS: CuratedTipSeed[] = [
  // ── Prompting ─────────────────────────────────────────
  {
    title: "Start sessions in plan mode for complex tasks",
    body: "For multi-file changes or architectural decisions, start with 'plan this first' to get a roadmap before coding. Teams report 40% fewer wrong approaches.",
    category: "prompting",
    friction_match: "wrong_approach",
  },
  {
    title: "Be specific about files and functions in prompts",
    body: "Instead of 'fix the auth bug', try 'fix the token refresh logic in src/auth/refresh.ts'. Specific prompts reduce context confusion by 60%.",
    category: "prompting",
    friction_match: "context_confusion",
  },
  {
    title: "Break large tasks into focused sessions",
    body: "Sessions under 35 minutes have 2x the success rate of longer ones. Break large features into small, focused tasks.",
    category: "prompting",
    friction_match: null,
  },

  // ── Testing ───────────────────────────────────────────
  {
    title: "Ask Claude to run tests before finishing",
    body: "End sessions with 'run the tests and fix any failures'. This catches issues early and reduces test failure friction by 50%.",
    category: "testing",
    friction_match: "test_failures",
  },
  {
    title: "Add test commands to CLAUDE.md",
    body: "Add your test command (e.g., 'Always run pnpm test after changes') to CLAUDE.md so Claude runs tests automatically.",
    category: "testing",
    friction_match: "test_failures",
  },
  {
    title: "Use test-first approach for bug fixes",
    body: "Ask Claude to write a failing test first, then fix the bug. This ensures the fix is verified and prevents regressions.",
    category: "testing",
    friction_match: "test_failures",
  },

  // ── Build & Tooling ──────────────────────────────────
  {
    title: "Document build commands in CLAUDE.md",
    body: "Add build, lint, and type-check commands to CLAUDE.md so Claude can verify changes compile correctly before finishing.",
    category: "workflow",
    friction_match: "build_failures",
  },
  {
    title: "Add lint rules to pre-commit hooks",
    body: "Pre-commit hooks catch lint and type errors before they become session friction. Configure them for your repo.",
    category: "workflow",
    friction_match: "lint_errors",
  },
  {
    title: "Document dependency installation steps",
    body: "Add 'Run pnpm install before making changes' or equivalent to CLAUDE.md to prevent dependency-related failures.",
    category: "workflow",
    friction_match: "dependency_issues",
  },

  // ── Context Management ────────────────────────────────
  {
    title: "Use /compact at the 30-minute mark",
    body: "Long sessions accumulate context that degrades Claude's performance. Use /compact periodically to reset context while keeping key information.",
    category: "context",
    friction_match: null,
  },
  {
    title: "Start fresh sessions for new tasks",
    body: "Don't reuse a session that finished one task to start another. Fresh sessions have better context and fewer repeated mistakes.",
    category: "context",
    friction_match: "repeated_mistakes",
  },
  {
    title: "Add architecture notes to CLAUDE.md",
    body: "Document key patterns, directory structure, and conventions in CLAUDE.md. This reduces 'missing context' friction significantly.",
    category: "context",
    friction_match: "missing_context",
  },

  // ── Planning ──────────────────────────────────────────
  {
    title: "Review Claude's plan before letting it code",
    body: "When Claude proposes an approach, review it before saying 'go ahead'. Catching wrong approaches early saves more time than fixing them later.",
    category: "planning",
    friction_match: "wrong_approach",
  },
  {
    title: "Scope sessions to one clear goal",
    body: "Sessions with a single, clear objective succeed more often. Avoid scope creep by deferring 'while we're at it' tasks to new sessions.",
    category: "planning",
    friction_match: "scope_creep",
  },

  // ── Type Safety ───────────────────────────────────────
  {
    title: "Add TypeScript strict mode information to CLAUDE.md",
    body: "If your project uses strict TypeScript, mention it in CLAUDE.md so Claude writes type-safe code from the start.",
    category: "workflow",
    friction_match: "type_errors",
  },

  // ── Git & Merge ───────────────────────────────────────
  {
    title: "Pull latest changes before starting a session",
    body: "Start sessions on an up-to-date branch to avoid merge conflicts. Add 'Always check git status at the start' to CLAUDE.md.",
    category: "workflow",
    friction_match: "merge_conflicts",
  },

  // ── Tool Usage ────────────────────────────────────────
  {
    title: "Grant tool permissions proactively",
    body: "If you frequently approve the same tool permissions, consider adding them to your allowlist to reduce permission friction.",
    category: "workflow",
    friction_match: "permission_friction",
  },
  {
    title: "Report persistent tool errors",
    body: "If Claude consistently fails with a specific tool, check if the tool is properly configured and accessible from your project root.",
    category: "workflow",
    friction_match: "tool_errors",
  },

  // ── General ───────────────────────────────────────────
  {
    title: "Use Claude for code review before committing",
    body: "Ask Claude to review its own changes before you commit. 'Review these changes for bugs and edge cases' catches issues early.",
    category: "workflow",
    friction_match: null,
  },
  {
    title: "Keep CLAUDE.md under 50 lines",
    body: "A concise CLAUDE.md is more effective than a long one. Focus on project-specific rules and conventions, not general programming advice.",
    category: "context",
    friction_match: null,
  },
];

/**
 * Seeds curated tips if the table is empty.
 */
export async function seedCuratedTips(db: DbClient): Promise<void> {
  const existing = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.curated_tips);

  if (existing[0].count > 0) return;

  await db.insert(schema.curated_tips).values(
    CURATED_TIPS.map((tip) => ({
      title: tip.title,
      body: tip.body,
      category: tip.category,
      friction_match: tip.friction_match,
    }))
  );
}
