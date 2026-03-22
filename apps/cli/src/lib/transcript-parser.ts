export interface TranscriptMessage {
  role: "user" | "assistant";
  content: string;
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
