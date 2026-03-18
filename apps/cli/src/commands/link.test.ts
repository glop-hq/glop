import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";

vi.mock("fs");
vi.mock("../lib/config.js", () => ({
  loadConfig: vi.fn(),
  loadRepoConfig: vi.fn(),
  saveRepoConfig: vi.fn(),
}));
vi.mock("../lib/git.js", () => ({
  getRepoRoot: vi.fn(),
}));
vi.mock("../lib/select.js", () => ({
  interactiveSelect: vi.fn(),
}));

const { loadConfig, loadRepoConfig, saveRepoConfig } = await import("../lib/config.js");
const { getRepoRoot } = await import("../lib/git.js");
const { interactiveSelect } = await import("../lib/select.js");
const { linkCommand } = await import("./link.js");

describe("link command", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exits when not authenticated", async () => {
    vi.mocked(loadConfig).mockReturnValue(null);
    const exitError = new Error("process.exit");
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw exitError; });

    await expect(
      linkCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      "Not authenticated. Run `glop login` first."
    );
    mockExit.mockRestore();
  });

  it("exits when not in a git repo", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue(null);
    const exitError = new Error("process.exit");
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw exitError; });

    await expect(
      linkCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      "Not in a git repository. Run this from a git repo."
    );
    mockExit.mockRestore();
  });

  it("auto-binds when single workspace", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(loadRepoConfig).mockReturnValue(null);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        current_workspace_id: "ws-1",
        workspaces: [{ id: "ws-1", name: "Acme", slug: "acme" }],
      }),
    });

    await linkCommand.parseAsync([], { from: "user" });

    expect(saveRepoConfig).toHaveBeenCalledWith({ workspace_id: "ws-1" });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Bound to workspace "Acme"')
    );
  });

  it("shows picker for multiple workspaces", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(loadRepoConfig).mockReturnValue(null);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        current_workspace_id: "ws-1",
        workspaces: [
          { id: "ws-1", name: "Acme", slug: "acme" },
          { id: "ws-2", name: "Side", slug: "side" },
        ],
      }),
    });
    // Simulate TTY
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    vi.mocked(interactiveSelect).mockResolvedValue(1);

    await linkCommand.parseAsync([], { from: "user" });

    expect(saveRepoConfig).toHaveBeenCalledWith({ workspace_id: "ws-2" });
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Bound to workspace "Side"')
    );

    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
  });

  it("exits with error when no workspaces found", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(loadRepoConfig).mockReturnValue(null);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        current_workspace_id: null,
        workspaces: [],
      }),
    });
    const exitError = new Error("process.exit");
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw exitError; });

    await expect(
      linkCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(mockExit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("No workspaces found")
    );
    mockExit.mockRestore();
  });

  it("cancels when picker returns null", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(loadRepoConfig).mockReturnValue(null);
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        current_workspace_id: "ws-1",
        workspaces: [
          { id: "ws-1", name: "Acme", slug: "acme" },
          { id: "ws-2", name: "Side", slug: "side" },
        ],
      }),
    });
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    vi.mocked(interactiveSelect).mockResolvedValue(null);
    const exitError = new Error("process.exit");
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw exitError; });

    await expect(
      linkCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(saveRepoConfig).not.toHaveBeenCalled();
    mockExit.mockRestore();
    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
  });

  it("shows switch flow when already bound", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_test",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(loadRepoConfig).mockReturnValue({ workspace_id: "ws-old" });
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        current_workspace_id: null,
        workspaces: [{ id: "ws-1", name: "Acme", slug: "acme" }],
      }),
    });
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });

    await linkCommand.parseAsync([], { from: "user" });

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("already bound")
    );
    expect(saveRepoConfig).toHaveBeenCalledWith({ workspace_id: "ws-1" });

    Object.defineProperty(process.stdin, "isTTY", { value: undefined, configurable: true });
  });

  it("handles 401 from workspace API", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      server_url: "http://localhost:3000",
      api_key: "glop_expired",
      developer_id: "dev-1",
      developer_name: "Test",
      machine_id: "machine-1",
    });
    vi.mocked(getRepoRoot).mockReturnValue("/mock/repo");
    vi.mocked(loadRepoConfig).mockReturnValue(null);
    fetchSpy.mockResolvedValue({ ok: false, status: 401 });
    const exitError = new Error("process.exit");
    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => { throw exitError; });

    await expect(
      linkCommand.parseAsync([], { from: "user" })
    ).rejects.toThrow("process.exit");

    expect(console.error).toHaveBeenCalledWith(
      "API key is invalid or expired. Run `glop login` again."
    );
    mockExit.mockRestore();
  });
});
