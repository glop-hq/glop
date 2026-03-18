import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

vi.mock("fs");
vi.mock("child_process", () => ({
  execSync: vi.fn(),
  exec: vi.fn(() => ({ unref: vi.fn() })),
}));
vi.mock("../lib/config.js", () => ({
  saveGlobalConfig: vi.fn(),
  getMachineId: vi.fn(() => "machine-uuid-1234"),
  getDefaultServerUrl: vi.fn(() => "http://localhost:3000"),
}));
vi.mock("../lib/auth-flow.js", () => ({
  openBrowser: vi.fn(),
  findOpenPort: vi.fn(() => Promise.resolve(12345)),
  waitForCallback: vi.fn(),
}));

const { saveGlobalConfig } = await import("../lib/config.js");
const { waitForCallback } = await import("../lib/auth-flow.js");
const { loginCommand } = await import("./login.js");

describe("login command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("saves flat global config after auth", async () => {
    vi.mocked(waitForCallback).mockResolvedValue({
      api_key: "glop_newkey",
      developer_id: "dev-new",
      developer_name: "TestDev",
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      loginCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(saveGlobalConfig).toHaveBeenCalledWith({
      server_url: "http://localhost:3000",
      machine_id: "machine-uuid-1234",
      api_key: "glop_newkey",
      developer_id: "dev-new",
      developer_name: "TestDev",
    });

    mockExit.mockRestore();
  });

  it("installs global hooks in ~/.claude/settings.json", async () => {
    vi.mocked(waitForCallback).mockResolvedValue({
      api_key: "glop_newkey",
      developer_id: "dev-new",
      developer_name: "TestDev",
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      loginCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    const claudeSettingsPath = path.join(os.homedir(), ".claude", "settings.json");
    const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
      (call) => String(call[0]) === claudeSettingsPath
    );
    expect(writeCall).toBeDefined();

    const written = JSON.parse(writeCall![1] as string);
    expect(written.hooks.PostToolUse[0].hooks[0].command).toBe("glop __hook");
    expect(written.hooks.SessionStart[0].hooks[0].command).toBe("glop __hook");
    expect(written.hooks.SessionEnd[0].hooks[0].command).toBe("glop __hook");
    expect(written.hooks.Stop[0].hooks[0].command).toBe("glop __hook");
    expect(written.hooks.UserPromptSubmit[0].hooks[0].command).toBe("glop __hook");
    expect(written.hooks.PermissionRequest[0].hooks[0].command).toBe("glop __hook");

    mockExit.mockRestore();
  });

  it("preserves non-glop hooks when installing global hooks", async () => {
    vi.mocked(waitForCallback).mockResolvedValue({
      api_key: "glop_newkey",
      developer_id: "dev-new",
      developer_name: "TestDev",
    });
    const claudeSettingsPath = path.join(os.homedir(), ".claude", "settings.json");
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === claudeSettingsPath);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
      hooks: {
        PostToolUse: [{ hooks: [{ type: "command", command: "other-tool --post" }] }],
        SessionStart: [
          { hooks: [{ type: "command", command: "other-tool --start" }] },
          { hooks: [{ type: "command", command: "glop __hook" }] },
        ],
      },
    }));

    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      loginCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    const writeCall = vi.mocked(fs.writeFileSync).mock.calls.find(
      (call) => String(call[0]) === claudeSettingsPath
    );
    const written = JSON.parse(writeCall![1] as string);

    // other-tool hooks preserved, glop hook appended
    expect(written.hooks.PostToolUse).toHaveLength(2);
    expect(written.hooks.PostToolUse[0].hooks[0].command).toBe("other-tool --post");
    expect(written.hooks.PostToolUse[1].hooks[0].command).toBe("glop __hook");

    // old glop hook replaced, other-tool preserved
    expect(written.hooks.SessionStart).toHaveLength(2);
    expect(written.hooks.SessionStart[0].hooks[0].command).toBe("other-tool --start");
    expect(written.hooks.SessionStart[1].hooks[0].command).toBe("glop __hook");

    mockExit.mockRestore();
  });

  it("warns when glop is not in PATH", async () => {
    const { execSync } = await import("child_process");
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found");
    });
    vi.mocked(waitForCallback).mockResolvedValue({
      api_key: "glop_newkey",
      developer_id: "dev-new",
      developer_name: "TestDev",
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw new Error("process.exit"); });

    await expect(
      loginCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("`glop` not found in PATH")
    );

    mockExit.mockRestore();
  });
});
