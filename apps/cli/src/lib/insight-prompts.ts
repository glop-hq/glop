export function buildRepoInsightPrompt(
  repoKey: string,
  stats: {
    sessionCount: number;
    developerCount: number;
    outcomeDistribution: Record<string, number>;
    frictionDistribution: Record<string, number>;
    topAreas: Array<{ area: string; count: number }>;
  },
  sessionSummaries: string[],
  frictionDetails: string[]
): string {
  return `You are analyzing Claude Code usage patterns for the repository "${repoKey}".

Below are aggregated statistics from ${stats.sessionCount} sessions by ${stats.developerCount} developers, plus session summaries and friction details.

Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "friction_analysis": [
    { "category": "wrong_approach", "count": 5, "area": "src/auth/", "detail": "Description of the friction pattern" }
  ],
  "success_patterns": [
    { "pattern": "correct_code_edits", "area": "src/api/", "detail": "Description of what works well" }
  ],
  "claude_md_suggestions": [
    "Specific rule or instruction to add to CLAUDE.md based on observed friction"
  ],
  "file_coupling": [
    { "files": ["schema.ts", "types.ts"], "frequency": 0.85 }
  ],
  "area_complexity": [
    { "area": "src/auth/", "avg_iterations": 8.5, "avg_friction_count": 2.1 }
  ]
}

Rules:
- friction_analysis: Top 3-5 friction categories observed. Include the most affected code area and a specific, actionable description.
- success_patterns: Top 3 things that work well. Be specific about what succeeds.
- claude_md_suggestions: 3-5 specific rules for CLAUDE.md based on repeated friction. These should prevent the friction from recurring. Be concrete (e.g., "Always run pnpm test:auth after changes to src/auth/").
- file_coupling: Files that are frequently touched together. Only include pairs with frequency > 0.5.
- area_complexity: Areas that consistently require more iterations. Include average iteration count and friction count.

=== OUTCOME DISTRIBUTION ===
${JSON.stringify(stats.outcomeDistribution, null, 2)}

=== FRICTION DISTRIBUTION ===
${JSON.stringify(stats.frictionDistribution, null, 2)}

=== TOP CODE AREAS ===
${stats.topAreas.map((a) => `${a.area}: ${a.count} sessions`).join("\n")}

=== SESSION SUMMARIES (up to 50) ===
${sessionSummaries.slice(0, 50).join("\n---\n")}

=== FRICTION DETAILS (up to 20) ===
${frictionDetails.slice(0, 20).join("\n---\n")}
`;
}
