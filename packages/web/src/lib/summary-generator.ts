import Anthropic from "@anthropic-ai/sdk";

export interface RunData {
  id: string;
  title: string | null;
  summary: string | null;
  prompts: string[];
  toolUseLabels: string[];
  filesTouched: string[];
}

export interface PrSummary {
  developer_prompt: string;
  process_summary: string;
  key_decisions: string[];
  files_changed: string[];
}

function isAnthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function generatePrSummary(runData: RunData): Promise<PrSummary> {
  if (!isAnthropicConfigured()) {
    return extractFromTemplate(runData);
  }

  try {
    const client = new Anthropic();

    const inputPrompts = runData.prompts.slice(0, 5);
    const inputLabels = runData.toolUseLabels.slice(0, 20);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Analyze this AI coding session and produce a structured summary for a GitHub PR comment.

Session title: ${runData.title || "Untitled"}
Session summary: ${runData.summary || "No summary"}

Developer prompts (first 5):
${inputPrompts.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Tool actions taken (first 20):
${inputLabels.map((l, i) => `${i + 1}. ${l}`).join("\n")}

Files touched:
${runData.filesTouched.join("\n")}

Respond with JSON only, no markdown fences:
{
  "developer_prompt": "One sentence summarizing what the developer asked for",
  "process_summary": "2-3 sentences describing how the AI approached the task",
  "key_decisions": ["Decision 1", "Decision 2"],
  "files_changed": ["file1.ts", "file2.ts"]
}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const parsed = JSON.parse(text) as PrSummary;

    return {
      developer_prompt: parsed.developer_prompt || inputPrompts[0] || "No prompt recorded",
      process_summary: parsed.process_summary || runData.summary || "No summary available",
      key_decisions: parsed.key_decisions || [],
      files_changed: parsed.files_changed || runData.filesTouched,
    };
  } catch (error) {
    console.error("Failed to generate AI summary, falling back to template:", error);
    return extractFromTemplate(runData);
  }
}

function extractFromTemplate(runData: RunData): PrSummary {
  return {
    developer_prompt: runData.prompts[0] || "No prompt recorded",
    process_summary: runData.summary || runData.title || "No summary available",
    key_decisions: [],
    files_changed: runData.filesTouched,
  };
}
