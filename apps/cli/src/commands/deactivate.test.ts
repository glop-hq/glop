import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";

vi.mock("fs");
vi.mock("../lib/git.js", () => ({
  getRepoRoot: vi.fn(),
}));

const { getRepoRoot } = await import("../lib/git.js");
const { deactivateCommand } = await import("./deactivate.js");

describe("deactivate command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("removes glop __hook entries from settings", async () => {
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        hooks: {
          PostToolUse: [
            { hooks: [{ type: "command", command: "glop __hook" }] },
          ],
          SessionStart: [
            { hooks: [{ type: "command", command: "glop __hook" }] },
          ],
          SessionEnd: [
            { hooks: [{ type: "command", command: "glop __hook" }] },
          ],
          UserPromptSubmit: [
            { hooks: [{ type: "command", command: "glop __hook" }] },
          ],
          Stop: [{ hooks: [{ type: "command", command: "glop __hook" }] }],
          PermissionRequest: [
            { hooks: [{ type: "command", command: "glop __hook" }] },
          ],
        },
      })
    );

    await deactivateCommand.parseAsync([], { from: "user" });

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const written = JSON.parse(writeCall[1] as string);
    expect(written.hooks).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith(
      "Removed glop hooks from 6 event(s)."
    );
  });

  it("removes old curl-style hooks too", async () => {
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        hooks: {
          PostToolUse: [
            {
              hooks: [
                {
                  type: "command",
                  command:
                    "curl -s -X POST http://localhost:3000/api/v1/ingest/hook -d @-",
                },
              ],
            },
          ],
        },
      })
    );

    await deactivateCommand.parseAsync([], { from: "user" });

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const written = JSON.parse(writeCall[1] as string);
    expect(written.hooks).toBeUndefined();
  });

  it("preserves non-glop hooks", async () => {
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        hooks: {
          PostToolUse: [
            { hooks: [{ type: "command", command: "glop __hook" }] },
            { hooks: [{ type: "command", command: "my-other-tool" }] },
          ],
          SessionStart: [
            { hooks: [{ type: "command", command: "glop __hook" }] },
          ],
        },
      })
    );

    await deactivateCommand.parseAsync([], { from: "user" });

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
    const written = JSON.parse(writeCall[1] as string);
    expect(written.hooks.PostToolUse).toHaveLength(1);
    expect(written.hooks.PostToolUse[0].hooks[0].command).toBe("my-other-tool");
    expect(written.hooks.SessionStart).toBeUndefined();
  });

  it("reports nothing to remove when no glop hooks found", async () => {
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({
        hooks: {
          PostToolUse: [
            { hooks: [{ type: "command", command: "other-tool" }] },
          ],
        },
      })
    );

    await deactivateCommand.parseAsync([], { from: "user" });

    expect(console.log).toHaveBeenCalledWith(
      "No glop hooks found. Nothing to remove."
    );
  });

  it("handles missing settings file", async () => {
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await deactivateCommand.parseAsync([], { from: "user" });

    expect(console.log).toHaveBeenCalledWith(
      "No .claude/settings.json found. Nothing to remove."
    );
  });
});
