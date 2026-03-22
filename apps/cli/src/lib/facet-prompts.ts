export const SUMMARIZE_CHUNK_PROMPT = `Summarize this Claude Code session transcript chunk concisely, focusing on:
1. What the user asked for (goals)
2. What Claude did (actions, files modified)
3. Any friction encountered (errors, wrong approaches, user corrections)
4. The outcome (did it succeed?)

Keep it under 500 words. Be factual, not evaluative.

=== TRANSCRIPT CHUNK ===
`;

export const EXTRACT_FACET_PROMPT = `Analyze this Claude Code session transcript and return a JSON object characterizing the session.

Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "goal_categories": {
    "debug_investigate": 0,
    "implement_feature": 0,
    "fix_bug": 0,
    "write_script_tool": 0,
    "refactor_code": 0,
    "configure_system": 0,
    "create_pr_commit": 0,
    "analyze_data": 0,
    "understand_codebase": 0,
    "write_tests": 0,
    "write_docs": 0,
    "deploy_infra": 0,
    "warmup_minimal": 0
  },
  "outcome": "fully_achieved",
  "satisfaction": "satisfied",
  "session_type": "single_task",
  "friction_counts": {
    "misunderstood_request": 0,
    "wrong_approach": 0,
    "buggy_code": 0,
    "user_rejected_action": 0,
    "claude_got_blocked": 0,
    "user_stopped_early": 0,
    "wrong_file_or_location": 0,
    "excessive_changes": 0,
    "slow_or_verbose": 0,
    "tool_failed": 0,
    "user_unclear": 0,
    "external_issue": 0
  },
  "friction_detail": "one sentence describing the main friction, or null if none",
  "primary_success": "correct_code_edits",
  "files_touched": ["path/to/file.ts"],
  "area": "src/auth/",
  "brief_summary": "one sentence summary of the session",
  "duration_minutes": 15,
  "iteration_count": 4
}

Rules:
- goal_categories: Set to 1 for each goal the USER explicitly asked for. Do not count Claude's autonomous actions.
- outcome: One of: fully_achieved, mostly_achieved, partially_achieved, not_achieved, unclear
- satisfaction: Base ONLY on explicit user signals. "great!" = happy, "that's not right" = dissatisfied, no signal = unsure. One of: frustrated, dissatisfied, likely_satisfied, satisfied, happy, unsure
- session_type: One of: single_task, multi_task, iterative_refinement, exploration, quick_question
- friction_counts: Count only clear instances. Be conservative.
- primary_success: One of: none, fast_accurate_search, correct_code_edits, good_explanations, proactive_help, multi_file_changes, good_debugging, or null
- files_touched: List files that were actually edited/created (from Edit/Write tool uses)
- area: The primary directory where most work happened (e.g., "src/auth/"). null if scattered.
- duration_minutes: Estimate from timestamps if available, otherwise null
- iteration_count: Count of edit→test→fix cycles. null if unclear.

=== SESSION TRANSCRIPT ===
`;
