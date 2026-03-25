export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ContextHealthStats {
  peak_input_tokens: number;
  end_input_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  compaction_count: number;
}

/**
 * Extract context health stats from a raw JSONL transcript.
 *
 * Each assistant message line contains:
 *   message.usage.input_tokens  — tokens in the prompt for that API call
 *     (grows each turn as conversation history is resent, so it reflects
 *      context window utilization at that moment)
 *   message.usage.output_tokens — tokens generated in the response
 *
 * Compaction is detected as a significant drop (>30%) in input_tokens
 * between consecutive assistant messages.
 */
export function extractContextHealth(raw: string): ContextHealthStats | null {
  let peakInput = 0;
  let lastInput = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let compactionCount = 0;
  let prevInput = 0;
  let messageCount = 0;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.type !== "assistant") continue;

      const usage = obj.message?.usage;
      if (!usage || typeof usage.input_tokens !== "number") continue;

      // Context window utilization = input_tokens + cached tokens
      // input_tokens alone is just the non-cached portion (often ~1-3 tokens)
      const cacheCreation = typeof usage.cache_creation_input_tokens === "number" ? usage.cache_creation_input_tokens : 0;
      const cacheRead = typeof usage.cache_read_input_tokens === "number" ? usage.cache_read_input_tokens : 0;
      const inputTokens = usage.input_tokens + cacheCreation + cacheRead;
      const outputTokens = typeof usage.output_tokens === "number" ? usage.output_tokens : 0;

      // Detect compaction: input_tokens drops >30% from previous message
      if (messageCount > 0 && prevInput > 0 && inputTokens < prevInput * 0.7) {
        compactionCount++;
      }

      if (inputTokens > peakInput) peakInput = inputTokens;
      lastInput = inputTokens;
      totalInput += inputTokens;
      totalOutput += outputTokens;
      prevInput = inputTokens;
      messageCount++;
    } catch {
      // Skip unparseable lines
    }
  }

  if (messageCount === 0) return null;

  return {
    peak_input_tokens: peakInput,
    end_input_tokens: lastInput,
    total_input_tokens: totalInput,
    total_output_tokens: totalOutput,
    compaction_count: compactionCount,
  };
}

function extractText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const texts = content
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text);
    return texts.length > 0 ? texts.join("\n") : null;
  }
  return null;
}

/**
 * Parse a Claude Code session transcript (JSONL format) into user/assistant messages.
 *
 * Real JSONL format (from ~/.claude/projects/):
 * - type: "user" | "assistant" — conversation messages
 * - type: "progress" | "file-history-snapshot" — skip
 * - isMeta: true — system messages, skip
 * - message.content: string | Array<{type: "text"|"tool_use"|"thinking", ...}>
 */
export function parseTranscript(raw: string): TranscriptMessage[] {
  const messages: TranscriptMessage[] = [];

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);

      // Skip non-message lines (progress, file-history-snapshot, etc.)
      if (obj.type !== "user" && obj.type !== "assistant") continue;

      // Skip system/meta messages
      if (obj.isMeta) continue;

      const text = extractText(obj.message?.content);
      if (!text) continue;

      // Skip command invocations and system injections
      if (text.startsWith("<local-command") || text.startsWith("<command-name>")) continue;

      messages.push({
        role: obj.type === "user" ? "user" : "assistant",
        content: text,
      });
    } catch {
      // Skip unparseable lines
    }
  }

  return messages;
}
