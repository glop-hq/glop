import { describe, it, expect } from "vitest";
import { parseTranscript } from "./transcript-parser.js";

describe("parseTranscript", () => {
  it("extracts user messages with string content", () => {
    const jsonl = JSON.stringify({
      type: "user",
      message: { role: "user", content: "fix the auth bug" },
    });
    const messages = parseTranscript(jsonl);
    expect(messages).toEqual([
      { role: "user", content: "fix the auth bug" },
    ]);
  });

  it("extracts user messages with content block array", () => {
    const jsonl = JSON.stringify({
      type: "user",
      message: {
        role: "user",
        content: [{ type: "text", text: "add a test" }],
      },
    });
    const messages = parseTranscript(jsonl);
    expect(messages).toEqual([{ role: "user", content: "add a test" }]);
  });

  it("extracts assistant text blocks, ignores tool_use and thinking", () => {
    const jsonl = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "thinking" },
          { type: "text", text: "I'll fix the bug." },
          { type: "tool_use", name: "Edit", input: {} },
          { type: "text", text: " Here's the change." },
        ],
      },
    });
    const messages = parseTranscript(jsonl);
    expect(messages).toEqual([
      { role: "assistant", content: "I'll fix the bug.\n Here's the change." },
    ]);
  });

  it("skips progress and file-history-snapshot lines", () => {
    const lines = [
      JSON.stringify({ type: "progress", data: { type: "hook_progress" } }),
      JSON.stringify({ type: "file-history-snapshot", snapshot: {} }),
      JSON.stringify({ type: "user", message: { role: "user", content: "hello" } }),
    ].join("\n");
    const messages = parseTranscript(lines);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("hello");
  });

  it("skips isMeta messages", () => {
    const jsonl = JSON.stringify({
      type: "user",
      isMeta: true,
      message: { role: "user", content: "system stuff" },
    });
    const messages = parseTranscript(jsonl);
    expect(messages).toHaveLength(0);
  });

  it("skips local-command and command-name prefixed messages", () => {
    const lines = [
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "<local-command-caveat>stuff</local-command-caveat>" },
      }),
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "<command-name>/clear</command-name>" },
      }),
      JSON.stringify({
        type: "user",
        message: { role: "user", content: "actual prompt" },
      }),
    ].join("\n");
    const messages = parseTranscript(lines);
    expect(messages).toEqual([{ role: "user", content: "actual prompt" }]);
  });

  it("skips lines with no text content (tool_use only)", () => {
    const jsonl = JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", name: "Bash", input: {} }],
      },
    });
    const messages = parseTranscript(jsonl);
    expect(messages).toHaveLength(0);
  });

  it("handles malformed JSON lines gracefully", () => {
    const lines = "not json\n" + JSON.stringify({
      type: "user",
      message: { role: "user", content: "valid" },
    });
    const messages = parseTranscript(lines);
    expect(messages).toEqual([{ role: "user", content: "valid" }]);
  });

  it("handles a realistic multi-turn conversation", () => {
    const lines = [
      JSON.stringify({ type: "file-history-snapshot", snapshot: {} }),
      JSON.stringify({ type: "progress", data: { type: "hook_progress" } }),
      JSON.stringify({ type: "user", isMeta: true, message: { role: "user", content: "meta" } }),
      JSON.stringify({ type: "user", message: { role: "user", content: "fix the login bug" } }),
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "Let me look at the login code." },
            { type: "tool_use", name: "Read", input: { path: "src/login.ts" } },
          ],
        },
      }),
      JSON.stringify({ type: "progress", data: { type: "tool_progress" } }),
      JSON.stringify({
        type: "user",
        message: {
          role: "user",
          content: [{ type: "text", text: "yes, that looks right" }],
        },
      }),
      JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Fixed the issue." }],
        },
      }),
    ].join("\n");

    const messages = parseTranscript(lines);
    expect(messages).toEqual([
      { role: "user", content: "fix the login bug" },
      { role: "assistant", content: "Let me look at the login code." },
      { role: "user", content: "yes, that looks right" },
      { role: "assistant", content: "Fixed the issue." },
    ]);
  });
});
