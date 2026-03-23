interface InsightData {
  friction_analysis: Array<{
    category: string;
    count: number;
    area: string | null;
    detail: string;
  }>;
  success_patterns: Array<{
    pattern: string;
    area: string | null;
    detail: string;
  }>;
  area_complexity: Array<{
    area: string;
    avg_iterations: number;
    avg_friction_count: number;
  }>;
  file_coupling: Array<{
    files: string[];
    frequency: number;
  }>;
  claude_md_suggestions: string[];
}

interface ClaudeItem {
  kind: string;
  name: string;
  content: string;
}

export function buildSuggestionPrompt(
  repoKey: string,
  prompts: string[],
  insight: InsightData,
  existingItems: ClaudeItem[]
): string {
  const existingNames = existingItems.map((i) => `${i.kind}: ${i.name}`);

  return `You are analyzing developer workflow patterns for the repository "${repoKey}" to suggest Claude Code skills, commands, or hooks that the team should create.

You have two data sources:
1. Recent developer prompts — what developers actually ask Claude to do
2. Repo insight data — friction patterns, success patterns, and area complexity

Your job: identify repeated patterns that would benefit from a reusable skill, command, or hook. Focus on patterns that appear across MULTIPLE developers or sessions.

Return ONLY valid JSON (no markdown fences, no explanation) as an array:
[
  {
    "suggestion_type": "skill" | "command" | "hook",
    "title": "Short descriptive title",
    "rationale": "Why this would help, referencing specific evidence from the data",
    "draft_content": "The full file content for .claude/skills/*.md, .claude/commands/*.md, or settings.json hook entry",
    "draft_filename": ".claude/skills/example.md or .claude/commands/example.md",
    "pattern_type": "prompt_pattern" | "area_friction" | "complex_area" | "workflow_gap" | "test_failure",
    "pattern_data": { "evidence_key": "evidence_value" }
  }
]

Rules:
- Generate 1-5 suggestions maximum. Quality over quantity.
- Only suggest items that do NOT duplicate these existing skills/commands: ${existingNames.length > 0 ? existingNames.join(", ") : "(none)"}
- Skills (.claude/skills/*.md): Use for area-specific context, architecture guides, conventions. Include a YAML frontmatter with "description" field.
- Commands (.claude/commands/*.md): Use for multi-step workflows that developers repeat. Include YAML frontmatter with "description" and "user_type: user-invocable" fields.
- Hooks: Use for automated checks (pre-commit tests, lint). Draft as JSON matching Claude Code hooks format.
- draft_content must be valid, ready-to-use file content
- rationale must reference specific evidence (prompt count, friction category, area name)
- If there is insufficient evidence for meaningful suggestions, return an empty array []

=== DEVELOPER PROMPTS (${prompts.length} recent) ===
${prompts.slice(0, 200).join("\n---\n")}

=== FRICTION ANALYSIS ===
${JSON.stringify(insight.friction_analysis, null, 2)}

=== SUCCESS PATTERNS ===
${JSON.stringify(insight.success_patterns, null, 2)}

=== AREA COMPLEXITY ===
${JSON.stringify(insight.area_complexity, null, 2)}

=== FILE COUPLING ===
${JSON.stringify(insight.file_coupling, null, 2)}

=== EXISTING CLAUDE.MD SUGGESTIONS ===
${insight.claude_md_suggestions.join("\n")}
`;
}
