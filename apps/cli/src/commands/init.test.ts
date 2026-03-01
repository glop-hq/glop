import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs";

vi.mock("fs");
vi.mock("../lib/config.js", () => ({
  loadConfig: vi.fn(),
}));
vi.mock("../lib/git.js", () => ({
  getRepoRoot: vi.fn(),
}));

const { loadConfig } = await import("../lib/config.js");
const { getRepoRoot } = await import("../lib/git.js");
const { initCommand } = await import("./init.js");

describe("init command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("writes hooks to settings.json with glop __hook command", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test123",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await initCommand.parseAsync([], { from: "user" });

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find((call) =>
      String(call[0]).endsWith("settings.json")
    );
    expect(writeCall).toBeDefined();

    const written = JSON.parse(writeCall![1] as string);
    expect(written.hooks.PostToolUse[0].hooks[0].command).toBe("glop __hook");
    expect(written.hooks.SessionStart[0].hooks[0].command).toBe("glop __hook");
    expect(written.hooks.SessionEnd[0].hooks[0].command).toBe("glop __hook");
    expect(written.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
      "glop __hook"
    );
    expect(written.hooks.Stop[0].hooks[0].command).toBe("glop __hook");
    expect(written.hooks.PermissionRequest[0].hooks[0].command).toBe(
      "glop __hook"
    );
  });

  it("preserves existing non-hook settings", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test123",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ customSetting: true })
    );

    await initCommand.parseAsync([], { from: "user" });

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find((call) =>
      String(call[0]).endsWith("settings.json")
    );
    const written = JSON.parse(writeCall![1] as string);
    expect(written.customSetting).toBe(true);
    expect(written.hooks).toBeDefined();
  });

  it("exits when not authenticated", async () => {
    vi.mocked(loadConfig).mockReturnValue(null);
    const exitError = new Error("process.exit");
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw exitError; });

    await expect(
      initCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      "Not authenticated. Run `glop auth` first."
    );
    mockExit.mockRestore();
  });

  it("warns but continues when not in a git repo", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test123",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue(null);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await initCommand.parseAsync([], { from: "user" });

    expect(console.warn).toHaveBeenCalledWith(
      "Warning: not in a git repository. Repo and branch tracking will be limited."
    );
    // Should still write hooks
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
